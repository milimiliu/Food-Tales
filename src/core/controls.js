import * as THREE from 'three';

const EYE_HEIGHT = 1.62;
const CROUCH_HEIGHT = 0.95;
const CROUCH_SPEED = 0.45;
const CROUCH_LERP = 9;
const PITCH_LIMIT = 1.35;
const LOOK_SPEED = 0.003;
const MOUSE_LOOK = 0.0023;
const DRAG_SPEED = 0.006;
const WALK_SPEED = 2.6;
const PLAYER_RADIUS = 0.3;
const LOCK_RETRY_DELAY = 1.4;

export function createControls(camera, domElement, bounds) {
    const view = { yaw: 0, pitch: 0 };
    const lookPointer = { id: null, x: 0, y: 0 };
    const panPointer = { id: null, x: 0, y: 0 };
    const keys = new Set();
    const tapHandlers = new Set();
    const lockHandlers = new Set();
    let obstacles = [];
    let tap = null;
    let travelled = 0;
    let crouched = false;
    let eyeHeight = EYE_HEIGHT;
    let lockSupported = typeof domElement.requestPointerLock === 'function';
    let lockRetryAt = 0;

    camera.rotation.order = 'YXZ';

    function applyRotation() {
        camera.rotation.y = view.yaw;
        camera.rotation.x = view.pitch;
    }

    function clampPosition() {
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX, bounds.maxX);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ, bounds.maxZ);
        camera.position.y = eyeHeight;
    }

    function avoidFurniture() {
        const position = camera.position;
        obstacles.forEach(area => {
            const minX = area.minX - PLAYER_RADIUS;
            const maxX = area.maxX + PLAYER_RADIUS;
            const minZ = area.minZ - PLAYER_RADIUS;
            const maxZ = area.maxZ + PLAYER_RADIUS;
            if (position.x <= minX || position.x >= maxX || position.z <= minZ || position.z >= maxZ) {
                return;
            }
            let best = null;
            let bestCost = Infinity;
            const consider = (x, z) => {
                if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
                    return;
                }
                const cost = Math.abs(x - position.x) + Math.abs(z - position.z);
                if (cost < bestCost) {
                    bestCost = cost;
                    best = { x, z };
                }
            };
            consider(minX, position.z);
            consider(maxX, position.z);
            consider(position.x, minZ);
            consider(position.x, maxZ);
            if (best) {
                position.x = best.x;
                position.z = best.z;
            }
        });
    }

    const forwardVec = new THREE.Vector3();
    const rightVec = new THREE.Vector3();

    function forward() {
        return forwardVec.set(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    }

    function right() {
        return rightVec.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
    }

    function moveBy(forwardAmount, strafeAmount) {
        if (forwardAmount !== 0) {
            camera.position.addScaledVector(forward(), forwardAmount);
        }
        if (strafeAmount !== 0) {
            camera.position.addScaledVector(right(), strafeAmount);
        }
        travelled += Math.abs(forwardAmount) + Math.abs(strafeAmount);
        clampPosition();
        avoidFurniture();
    }

    function walk(amount) {
        moveBy(amount, 0);
    }

    function sidestep(amount) {
        moveBy(0, amount);
    }

    function turn(dx, dy) {
        if (dx === 0 && dy === 0) {
            return;
        }
        view.yaw -= dx * MOUSE_LOOK;
        view.pitch = THREE.MathUtils.clamp(view.pitch - dy * MOUSE_LOOK, -PITCH_LIMIT, PITCH_LIMIT);
        applyRotation();
    }

    function isLocked() {
        return document.pointerLockElement === domElement;
    }

    function reportLockFailed() {
        lockRetryAt = performance.now() + LOCK_RETRY_DELAY * 1000;
        lockHandlers.forEach(handler => handler(false));
    }

    function releasePointer() {
        keys.clear();
        lookPointer.id = null;
        panPointer.id = null;
        tap = null;
    }

    function requestLock() {
        if (!lockSupported || isLocked() || performance.now() < lockRetryAt) {
            return;
        }
        const result = domElement.requestPointerLock();
        if (result && typeof result.catch === 'function') {
            result.catch(reportLockFailed);
        }
    }

    function releaseLock() {
        if (isLocked()) {
            document.exitPointerLock();
        }
    }

    function onLockChange(handler) {
        lockHandlers.add(handler);
        return () => lockHandlers.delete(handler);
    }

    document.addEventListener('pointerlockchange', () => {
        const locked = isLocked();
        if (locked) {
            lockRetryAt = 0;
        } else {
            releasePointer();
        }
        lockHandlers.forEach(handler => handler(locked));
    });

    domElement.addEventListener('pointerlockerror', reportLockFailed);

    function onPointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }
        if (domElement.setPointerCapture && !isLocked()) {
            try {
                domElement.setPointerCapture(event.pointerId);
            } catch (error) {
                tap = null;
            }
        }
        if (event.pointerType === 'touch' && lookPointer.id !== null) {
            panPointer.id = event.pointerId;
            panPointer.x = event.clientX;
            panPointer.y = event.clientY;
            tap = null;
            return;
        }
        if (event.pointerType === 'touch' && lookPointer.id === null) {
            lookPointer.id = event.pointerId;
            lookPointer.x = event.clientX;
            lookPointer.y = event.clientY;
        }
        tap = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    }

    function onPointerMove(event) {
        if (event.pointerType === 'touch') {
            if (event.pointerId === lookPointer.id) {
                const dx = event.clientX - lookPointer.x;
                const dy = event.clientY - lookPointer.y;
                lookPointer.x = event.clientX;
                lookPointer.y = event.clientY;
                view.yaw -= dx * LOOK_SPEED;
                view.pitch = THREE.MathUtils.clamp(view.pitch - dy * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
                applyRotation();
                if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) {
                    tap = null;
                }
                return;
            }
            if (event.pointerId === panPointer.id) {
                const dx = event.clientX - panPointer.x;
                const dy = event.clientY - panPointer.y;
                panPointer.x = event.clientX;
                panPointer.y = event.clientY;
                walk(-dy * DRAG_SPEED);
                sidestep(dx * DRAG_SPEED);
            }
            return;
        }
        turn(event.movementX || 0, event.movementY || 0);
        if (!isLocked() && tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) {
            tap = null;
        }
    }

    function onPointerUp(event) {
        if (event.pointerId === lookPointer.id) {
            lookPointer.id = null;
        }
        if (event.pointerId === panPointer.id) {
            panPointer.id = null;
        }
        if (tap && tap.id === event.pointerId && performance.now() - tap.time < 260) {
            tapHandlers.forEach(handler => handler());
        }
        tap = null;
    }

    function onKeyDown(event) {
        // 下蹲做成「按一下切换」：浏览器里按住 Ctrl 再按 W 会触发 Ctrl+W 关标签页
        if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
            if (!event.repeat) {
                crouched = !crouched;
            }
            return;
        }
        keys.add(event.code);
    }

    function onKeyUp(event) {
        keys.delete(event.code);
    }

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointercancel', onPointerUp);
    domElement.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releasePointer);
    document.addEventListener('visibilitychange', releasePointer);

    function update(delta) {
        travelled = 0;
        const wantHeight = crouched ? CROUCH_HEIGHT : EYE_HEIGHT;
        if (Math.abs(eyeHeight - wantHeight) > 0.0005) {
            eyeHeight += (wantHeight - eyeHeight) * Math.min(delta * CROUCH_LERP, 1);
            camera.position.y = eyeHeight;
        }
        let forwardInput = 0;
        let strafeInput = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) {
            forwardInput += 1;
        }
        if (keys.has('KeyS') || keys.has('ArrowDown')) {
            forwardInput -= 1;
        }
        if (keys.has('KeyD') || keys.has('ArrowRight')) {
            strafeInput += 1;
        }
        if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            strafeInput -= 1;
        }
        if (forwardInput !== 0 || strafeInput !== 0) {
            const speed = WALK_SPEED * (crouched ? CROUCH_SPEED : 1) * delta;
            moveBy(forwardInput * speed, strafeInput * speed);
        }
        return travelled;
    }

    function setObstacles(next) {
        obstacles = next || [];
        avoidFurniture();
    }

    function setView(position, yaw, pitch = 0) {
        camera.position.copy(position);
        view.yaw = yaw;
        view.pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
        applyRotation();
        clampPosition();
        avoidFurniture();
    }

    function toggleCrouch() {
        crouched = !crouched;
        return crouched;
    }

    function isCrouched() {
        return crouched;
    }

    function onTap(handler) {
        tapHandlers.add(handler);
        return () => tapHandlers.delete(handler);
    }

    return {
        update,
        resolve: avoidFurniture,
        setObstacles,
        setView,
        onTap,
        requestLock,
        releaseLock,
        isLocked,
        onLockChange,
        toggleCrouch,
        isCrouched
    };
}
