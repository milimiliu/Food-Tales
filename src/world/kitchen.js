import * as THREE from 'three';
import { mat, box, cylinder, sphere, cone, plane, lathe, mergedMesh } from './palette.js';

// 房间真实尺度：6.2 × 6.4m、层高 2.75m（改前是 8 × 8m、3.2m，走道两米多宽，像大堂）。
// 靠墙的家具整体往里推，走道收到 0.9–1.6m，接近真厨房。
export const ROOM = {
    minX: -3.15,
    maxX: 3.05,
    minZ: -3.0,
    maxZ: 3.4,
    height: 2.75,
    back: 1.0,
    left: 0.85,
    right: -0.75,
    front: -0.6
};

const KITCHEN_BOUNDS = {
    minX: ROOM.minX + 0.28,
    maxX: ROOM.maxX - 0.28,
    minZ: ROOM.minZ + 0.28,
    maxZ: ROOM.maxZ - 0.28
};

const CEILING_HEIGHT = ROOM.height;

const WOOD_DARK = mat(0x9c6b3f, { roughness: 0.85 });
const WOOD = mat(0xc08a52, { roughness: 0.8 });
const WOOD_LIGHT = mat(0xd9a86a, { roughness: 0.75 });
const STONE = mat(0xf1e8da, { roughness: 0.5 });
const WALL = mat(0xfbf2e4, { roughness: 0.95 });
const CEILING = mat(0xfdf7ec, { roughness: 0.95 });
const METAL = mat(0xc4ccd3, { metalness: 0.5, roughness: 0.3 });
const CHROME = mat(0xe2e7ec, { metalness: 0.55, roughness: 0.18 });
const STEEL = mat(0xb9c1c9, { metalness: 0.4, roughness: 0.4 });
const BASIN = mat(0xdde3e8, { metalness: 0.28, roughness: 0.32 });
const DARK = mat(0x34373d, { roughness: 0.6, metalness: 0.25 });
const CERAMIC = mat(0xf7f3ea, { roughness: 0.35 });
const GREY = mat(0xe9eef2, { roughness: 0.45, metalness: 0.15 });
const PLANT = mat(0x6aa948, { roughness: 0.9, flatShading: true });
const GLASS = mat(0xa9dcf5, { emissive: 0x86c9f0, emissiveIntensity: 0.25, roughness: 0.2, transparent: true, opacity: 0.32, depthWrite: false });
const EMPTY_HITBOX = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const PAN = mat(0x33373d, { metalness: 0.55, roughness: 0.42 });
const PAN_INNER = mat(0x4a4f57, { metalness: 0.42, roughness: 0.5 });
const PAN_HANDLE = mat(0x8f6b3f, { roughness: 0.8 });
const FLAME = mat(0xff9a2e, { emissive: 0xff6200, emissiveIntensity: 0.85, roughness: 0.6 });

function plankFloor() {
    const floor = new THREE.Group();
    const centerX = (ROOM.minX + ROOM.maxX) / 2;
    const centerZ = (ROOM.minZ + ROOM.maxZ) / 2;
    const widthX = ROOM.maxX - ROOM.minX;
    const widthZ = ROOM.maxZ - ROOM.minZ;
    floor.add(box(widthX, 0.1, widthZ, mat(0x8d6236, { roughness: 0.9 }), [centerX, -0.05, centerZ]));
    const plankCount = Math.floor(widthX / 1) + 1;
    [0xc9a06a, 0xbe9159].forEach((shade, parity) => {
        const planks = [];
        for (let i = parity; i < plankCount; i += 2) {
            planks.push(new THREE.BoxGeometry(0.98, 0.04, widthZ - 0.1).translate(ROOM.minX + 0.5 + i, 0.02, centerZ));
        }
        floor.add(mergedMesh(planks, mat(shade, { roughness: 0.85 })));
    });
    return floor;
}

function ceilingAndWalls() {
    const shell = new THREE.Group();
    const centerX = (ROOM.minX + ROOM.maxX) / 2;
    const centerZ = (ROOM.minZ + ROOM.maxZ) / 2;
    const widthX = ROOM.maxX - ROOM.minX;
    const widthZ = ROOM.maxZ - ROOM.minZ;
    const add = (width, position, rotation) => {
        const mesh = plane(width, CEILING_HEIGHT, WALL, position, rotation);
        mesh.castShadow = false;
        shell.add(mesh);
    };
    add(widthX, [centerX, CEILING_HEIGHT / 2, ROOM.minZ], [0, 0, 0]);
    add(widthX, [centerX, CEILING_HEIGHT / 2, ROOM.maxZ], [0, Math.PI, 0]);
    add(widthZ, [ROOM.minX, CEILING_HEIGHT / 2, centerZ], [0, Math.PI / 2, 0]);
    add(widthZ, [ROOM.maxX, CEILING_HEIGHT / 2, centerZ], [0, -Math.PI / 2, 0]);

    const ceiling = plane(widthX, widthZ, CEILING, [centerX, CEILING_HEIGHT, centerZ], [Math.PI / 2, 0, 0]);
    ceiling.castShadow = false;
    shell.add(ceiling);

    const trimY = CEILING_HEIGHT - 0.09;
    shell.add(box(widthX, 0.18, 0.08, WOOD_LIGHT, [centerX, trimY, ROOM.minZ + 0.04]));
    shell.add(box(widthX, 0.18, 0.08, WOOD_LIGHT, [centerX, trimY, ROOM.maxZ - 0.04]));
    shell.add(box(0.08, 0.18, widthZ, WOOD_LIGHT, [ROOM.minX + 0.04, trimY, centerZ]));
    shell.add(box(0.08, 0.18, widthZ, WOOD_LIGHT, [ROOM.maxX - 0.04, trimY, centerZ]));
    shell.add(box(widthX, 0.16, 0.1, WOOD_LIGHT, [centerX, 0.08, ROOM.minZ + 0.06]));
    shell.add(box(widthX, 0.16, 0.1, WOOD_LIGHT, [centerX, 0.08, ROOM.maxZ - 0.06]));
    shell.add(box(0.1, 0.16, widthZ, WOOD_LIGHT, [ROOM.minX + 0.06, 0.08, centerZ]));
    shell.add(box(0.1, 0.16, widthZ, WOOD_LIGHT, [ROOM.maxX - 0.06, 0.08, centerZ]));
    return shell;
}

// 窗外的景：一张程序化贴图（天空渐变 + 太阳 + 远山轮廓），贴在窗框里、玻璃后面，
// 房间本身没有在墙上开洞，所以这块板就充当"窗外"。
let outdoorMaterial = null;
function outdoors() {
    if (outdoorMaterial) {
        return outdoorMaterial;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#7fbde8');
    sky.addColorStop(0.55, '#bfe0f2');
    sky.addColorStop(1, '#f4e6cc');
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255, 246, 214, 0.95)';
    context.beginPath();
    context.arc(188, 46, 18, 0, Math.PI * 2);
    context.fill();
    const hills = [
        { y: 132, color: '#8fae86', points: [[0, 132], [42, 104], [86, 130], [128, 96], [176, 128], [216, 108], [256, 134]] },
        { y: 150, color: '#6f9469', points: [[0, 152], [56, 124], [110, 150], [164, 122], [214, 148], [256, 132]] },
        { y: 168, color: '#5b7f5a', points: [[0, 176], [70, 148], [140, 172], [206, 146], [256, 168]] }
    ];
    hills.forEach(hill => {
        context.fillStyle = hill.color;
        context.beginPath();
        context.moveTo(0, canvas.height);
        hill.points.forEach(point => context.lineTo(point[0], point[1]));
        context.lineTo(canvas.width, canvas.height);
        context.closePath();
        context.fill();
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    outdoorMaterial = new THREE.MeshBasicMaterial({ map: texture });
    return outdoorMaterial;
}

function windowOnLeftWall() {
    const frame = new THREE.Group();
    const x = -3.95;
    frame.add(plane(1.24, 0.94, outdoors(), [-3.994, 1.85, 2.2], [0, Math.PI / 2, 0]));
    frame.add(plane(1.24, 0.94, GLASS, [-3.986, 1.85, 2.2], [0, Math.PI / 2, 0]));
    frame.add(box(0.06, 1.06, 0.08, WOOD_LIGHT, [x, 1.85, 1.57]));
    frame.add(box(0.06, 1.06, 0.08, WOOD_LIGHT, [x, 1.85, 2.83]));
    frame.add(box(0.06, 0.08, 1.34, WOOD_LIGHT, [x, 1.34, 2.2]));
    frame.add(box(0.06, 0.08, 1.34, WOOD_LIGHT, [x, 2.36, 2.2]));
    frame.add(box(0.04, 0.9, 0.05, WOOD_LIGHT, [x, 1.85, 2.2]));
    frame.add(box(0.16, 0.05, 1.44, WOOD_LIGHT, [-3.9, 1.31, 2.2]));
    frame.add(box(0.1, 0.04, 1.5, mat(0xf3e6cf, { roughness: 0.7 }), [-3.88, 1.28, 2.2]));
    return frame;
}

function backDoor() {
    const gate = new THREE.Group();
    const x = -2.7;
    gate.add(box(0.1, 2.34, 0.16, WOOD_LIGHT, [x - 0.55, 1.17, 3.86]));
    gate.add(box(0.1, 2.34, 0.16, WOOD_LIGHT, [x + 0.55, 1.17, 3.86]));
    gate.add(box(1.24, 0.14, 0.18, WOOD_LIGHT, [x, 2.35, 3.86]));
    gate.add(box(1, 2.28, 0.07, WOOD, [x, 1.14, 3.84]));
    gate.add(box(0.68, 0.72, 0.03, WOOD_DARK, [x, 1.63, 3.795]));
    gate.add(box(0.68, 0.8, 0.03, WOOD_DARK, [x, 0.68, 3.795]));
    gate.add(cylinder(0.032, 0.032, 0.08, METAL, [x + 0.37, 1.08, 3.79], [Math.PI / 2, 0, 0], 10));
    gate.add(box(0.09, 0.09, 0.02, METAL, [x + 0.37, 1.08, 3.82]));
    gate.add(box(1.24, 0.05, 0.26, WOOD_DARK, [x, 0.025, 3.86]));
    return gate;
}

function collisionAreas() {
    const back = ROOM.back;
    const left = ROOM.left;
    const right = ROOM.right;
    const front = ROOM.front;
    return [
        // -z 墙一侧的橱柜 / 水槽 / 灶台
        { minX: ROOM.minX, maxX: 2.62, minZ: ROOM.minZ, maxZ: -3.3 + back },
        // 冰箱
        { minX: 2.92 + right, maxX: ROOM.maxX, minZ: -2.1, maxZ: -1.05 },
        // -x 墙一侧的左侧操作台
        { minX: ROOM.minX, maxX: -3.25 + left, minZ: -2.35, maxZ: 1.6 },
        // 中岛
        { minX: -1.32, maxX: 1.32, minZ: -0.72, maxZ: 0.72 },
        // 左后墙角的绿植
        { minX: -3.85 + left, maxX: -3.43 + left, minZ: 3.43 + front, maxZ: ROOM.maxZ }
    ];
}

function cabinetRun() {
    const run = new THREE.Group();
    // 水槽往台面中间挪 50cm（原来贴着左后墙角，够不到）
    const SINK_X = -2.6 + 0.5;
    // 柜体分三段：左角柜 A / 水槽柜 B / 主柜 C。台面在 B 处留出与盆同样宽的开口，
    // 三段的宽度与台面开口必须一起算，否则水槽会钻到台面下面、旁边留洞。
    // 三段共用边界（A.max = B.min、B.max = C.min），柜体正面才不会留缝
    const A = { min: -3.99, max: SINK_X - 0.45 };
    const B = { min: SINK_X - 0.45, max: SINK_X + 0.45 };
    const C = { min: SINK_X + 0.45, max: 2.6 };
    const slab = (seg, height, y, depth, z, material) => box(seg.max - seg.min, height, depth, material, [(seg.min + seg.max) / 2, y, z]);

    run.add(slab(A, 0.86, 0.43, 0.62, -3.68, WOOD));
    run.add(slab(B, 0.7, 0.35, 0.62, -3.68, WOOD));
    run.add(slab(B, 0.18, 0.78, 0.05, -3.395, WOOD));
    run.add(slab(C, 0.86, 0.43, 0.62, -3.68, WOOD));

    run.add(slab(A, 0.06, 0.89, 0.7, -3.66, STONE));
    run.add(slab(C, 0.06, 0.89, 0.7, -3.66, STONE));
    run.add(slab(B, 0.06, 0.89, 0.16, -3.93, STONE));
    run.add(slab(B, 0.06, 0.89, 0.07, -3.345, STONE));

    // 柜门避开烤箱立面（烤箱占 x -1.15 ~ 0.75）
    const doors = [
        { x: -3.64, width: 0.68 },
        { x: -2.90, width: 0.68 },
        { x: -1.40, width: 0.46 },
        { x: 1.06, width: 0.56 },
        { x: 1.68, width: 0.56 },
        { x: 2.30, width: 0.56 }
    ];
    doors.forEach(door => {
        run.add(box(door.width, 0.6, 0.04, WOOD_LIGHT, [door.x, 0.46, -3.35]));
        run.add(box(0.22, 0.03, 0.03, METAL, [door.x, 0.68, -3.31]));
    });

    run.add(box(1.9, 0.62, 0.05, DARK, [-0.2, 0.45, -3.345]));
    run.add(box(1.6, 0.34, 0.02, mat(0x1d2a33, { roughness: 0.2, metalness: 0.5 }), [-0.2, 0.42, -3.305]));
    run.add(box(1.5, 0.05, 0.06, METAL, [-0.2, 0.7, -3.29]));
    run.add(box(0.34, 0.05, 0.02, mat(0x0a0a1a, { emissive: 0x1a4fff, emissiveIntensity: 0.4 }), [0.5, 0.42, -3.3]));
    return run;
}

function upperCabinets() {
    const upper = new THREE.Group();
    upper.add(box(2.3, 0.72, 0.36, WOOD_LIGHT, [1.75, 1.92, -3.8]));
    upper.add(box(2.1, 0.02, 0.38, WOOD_DARK, [1.75, 1.56, -3.79]));
    [0.95, 1.7, 2.45].forEach(x => {
        upper.add(box(0.7, 0.62, 0.03, WOOD, [x, 1.92, -3.61]));
        upper.add(box(0.16, 0.025, 0.03, METAL, [x, 1.62, -3.58]));
    });

    const shelfY = 1.72;
    upper.add(box(2.4, 0.08, 0.42, WOOD_DARK, [-2.3, shelfY, -3.79]));
    upper.add(box(0.06, 0.2, 0.3, WOOD_DARK, [-3.3, shelfY - 0.13, -3.85]));
    upper.add(box(0.06, 0.2, 0.3, WOOD_DARK, [-1.3, shelfY - 0.13, -3.85]));

    [0x8fbf6a, 0xd8a15c, 0xc9634f].forEach((color, i) => {
        const x = -2.9 + i * 0.18;
        upper.add(cylinder(0.06, 0.06, 0.16, mat(color, { roughness: 0.5 }), [x, shelfY + 0.12, -3.79], null, 12));
        upper.add(cylinder(0.065, 0.065, 0.02, WOOD_DARK, [x, shelfY + 0.21, -3.79], null, 12));
    });
    return upper;
}

function sink() {
    const station = new THREE.Group();
    const sinkX = -2.6;
    const basinZ = -3.615;

    station.add(box(0.88, 0.03, 0.47, BASIN, [sinkX, 0.72, basinZ]));
    station.add(box(0.03, 0.19, 0.47, BASIN, [sinkX - 0.445, 0.815, basinZ]));
    station.add(box(0.03, 0.19, 0.47, BASIN, [sinkX + 0.445, 0.815, basinZ]));
    station.add(box(0.92, 0.19, 0.03, BASIN, [sinkX, 0.815, -3.835]));
    station.add(box(0.92, 0.19, 0.03, BASIN, [sinkX, 0.815, -3.395]));
    station.add(cylinder(0.035, 0.035, 0.012, mat(0x5c646b, { metalness: 0.7, roughness: 0.4 }), [sinkX, 0.737, basinZ], null, 16));

    station.add(box(0.05, 0.02, 0.5, METAL, [sinkX - 0.46, 0.925, basinZ]));
    station.add(box(0.05, 0.02, 0.5, METAL, [sinkX + 0.46, 0.925, basinZ]));
    station.add(box(0.97, 0.02, 0.05, METAL, [sinkX, 0.925, -3.845]));
    station.add(box(0.97, 0.02, 0.05, METAL, [sinkX, 0.925, -3.385]));

    station.add(cylinder(0.05, 0.055, 0.02, METAL, [sinkX, 0.93, -3.93], null, 18));
    station.add(cylinder(0.018, 0.018, 0.37, CHROME, [sinkX, 1.115, -3.93], null, 14));
    station.add(sphere(0.024, CHROME, [sinkX, 1.3, -3.93], 10));
    station.add(cylinder(0.018, 0.018, 0.2, CHROME, [sinkX, 1.3, -3.83], [Math.PI / 2, 0, 0], 14));
    station.add(sphere(0.024, CHROME, [sinkX, 1.3, -3.73], 10));
    station.add(cylinder(0.016, 0.016, 0.1, CHROME, [sinkX, 1.25, -3.73], null, 14));
    station.add(cylinder(0.014, 0.018, 0.03, STEEL, [sinkX, 1.185, -3.73], null, 12));
    station.add(cylinder(0.026, 0.026, 0.05, CHROME, [sinkX, 1.06, -3.93], null, 12));
    station.add(cylinder(0.013, 0.013, 0.16, CHROME, [sinkX - 0.076, 1.035, -3.93], [0, 0, Math.PI / 2 + 0.32], 12));
    station.add(sphere(0.017, CHROME, [sinkX - 0.152, 1.01, -3.93], 10));

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.6), EMPTY_HITBOX);
    hitbox.position.set(sinkX, 0.9, basinZ);
    station.add(hitbox);

    const bubbles = new THREE.Group();
    bubbles.visible = false;
    [[-0.16, 0.06], [-0.06, -0.08], [0.04, 0.09], [0.14, -0.03], [0.0, 0.02]].forEach((offset, i) => {
        bubbles.add(sphere(0.03 + (i % 3) * 0.008, mat(0xffffff, { transparent: true, opacity: 0.72, roughness: 0.2 }), [sinkX + offset[0], 0.79 + (i % 3) * 0.015, basinZ + offset[1]], 10));
    });
    station.add(bubbles);

    station.userData.sinkStation = { hitbox, bubbles, position: new THREE.Vector3(sinkX, 0.9, basinZ) };
    return station;
}

// 锅的剖面：自锅底轴心向外 → 锅底 → 外壁 → 锅沿 → 内壁 → 内底边缘。
// 原来的锅是一段实心圆柱 + 浮在顶面上 1mm 的圆盘，等于没有内胆；现在内外都车出来，
// 锅内深 4.6cm、锅底半径 13.8cm，食物落在这个底面上。
const PAN_SEGMENTS = 22;
const PAN_FLOOR_Y = -0.030;

const PAN_BODY_PROFILE = [
    [0.000, -0.058],
    [0.118, -0.058],
    [0.146, -0.048],
    [0.168, 0.004],
    [0.176, 0.014],
    [0.177, 0.018],
    [0.172, 0.020],
    [0.169, 0.014],
    [0.150, -0.010],
    [0.138, -0.026]
];

// 锅内底面（由边缘往轴心，法线朝上），外缘与剖面末端重合
const PAN_FLOOR_PROFILE = [
    [0.138, -0.026],
    [0.100, -0.029],
    [0.050, -0.030],
    [0.000, -0.030]
];

function cookPan(x) {
    const pan = new THREE.Group();
    pan.position.set(x, 1.04, -3.66);
    const body = new THREE.Group();
    body.add(lathe(PAN_BODY_PROFILE, PAN, PAN_SEGMENTS));
    body.add(lathe(PAN_FLOOR_PROFILE, PAN_INNER, PAN_SEGMENTS));
    // 手柄从锅外壁接出去（原来伸进锅内 5cm，会在锅底上看到一截木头）
    body.add(box(0.035, 0.022, 0.16, PAN_HANDLE, [0, 0.004, 0.24]));
    pan.add(body);
    pan.userData.body = body;
    return pan;
}

function burnerFlame(x) {
    const flame = new THREE.Group();
    flame.position.set(x, 0.99, -3.66);
    for (let i = 0; i < 12; i += 1) {
        const holder = new THREE.Group();
        holder.rotation.y = -(i / 12) * Math.PI * 2;
        holder.add(cone(0.023, 0.082, FLAME, [0.183, 0.041, 0], [0, 0, -0.18], 6));
        flame.add(holder);
    }
    return flame;
}

function cooktop() {
    const station = new THREE.Group();
    station.add(box(1.5, 0.05, 0.62, DARK, [-0.2, 0.945, -3.66]));
    [-0.6, 0.2].forEach(x => {
        station.add(cylinder(0.17, 0.17, 0.012, mat(0x50555c, { metalness: 0.6, roughness: 0.4 }), [x, 0.975, -3.66], null, 20));
        station.add(cylinder(0.13, 0.13, 0.006, mat(0x2a2d31, { roughness: 0.5 }), [x, 0.982, -3.66], null, 20));
    });
    const panLeft = cookPan(-0.6);
    const panRight = cookPan(0.2);
    const flameLeft = burnerFlame(-0.6);
    flameLeft.visible = false;
    flameLeft.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const flameRight = burnerFlame(0.2);
    flameRight.visible = false;
    flameRight.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const flameLightLeft = new THREE.PointLight(0xff9a3c, 0, 2.3, 2);
    flameLightLeft.position.set(-0.6, 1.06, -3.62);
    const flameLightRight = new THREE.PointLight(0xff9a3c, 0, 2.3, 2);
    flameLightRight.position.set(0.2, 1.06, -3.62);
    station.add(panLeft, panRight, flameLeft, flameRight, flameLightLeft, flameLightRight);
    station.add(box(0.5, 0.04, 0.06, METAL, [-0.2, 1.02, -3.9]));

    const hitboxLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 1.0), EMPTY_HITBOX);
    hitboxLeft.position.set(-0.6, 1.05, -3.5);
    station.add(hitboxLeft);
    const hitboxRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 1.0), EMPTY_HITBOX);
    hitboxRight.position.set(0.2, 1.05, -3.5);
    station.add(hitboxRight);
    station.userData.hitboxLeft = hitboxLeft;
    station.userData.hitboxRight = hitboxRight;
    station.userData.panLeft = panLeft;
    station.userData.panRight = panRight;
    station.userData.flameLeft = flameLeft;
    station.userData.flameRight = flameRight;
    station.userData.flameLightLeft = flameLightLeft;
    station.userData.flameLightRight = flameLightRight;
    return station;
}

function rangeHood() {
    const hood = new THREE.Group();
    hood.add(box(1.3, 0.18, 0.58, METAL, [-0.2, 2.02, -3.7]));
    // 烟道按新的层高收短（2.75m 天花板）
    hood.add(box(0.46, 0.64, 0.4, METAL, [-0.2, 2.43, -3.78]));
    hood.add(box(1.24, 0.03, 0.1, mat(0xfff3d6, { emissive: 0xffe0a0, emissiveIntensity: 0.85 }), [-0.2, 1.93, -3.62]));
    hood.add(box(0.9, 0.05, 0.04, DARK, [-0.2, 1.9, -3.5]));
    return hood;
}

const DOOR_LENGTH = 0.72;
const DOOR_HALF_THICKNESS = 0.03;

function doorBounds(area, pivot) {
    pivot.updateWorldMatrix(true, false);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    [[-DOOR_HALF_THICKNESS, 0], [DOOR_HALF_THICKNESS, 0], [-DOOR_HALF_THICKNESS, DOOR_LENGTH], [DOOR_HALF_THICKNESS, DOOR_LENGTH]].forEach(corner => {
        const point = new THREE.Vector3(corner[0], 0, corner[1]).applyMatrix4(pivot.matrixWorld);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    });
    area.minX = minX - 0.03;
    area.maxX = maxX + 0.03;
    area.minZ = minZ - 0.03;
    area.maxZ = maxZ + 0.03;
    return area;
}

function fridge() {
    const unit = new THREE.Group();
    const centerX = 3.4;
    const centerZ = -1.6;

    unit.add(box(0.72, 0.08, 0.68, mat(0x33373d, { roughness: 0.75 }), [centerX, 0.04, centerZ]));
    unit.add(box(0.8, 0.05, 0.76, GREY, [centerX, 0.105, centerZ]));
    unit.add(box(0.8, 0.06, 0.76, GREY, [centerX, 1.75, centerZ]));
    unit.add(box(0.06, 1.59, 0.76, GREY, [3.77, 0.925, centerZ]));
    unit.add(box(0.74, 1.59, 0.05, GREY, [3.37, 0.925, -1.955]));
    unit.add(box(0.74, 1.59, 0.05, GREY, [3.37, 0.925, -1.245]));
    unit.add(box(0.05, 0.02, 0.7, mat(0xc3cbd2, { roughness: 0.5 }), [3.01, 0.005, centerZ]));

    [0.46, 0.9, 1.34].forEach(y => {
        unit.add(box(0.62, 0.025, 0.64, mat(0xdfe6ea, { roughness: 0.4 }), [3.38, y, centerZ]));
    });
    unit.add(box(0.5, 0.02, 0.5, mat(0xfff6e0, { emissive: 0xffe9bd, emissiveIntensity: 1.1 }), [3.38, 1.7, centerZ]));

    const pivot = new THREE.Group();
    pivot.position.set(3.02, 0.89, -1.955);
    pivot.add(box(0.06, 1.7, 0.72, GREY, [0, 0, 0.36]));
    pivot.add(box(0.03, 0.9, 0.05, METAL, [-0.06, -0.1, 0.64]));
    pivot.add(box(0.02, 0.16, 0.3, mat(0x2a2f36, { emissive: 0x1e6bff, emissiveIntensity: 0.35 }), [-0.035, 0.52, 0.3]));
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.74), EMPTY_HITBOX);
    hitbox.position.set(-0.02, 0, 0.36);
    pivot.add(hitbox);
    unit.add(pivot);
    const doorArea = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    doorBounds(doorArea, pivot);
    unit.userData.doorPivot = pivot;
    unit.userData.doorHitbox = hitbox;
    unit.userData.doorArea = doorArea;
    return unit;
}

function leftCounter() {
    const counter = new THREE.Group();
    // 长度按新的房间收短（原来是 4.81m，会顶到推回来的橱柜）
    counter.add(box(0.62, 0.86, 3.85, WOOD, [-3.68, 0.43, -0.425]));
    counter.add(box(0.68, 0.06, 3.9, STONE, [-3.65, 0.89, -0.4]));
    [-1.9, -1.0, -0.1, 0.9].forEach(z => {
        counter.add(box(0.04, 0.58, 0.86, WOOD_LIGHT, [-3.35, 0.46, z]));
        counter.add(box(0.03, 0.03, 0.2, METAL, [-3.32, 0.7, z]));
    });
    counter.add(box(0.5, 0.07, 0.9, WOOD_DARK, [-3.75, 1.85, -1.4]));
    counter.add(box(0.16, 0.2, 0.06, WOOD_DARK, [-3.92, 1.72, -1.75]));
    counter.add(box(0.16, 0.2, 0.06, WOOD_DARK, [-3.92, 1.72, -1.05]));
    counter.add(cylinder(0.07, 0.07, 0.14, mat(0xd8a15c, { roughness: 0.5 }), [-3.7, 1.96, -1.4], null, 12));
    counter.add(cylinder(0.075, 0.075, 0.02, WOOD_DARK, [-3.7, 2.04, -1.4], null, 12));
    return counter;
}

function island() {
    const bench = new THREE.Group();
    bench.add(box(2.4, 0.86, 1.2, WOOD, [0, 0.43, 0]));
    bench.add(box(2.52, 0.06, 1.32, STONE, [0, 0.89, 0]));
    bench.add(box(2.2, 0.5, 0.04, WOOD_LIGHT, [0, 0.45, -0.59]));

    bench.add(box(0.44, 0.035, 0.32, mat(0xdcb887, { roughness: 0.7 }), [0.6, 0.9375, 0]));

    const knife = new THREE.Group();
    knife.position.set(0.6, 0.955, -0.03);
    knife.rotation.y = Math.PI;
    knife.add(box(0.024, 0.006, 0.16, METAL, [0, 0, -0.11]));
    knife.add(box(0.022, 0.026, 0.09, mat(0x2c2c30, { roughness: 0.5 }), [0, 0.002, -0.005]));
    bench.add(knife);

    // 砧板上的碎屑按食材现切现生成（main.js 的 playChop 往里填对应形状的小件）
    const bits = new THREE.Group();
    bits.visible = false;
    bench.add(bits);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.5), EMPTY_HITBOX);
    hitbox.position.set(0.6, 1.12, 0.04);
    bench.add(hitbox);
    bench.userData.chopStation = { hitbox, knife, bits, position: new THREE.Vector3(0.6, 0.955, 0) };

    bench.add(cylinder(0.09, 0.07, 0.06, CERAMIC, [-1.0, 0.95, 0], null, 16));
    return bench;
}

function plant() {
    const pot = new THREE.Group();
    pot.add(cylinder(0.17, 0.14, 0.26, mat(0xc4703f, { roughness: 0.85 }), [-3.64, 0.13, 3.64], null, 12));
    pot.add(cylinder(0.18, 0.18, 0.03, mat(0xa85c33, { roughness: 0.85 }), [-3.64, 0.275, 3.64], null, 12));
    for (let i = 0; i < 5; i += 1) {
        const angle = (i * Math.PI * 2) / 5;
        const blade = box(0.06, 0.36, 0.02, PLANT, [-3.64 + Math.cos(angle) * 0.05, 0.46, 3.64 + Math.sin(angle) * 0.05], [0, angle, 0.18]);
        pot.add(blade);
    }
    return pot;
}

function lamp() {
    const fixture = new THREE.Group();
    // 吊杆按 2.75m 层高收短
    fixture.add(cylinder(0.012, 0.012, 0.28, mat(0x2c2c30, { roughness: 0.6 }), [0, 2.63, 0], null, 8));
    fixture.add(cylinder(0.16, 0.08, 0.06, mat(0x2c2c30, { roughness: 0.6 }), [0, 2.72, 0], null, 12));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 18, 1, true), mat(0xc4703f, { roughness: 0.7, side: THREE.DoubleSide }));
    shade.position.set(0, 2.6, 0);
    shade.castShadow = false;
    fixture.add(shade);
    fixture.add(cylinder(0.06, 0.06, 0.04, mat(0xfff0cf, { emissive: 0xffd9a0, emissiveIntensity: 1.1 }), [0, 2.5, 0], null, 10));
    fixture.traverse(child => {
        if (child.isMesh) {
            child.castShadow = false;
        }
    });
    return fixture;
}

function lightRig() {
    const rig = new THREE.Group();
    const lamp = new THREE.PointLight(0xffdcae, 46, 24, 1.75);
    lamp.position.set(0, 2.42, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.16;
    lamp.shadow.camera.far = 15;
    lamp.shadow.bias = -0.0012;
    lamp.shadow.normalBias = 0.012;
    lamp.shadow.radius = 2;
    lamp.shadow.intensity = 0.8;
    rig.add(lamp);
    rig.add(new THREE.AmbientLight(0xfff1de, 0.42));
    return rig;
}

export function buildKitchen() {
    const root = new THREE.Group();
    const cooktopStation = cooktop();
    const fridgeUnit = fridge();
    const islandBench = island();
    const sinkStation = sink();
    const cabinet = cabinetRun();
    const uppers = upperCabinets();
    const hood = rangeHood();
    const counter = leftCounter();
    const plantPot = plant();
    const lampFixture = lamp();
    const windowFrame = windowOnLeftWall();
    const gate = backDoor();

    // 靠墙的家具整体往里推（内部坐标不动，只挪整组），房间因此收紧到 6.2 × 6.4m
    cabinet.position.z = ROOM.back;
    uppers.position.z = ROOM.back;
    hood.position.z = ROOM.back;
    sinkStation.position.z = ROOM.back;
    cooktopStation.position.z = ROOM.back;
    counter.position.x = ROOM.left;
    windowFrame.position.x = ROOM.left;
    plantPot.position.x = ROOM.left;
    plantPot.position.z = ROOM.front;
    fridgeUnit.position.x = ROOM.right;
    // 水槽跟着它所在的柜子往中间挪；后门往右挪出一个门洞，既离开墙角、也不被花盆挡住
    sinkStation.position.x = 0.5;
    gate.position.z = ROOM.front;
    gate.position.x = 1.0;

    root.add(
        plankFloor(), ceilingAndWalls(), cabinet, uppers, sinkStation, cooktopStation,
        hood, fridgeUnit, counter, islandBench, plantPot, lampFixture,
        windowFrame, gate, lightRig()
    );

    // 每层两种食材，各自占一块独立区域（同层左右分开、统一贴着货架中线），
    // 区域内按 cols × rows 的规则网格整齐排满；容量 = cols × rows，拿走后会自动补满。
    const shelfX = 3.32 + ROOM.right;
    const ingredientSpots = [
        // 底层（冷藏室底部）
        { ingredientId: 'cabbage', position: new THREE.Vector3(shelfX, 0.08, -1.76), cols: 2, rows: 2 },
        { ingredientId: 'potato', position: new THREE.Vector3(shelfX, 0.08, -1.44), cols: 3, rows: 3 },
        // 第二层
        { ingredientId: 'tomato', position: new THREE.Vector3(shelfX, 0.4725, -1.76), cols: 4, rows: 5 },
        { ingredientId: 'egg', position: new THREE.Vector3(shelfX, 0.4725, -1.44), cols: 5, rows: 5 },
        // 第三层
        { ingredientId: 'carrot', position: new THREE.Vector3(shelfX, 0.9125, -1.76), cols: 5, rows: 2 },
        { ingredientId: 'mushroom', position: new THREE.Vector3(shelfX, 0.9125, -1.44), cols: 5, rows: 4 },
        // 顶层
        { ingredientId: 'beef', position: new THREE.Vector3(shelfX, 1.3525, -1.76), cols: 2, rows: 2 },
        { ingredientId: 'salmon', position: new THREE.Vector3(shelfX, 1.3525, -1.44), cols: 3, rows: 2 }
    ];

    return {
        root,
        ingredientSpots,
        // 下面这些是给 main.js 用的世界坐标，跟着家具位移一起改
        // 盘堆跟着水槽往右让位（水槽右移 50cm 后会顶到一起）
        plateSpot: new THREE.Vector3(-1.32, 0.92, -3.66 + ROOM.back),
        sinkStation: sinkStation.userData.sinkStation,
        sinkSpot: sinkStation.userData.sinkStation.position.clone().setZ(sinkStation.userData.sinkStation.position.z + ROOM.back),
        fridge: {
            pivot: fridgeUnit.userData.doorPivot,
            hitbox: fridgeUnit.userData.doorHitbox,
            area: fridgeUnit.userData.doorArea,
            updateArea: () => doorBounds(fridgeUnit.userData.doorArea, fridgeUnit.userData.doorPivot),
            openAngle: -1.5,
            unit: fridgeUnit
        },
        chopStation: islandBench.userData.chopStation,
        cookStation: {
            position: new THREE.Vector3(-0.2, 0.95, -3.6),
            hitboxLeft: cooktopStation.userData.hitboxLeft,
            hitboxRight: cooktopStation.userData.hitboxRight,
            panLeft: cooktopStation.userData.panLeft,
            panRight: cooktopStation.userData.panRight,
            flameLeft: cooktopStation.userData.flameLeft,
            flameRight: cooktopStation.userData.flameRight,
            flameLightLeft: cooktopStation.userData.flameLightLeft,
            flameLightRight: cooktopStation.userData.flameLightRight,
            // 落位基准 = 锅内底面（锅组在 y=1.04，锅内底在 -0.030）
            foodSpotLeft: new THREE.Vector3(-0.6, 1.04 + PAN_FLOOR_Y, -3.66 + ROOM.back),
            foodSpotRight: new THREE.Vector3(0.2, 1.04 + PAN_FLOOR_Y, -3.66 + ROOM.back)
        },
        bounds: KITCHEN_BOUNDS,
        obstacles: collisionAreas(),
        spawn: { position: new THREE.Vector3(-0.9, 1.62, 1.2), yaw: -0.99 }
    };
}
