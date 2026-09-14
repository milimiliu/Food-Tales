import * as THREE from 'three';
import { setHighlight } from '../world/palette.js';

export function createPicker(camera, maxDistance = 3.6) {
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    let targets = [];
    let hovered = null;
    const hits = [];

    function register(object, data) {
        object.userData.pick = data;
        if (!targets.includes(object)) {
            targets.push(object);
        }
        return object;
    }

    function unregister(object) {
        targets = targets.filter(item => item !== object);
        if (hovered && hovered.object === object) {
            setHighlight(object, false);
            hovered = null;
        }
    }

    function detect() {
        raycaster.setFromCamera(center, camera);
        hits.length = 0;
        raycaster.intersectObjects(targets, true, hits);
        let foundObject = null;
        let foundData = null;
        let foundDistance = 0;
        let foundPriority = 0;
        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            if (hit.distance > maxDistance) {
                break;
            }
            let node = hit.object;
            while (node && !node.userData.pick) {
                node = node.parent;
            }
            if (!node) {
                continue;
            }
            const data = node.userData.pick;
            const priority = data.priority || 1;
            if (!foundObject || priority > foundPriority) {
                foundObject = node;
                foundData = data;
                foundDistance = hit.distance;
                foundPriority = priority;
                if (priority >= 2) {
                    break;
                }
            }
        }
        if (hovered && (!foundObject || foundObject !== hovered.object)) {
            setHighlight(hovered.object, false);
            hovered = null;
        }
        if (foundObject && (!hovered || hovered.object !== foundObject)) {
            setHighlight(foundObject, true);
            hovered = { object: foundObject, data: foundData, distance: foundDistance, priority: foundPriority };
        }
        return hovered;
    }

    return { register, unregister, detect, getHovered: () => hovered, targetCount: () => targets.length };
}
