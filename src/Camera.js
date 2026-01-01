import * as THREE from 'three';

export default class CameraController {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target; // expects a Player instance

        this.currentPosition = new THREE.Vector3();
        this.currentLookat = new THREE.Vector3();

        // Camera Control State
        this.radius = 3.0; // Distance from target (Closer)
        this.theta = 0;    // Horizontal angle (Yaw)
        this.phi = 0;      // Vertical angle (Pitch)

        // Shoulder Mode State
        this.isShoulderMode = false;

        // Limits
        this.minPhi = -Math.PI / 4; // Look down limit
        this.maxPhi = Math.PI / 3;  // Look up limit

        this.sensitivity = 0.002;

        this.initInput();
    }

    initInput() {
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                this.theta -= e.movementX * this.sensitivity;
                this.phi -= e.movementY * this.sensitivity;

                // Clamp Pitch
                this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyV') {
                this.isShoulderMode = !this.isShoulderMode;
            }
        });
    }

    calculateIdealOffset() {
        // Defines camera position relative to target

        // Parameters based on mode
        const currentRadius = this.isShoulderMode ? 1.5 : 3.0;
        // In shoulder mode, we also want to shift the camera to the right relative to the view
        const sideOffset = this.isShoulderMode ? 0.8 : 0.0;
        const heightOffset = this.isShoulderMode ? 1.5 : 1.5; // Slightly higher in shoulder mode? keep same for now

        // 1. Calculate base spherical position (behind player)
        const x = currentRadius * Math.sin(this.theta) * Math.cos(this.phi);
        const y = currentRadius * Math.sin(this.phi) + heightOffset;
        const z = currentRadius * Math.cos(this.theta) * Math.cos(this.phi);

        const offset = new THREE.Vector3(x, y, z);

        // 2. Apply Side Offset (Right vector relative to camera yaw)
        // Camera forward (on XZ plane) = (sin(theta), 0, cos(theta))
        // Camera right = (cos(theta), 0, -sin(theta))
        if (sideOffset !== 0) {
            const rightX = Math.cos(this.theta);
            const rightZ = -Math.sin(this.theta);

            offset.x += rightX * sideOffset;
            offset.z += rightZ * sideOffset;
        }

        offset.add(this.target.mesh.position);

        // Clamp height
        if (offset.y < 0.2) {
            offset.y = 0.2;
        }

        return offset;
    }

    calculateIdealLookat() {
        // Look at the player (slightly up at head/chest level)
        // In shoulder mode, we might want to look slightly to the side of the player (forward), 
        // effectively centering the crosshair, rather than looking AT the player.
        // For now, let's keep looking at the player but maybe adjust offset if needed.

        const lookAtPos = new THREE.Vector3(0, 1.5, 0);

        // Optional: Shift lookAt target so player isn't dead center in shoulder mode
        if (this.isShoulderMode) {
            // If we look at player, and camera is to the right, player is on left.
            // If we want player more to the left, we look at a point to the RIGHT of the player.
            const sideLookOffset = 0.8;
            const rightX = Math.cos(this.theta);
            const rightZ = -Math.sin(this.theta);
            lookAtPos.x += rightX * sideLookOffset;
            lookAtPos.z += rightZ * sideLookOffset;
        }

        lookAtPos.add(this.target.mesh.position);
        return lookAtPos;
    }

    update(timeElapsed) {
        if (!this.target.mesh) return;

        // For a third person camera controlled by mouse, we usually want direct control
        // rather than the delayed lerp I had before, otherwise it feels "floaty".
        // Or a very fast lerp.

        const idealOffset = this.calculateIdealOffset();
        const idealLookat = this.calculateIdealLookat();

        // Use a faster lerp for responsiveness, or direct copy
        // For seamless transition, we rely on this lerp.
        // t = 1.0 - Math.pow(0.001, timeElapsed) -> very fast
        // Let's use a fixed alpha for frame-rate independenceish or standard delta lerp
        // Frame independent damping:
        // current = lerp(current, target, 1 - exp(-decay * dt))
        // decay = 10 (fast), 5 (smooth).
        // Let's use a standard smooth decay.

        const decay = 10.0;
        const t = 1.0 - Math.exp(-decay * timeElapsed);

        this.currentPosition.lerp(idealOffset, t);
        this.currentLookat.lerp(idealLookat, t);

        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookat);
    }
}
