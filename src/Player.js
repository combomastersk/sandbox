import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export default class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3();
        this.speed = 5; // Reduced speed for realistic movement
        
        // Jump / Physics params
        this.velocityY = 0;
        this.gravity = -20;
        this.jumpForce = 8;
        this.isJumping = false;

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            space: false
        };

        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.isLoaded = false;

        this.init();
        this.addInputListeners();
    }

    init() {
        // Fallback or placeholder until model loads?
        // Let's just load the model directly

        const loader = new FBXLoader();

        // Load Model
        loader.load('/models/mc.fbx', (fbx) => {
            this.mesh = fbx;
            this.mesh.position.copy(this.position);
            this.mesh.scale.set(1.0, 1.0, 1.0); // Corrected scale for visibility
            // Enable shadows
            this.mesh.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            this.scene.add(this.mesh);

            // Setup Animation Mixer
            this.mixer = new THREE.AnimationMixer(this.mesh);

            // Load Animations
            this.loadAnimations(loader);
        });
    }

    loadAnimations(loader) {
        const animsToLoad = {
            idle: '/models/mc_standing_idle.fbx',
            walk: '/models/mc_walking.fbx',
            jump: '/models/mc_standing_jump.fbx'
        };

        let loadedCount = 0;
        const total = Object.keys(animsToLoad).length;

        for (const [name, path] of Object.entries(animsToLoad)) {
            loader.load(path, (animFbx) => {
                const clip = animFbx.animations[0];
                const action = this.mixer.clipAction(clip);
                this.animations[name] = action;

                loadedCount++;
                if (loadedCount === total) {
                    this.isLoaded = true;
                    this.playAnimation('idle');
                }
            });
        }
    }

    playAnimation(name) {
        if (!this.animations[name]) return;

        const newAction = this.animations[name];

        if (this.currentAction === newAction) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        newAction.reset().fadeIn(0.2).play();
        this.currentAction = newAction;
    }

    addInputListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space': this.keys.space = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.space = false; break;
        }
    }

    update(deltaTime) {
        if (!this.isLoaded) return;

        // Update Animation
        if (this.mixer) this.mixer.update(deltaTime);

        // Handle Jump Input
        if (this.keys.space && !this.isJumping) {
            this.velocityY = this.jumpForce;
            this.isJumping = true;
        }

        // Apply Gravity
        this.velocityY += this.gravity * deltaTime;
        this.position.y += this.velocityY * deltaTime;

        // Ground Collision
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocityY = 0;
            this.isJumping = false;
        }

        // Update mesh vertical position
        this.mesh.position.y = this.position.y;


        // Movement Input Vector
        const inputVector = new THREE.Vector3(0, 0, 0);
        if (this.keys.forward) inputVector.z -= 1;
        if (this.keys.backward) inputVector.z += 1;
        if (this.keys.left) inputVector.x -= 1;
        if (this.keys.right) inputVector.x += 1;

        if (inputVector.length() > 0) {
            inputVector.normalize();

            // Calculate camera-relative direction
            // Get camera direction projected on XZ plane
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            // Get camera right vector
            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)); // Cross Y-up to get Right

            // Combine inputs
            // Forward/Back moves along cameraDirection
            // Left/Right moves along cameraRight
            const moveDirection = new THREE.Vector3();

            // Note: In Three.js, Forward is -Z. 
            // inputVector.z: -1 is Forward, +1 is Backward
            // inputVector.x: -1 is Left, +1 is Right

            // Forward Component (-Z input moves along +Direction)
            moveDirection.addScaledVector(cameraDirection, -inputVector.z);
            moveDirection.addScaledVector(cameraRight, inputVector.x);

            moveDirection.normalize();

            // Move player
            const moveStep = moveDirection.multiplyScalar(this.speed * deltaTime);
            this.position.x += moveStep.x;
            this.position.z += moveStep.z;
            this.mesh.position.x = this.position.x;
            this.mesh.position.z = this.position.z;

            // Rotate mesh to face movement direction
            const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);

            // Smooth rotation
            const q = new THREE.Quaternion();
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotation);
            this.mesh.quaternion.slerp(q, 10 * deltaTime);
        }

        // Animation State Logic
        if (this.isJumping) {
            this.playAnimation('jump');
        } else if (inputVector.length() > 0) {
            this.playAnimation('walk');
        } else {
            this.playAnimation('idle');
        }
    }
}
