import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const materialCache = new Map();
const geometryCache = new Map();

export function mat(color, options = {}) {
    const key = `${color}|${JSON.stringify(options)}`;
    let material = materialCache.get(key);
    if (!material) {
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04, ...options });
        materialCache.set(key, material);
    }
    return material;
}

function cached(key, create) {
    let value = geometryCache.get(key);
    if (!value) {
        value = create();
        geometryCache.set(key, value);
    }
    return value;
}

function place(mesh, position, rotation) {
    if (position) {
        mesh.position.set(position[0], position[1], position[2]);
    }
    if (rotation) {
        mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function box(width, height, depth, material, position, rotation) {
    const geometry = cached(`box|${width}|${height}|${depth}`, () => new THREE.BoxGeometry(width, height, depth));
    return place(new THREE.Mesh(geometry, material), position, rotation);
}

export function cylinder(radiusTop, radiusBottom, height, material, position, rotation, segments = 16) {
    const geometry = cached(`cyl|${radiusTop}|${radiusBottom}|${height}|${segments}`, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
    return place(new THREE.Mesh(geometry, material), position, rotation);
}

export function sphere(radius, material, position, segments = 12) {
    const geometry = cached(`sph|${radius}|${segments}`, () => new THREE.SphereGeometry(radius, segments, Math.max(6, Math.round(segments * 0.6))));
    return place(new THREE.Mesh(geometry, material), position);
}

export function dome(radius, material, position, segments = 14) {
    const geometry = cached(`dome|${radius}|${segments}`, () => new THREE.SphereGeometry(radius, segments, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    return place(new THREE.Mesh(geometry, material), position);
}

export function ico(radius, material, position) {
    const geometry = cached(`ico|${radius}`, () => new THREE.IcosahedronGeometry(radius, 0));
    return place(new THREE.Mesh(geometry, material), position);
}

export function cone(radius, height, material, position, rotation, segments = 8) {
    const geometry = cached(`cone|${radius}|${height}|${segments}`, () => new THREE.ConeGeometry(radius, height, segments));
    return place(new THREE.Mesh(geometry, material), position, rotation);
}

export function plane(width, height, material, position, rotation) {
    const geometry = cached(`plane|${width}|${height}`, () => new THREE.PlaneGeometry(width, height));
    const mesh = new THREE.Mesh(geometry, material);
    if (position) {
        mesh.position.set(position[0], position[1], position[2]);
    }
    if (rotation) {
        mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
    mesh.receiveShadow = true;
    return mesh;
}

// 车削体：给一条 [[半径, 高度], ...] 剖面绕 Y 轴旋转成型（盘子、碗、锅这类器皿都用它）
export function lathe(points, material, segments = 24) {
    const profile = points.map(point => new THREE.Vector2(point[0], point[1]));
    return place(new THREE.Mesh(new THREE.LatheGeometry(profile, segments), material));
}

export function group(children = []) {
    const container = new THREE.Group();
    children.forEach(child => container.add(child));
    return container;
}

export function mergedMesh(geometries, material) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.receiveShadow = true;
    return mesh;
}

// 把一个模型按材质烘成「每种材质一份合并几何体」，用来把同一种食材复制成一堆
// （配合 InstancedMesh 用：改 count 就能少显示几件，不需要重建几何体）
export function bakeModel(model) {
    model.updateMatrixWorld(true);
    const groups = new Map();
    model.traverse(child => {
        if (!child.isMesh) {
            return;
        }
        const material = child.material;
        const key = [
            material.color ? material.color.getHex() : 0,
            material.flatShading ? 1 : 0,
            material.roughness,
            material.metalness,
            material.transparent ? 1 : 0
        ].join('|');
        if (!groups.has(key)) {
            groups.set(key, { material, geometries: [] });
        }
        const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
        groups.get(key).geometries.push(geometry);
    });
    return [...groups.values()].map(group => ({
        geometry: group.geometries.length === 1 ? group.geometries[0] : mergeGeometries(group.geometries),
        material: group.material
    }));
}

export function makeHighlightable(object) {
    object.traverse(child => {
        if (!child.isMesh) {
            return;
        }
        child.material = child.material.clone();
        child.userData.baseEmissive = child.material.emissive.clone();
    });
    return object;
}

export function setHighlight(object, active) {
    object.traverse(child => {
        if (!child.isMesh || !child.userData.baseEmissive) {
            return;
        }
        if (active) {
            child.material.emissive.setHex(0x3a2a10);
            child.material.emissiveIntensity = 1.1;
        } else {
            child.material.emissive.copy(child.userData.baseEmissive);
            child.material.emissiveIntensity = 1;
        }
    });
}
