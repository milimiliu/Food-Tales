import * as THREE from 'three';
import { mat, box } from './palette.js';

const TABLE_TOP = 0.78;
// 餐桌位置：两端各有一把椅子，之前 x=1.4 时右侧椅背离 +x 墙只有 1cm（看上去像穿墙）。
// 现在把整张桌子往房间中间挪到 x=1.0、z=2.7，右侧椅背离墙约 40cm。
const TABLE_CENTER = { x: 1.0, z: 2.7 };

const WOOD = mat(0xb0763f, { roughness: 0.78 });
const WOOD_DARK = mat(0x8d5c30, { roughness: 0.82 });
const CLOTH = mat(0xe3d3b6, { roughness: 0.95 });

function chair(x, z, rotation) {
    const unit = new THREE.Group();
    unit.add(box(0.42, 0.06, 0.42, WOOD, [0, 0.44, 0]));
    unit.add(box(0.42, 0.5, 0.06, WOOD, [0, 0.72, -0.19]));
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(offset => {
        unit.add(box(0.05, 0.44, 0.05, WOOD_DARK, [offset[0], 0.22, offset[1]]));
    });
    unit.add(box(0.38, 0.04, 0.3, CLOTH, [0, 0.49, 0]));
    unit.position.set(x, 0, z);
    unit.rotation.y = rotation;
    return unit;
}

export function buildTable() {
    const root = new THREE.Group();
    const cx = TABLE_CENTER.x;
    const cz = TABLE_CENTER.z;

    root.add(box(2.2, 0.08, 1.0, WOOD, [cx, TABLE_TOP - 0.04, cz]));
    root.add(box(2.02, 0.07, 0.84, WOOD_DARK, [cx, 0.665, cz]));
    [cx - 0.96, cx + 0.96].forEach(x => {
        [cz - 0.4, cz + 0.4].forEach(z => {
            root.add(box(0.09, 0.7, 0.09, WOOD_DARK, [x, 0.35, z]));
        });
    });

    root.add(chair(cx - 0.65, cz - 0.92, 0));
    root.add(chair(cx + 0.65, cz - 0.92, 0));
    root.add(chair(cx - 1.42, cz, Math.PI / 2));
    root.add(chair(cx + 1.42, cz, -Math.PI / 2));

    const slots = [-0.75, -0.25, 0.25, 0.75].map(offset => new THREE.Vector3(cx + offset, TABLE_TOP, cz));

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.006, 1.0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hitbox.position.set(cx, TABLE_TOP + 0.004, cz);
    root.add(hitbox);

    return {
        root,
        slots,
        hitbox,
        obstacles: [{ minX: cx - 1.45, maxX: cx + 1.45, minZ: cz - 1.2, maxZ: cz + 0.58 }]
    };
}
