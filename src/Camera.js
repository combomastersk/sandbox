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
    }

    calculateIdealOffset() {
        // Calculate offset based on spherical coordinates
        const x = this.radius * Math.sin(this.theta) * Math.cos(this.phi);
        let y = this.radius * Math.sin(this.phi) + 1.5; // Base height relative to player
        const z = this.radius * Math.cos(this.theta) * Math.cos(this.phi);

        // Clamp Y to prevent clipping into ground
        // We know player is at approx Y=0 (or position.y)
        // Let's assume ground is at Y=0.
        // We want absolute camera Y to be > 0.1
        // Absolute Y = player.pos.y + offset.y
        // But here we return offset relative to player? No, previous code added to target pos.
        // Let's check previous implementation:
        // offset.add(this.target.mesh.position);

        // So we calculate local offset (x,y,z), then add target position.

        // Let's check the Y clamp logic relative to ground.
        // Ideally we check after adding to target position, but we can try to constrain the local y part.
        // Actually, simpler to just ensure the phi angle doesn't let it go below ground.

        // Or explicit clamp:
        const offset = new THREE.Vector3(x, y, z);
        const finalPos = offset.clone().add(this.target.mesh.position);

        if (finalPos.y < 0.5) {
            finalPos.y = 0.5;
            // We can't just modify finalPos and return offset.
            // We need to return the object that update() uses.
            // But update() calls this and then lerps to it.
            // So if we return the absolute position instead of offset, we need to change update().
            // Wait, calculateIdealOffset returns "offset" which is a Vector3.
            // In previous code: 
            // offset.add(this.target.mesh.position);
            // return offset; 
            // So it returns the TARGET POSITION (World Space), not just the offset vector.
            // The name "calculateIdealOffset" is slightly misleading, it calculates "IdealPosition".
        }

        // Correct implementation:
        offset.add(this.target.mesh.position);

        // Clamp height
        if (offset.y < 0.2) {
            offset.y = 0.2;
        }

        return offset;
    }

    calculateIdealLookat() {
        // Look at the player (slightly up at head/chest level)
        const lookAtPos = new THREE.Vector3(0, 1.5, 0);
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
        const t = 1.0 - Math.pow(0.0001, timeElapsed);

        this.currentPosition.lerp(idealOffset, t);
        this.currentLookat.lerp(idealLookat, t);

        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookat);
    }
}
