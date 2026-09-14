import * as THREE from 'three';
import { mat, box, cylinder, sphere, cone, dome, group, bakeModel, makeHighlightable } from './palette.js';
import { ingredient } from '../data/ingredients.js';

const FLAT = { flatShading: true };
const LEAF = 0x5f8a3a;
const EYE = 0x8a6238;

function leafRing(count, radius, color, y, thickness = 0.0035) {
    const ring = new THREE.Group();
    for (let i = 0; i < count; i += 1) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i * Math.PI * 2) / count;
        pivot.add(box(radius, thickness, radius * 0.42, mat(color, FLAT), [radius * 0.55, y, 0]));
        ring.add(pivot);
    }
    return ring;
}

// 椭球表面取点：给土豆的芽眼和小凸起定位，避免埋进模型里看不见
function surfacePoint(center, radii, thetaDeg, phiDeg, shrink = 1) {
    const theta = THREE.MathUtils.degToRad(thetaDeg);
    const phi = THREE.MathUtils.degToRad(phiDeg);
    return [
        center[0] + radii[0] * shrink * Math.sin(theta) * Math.cos(phi),
        center[1] + radii[1] * shrink * Math.cos(theta),
        center[2] + radii[2] * shrink * Math.sin(theta) * Math.sin(phi)
    ];
}

// 三棱柱：低多边形里做「楔形」的最好用基本体（三角面的圆柱），用来做三文鱼排和番茄块
function wedge(radius, length, material, position) {
    return cylinder(radius, radius, length, material, position, [-Math.PI / 2, 0, Math.PI / 2], 3);
}

const BUILDERS = {
    // 番茄：直径 7cm、高 6.5cm 的扁球，顶部五瓣萼片
    tomato() {
        const body = sphere(0.035, mat(0xe0463a, FLAT), [0, 0.032, 0], 12);
        body.scale.set(1, 0.9, 1);
        const stem = cylinder(0.0035, 0.005, 0.014, mat(LEAF, FLAT), [0, 0.063, 0], null, 6);
        return group([body, stem, leafRing(5, 0.021, LEAF, 0.06)]);
    },

    // 鸡蛋：4.4 × 5.8cm，暖白色蛋壳
    egg() {
        const body = sphere(0.022, mat(0xf7e9cf, { flatShading: true, roughness: 0.55 }), [0, 0.029, 0], 12);
        body.scale.set(1, 1.32, 1);
        body.rotation.z = 0.1;
        return group([body]);
    },

    // 土豆：10 × 7 × 8cm 的扁椭圆，带明显芽眼和小凸起（不再是一块棱角分明的石头）
    potato() {
        const center = [0, 0.036, 0];
        const radii = [0.05, 0.036, 0.041];
        const body = sphere(0.05, mat(0xc69a5c, FLAT), center, 12);
        body.scale.set(1, 0.72, 0.82);
        const eyes = [[58, 18], [74, 140], [102, 250], [44, 300], [116, 58]].map(([theta, phi]) => {
            const eye = sphere(0.006, mat(EYE, FLAT), surfacePoint(center, radii, theta, phi, 0.97), 6);
            eye.scale.set(1, 0.55, 1);
            return eye;
        });
        const bumps = [[38, 95], [128, 210]].map(([theta, phi]) => sphere(0.013, mat(0xc69a5c, FLAT), surfacePoint(center, radii, theta, phi, 0.86), 6));
        return group([body, ...eyes, ...bumps]);
    },

    // 胡萝卜：平放，长 15cm、根部直径 2.4cm，顶端三片锥形叶
    carrot() {
        const body = cylinder(0.012, 0.0022, 0.15, mat(0xe8823a, FLAT), [0, 0.012, 0], [0, 0, Math.PI / 2], 10);
        const greens = [
            cone(0.0055, 0.05, mat(LEAF, FLAT), [-0.101, 0.019, -0.008], [0, 0.3, Math.PI / 2 + 0.4], 5),
            cone(0.0055, 0.06, mat(LEAF, FLAT), [-0.104, 0.019, 0.001], [0, 0.05, Math.PI / 2 + 0.12], 5),
            cone(0.0055, 0.045, mat(LEAF, FLAT), [-0.099, 0.018, 0.009], [0, -0.25, Math.PI / 2 + 0.5], 5)
        ];
        return group([body, ...greens]);
    },

    // 卷心菜：直径 17cm、高 11cm 的抱心球
    cabbage() {
        const core = sphere(0.062, mat(0xa8d47a, FLAT), [0, 0.058, 0], 12);
        core.scale.set(1, 0.82, 1);
        const wrap = [0, 1, 2, 3].map(i => {
            const angle = (i * Math.PI) / 2;
            const leaf = sphere(0.066, mat(i % 2 ? 0x7fbf5a : 0x6aa948, FLAT), [Math.cos(angle) * 0.02, 0.05, Math.sin(angle) * 0.02], 9);
            leaf.scale.set(1, 0.66, 1);
            return leaf;
        });
        return group([core, ...wrap]);
    },

    // 蘑菇：伞盖 5cm、总高 5cm，白点压扁成伞面上的斑点
    mushroom() {
        const stem = cylinder(0.008, 0.011, 0.032, mat(0xefe0c8, FLAT), [0, 0.016, 0], null, 10);
        const cap = dome(0.026, mat(0xb08a63, FLAT), [0, 0.03, 0], 10);
        cap.scale.set(1, 0.78, 1);
        const spots = [[-0.012, 0.045, 0.007], [0.011, 0.043, -0.009], [0.001, 0.048, 0.014]].map(p => {
            const dot = sphere(0.0045, mat(0xe6d3b8, FLAT), p, 6);
            dot.scale.set(1, 0.45, 1);
            return dot;
        });
        return group([stem, cap, ...spots]);
    },

    // 牛排：16 × 12 × 3cm，一条脂肪边贴着实肉的侧边，表面是浅色大理石纹
    beef() {
        const slab = box(0.155, 0.028, 0.115, mat(0xb4453c, FLAT), [0, 0.015, 0]);
        const fat = box(0.152, 0.03, 0.014, mat(0xefe0cf, FLAT), [0, 0.016, -0.058]);
        const marble = [-0.028, 0, 0.028].map((z, i) => box(0.125 - i * 0.015, 0.004, 0.009, mat(0xd98a86, FLAT), [i * 0.006, 0.0275, z]));
        return group([slab, fat, ...marble]);
    },

    // 三文鱼：14 × 8 × 3cm 的楔形鱼排（一侧厚一侧薄），底面鱼皮、表面白色脂肪纹
    salmon() {
        const holder = new THREE.Group();
        const flesh = wedge(0.03, 0.145, mat(0xf08a5d, FLAT), [0, 0.015, 0]);
        const skin = box(0.145, 0.005, 0.05, mat(0x8d8d96, FLAT), [0, 0.0025, 0]);
        const strips = [[-0.01, 0.0277], [0.002, 0.0415], [0.012, 0.0243]].map(([z, y], i) => box(
            0.128 - i * 0.012,
            0.005,
            0.007,
            mat(0xf8cbb2, FLAT),
            [i * 0.004, y, z]
        ));
        holder.add(flesh, skin, ...strips);
        holder.scale.set(1, 0.72, 1.5);
        return holder;
    }
};

// 切好后的形态按食材分四种：圆片（胡萝卜、蘑菇）、楔块（番茄）、细丝（卷心菜）、丁（土豆、牛肉、三文鱼）
const CHOP_STYLE = {
    tomato: 'wedges',
    potato: 'cubes',
    carrot: 'slices',
    cabbage: 'strips',
    mushroom: 'slices',
    beef: 'cubes',
    salmon: 'cubes',
    egg: 'cubes'
};

// 每种形态的「堆叠层高」，做碎料堆和摆盘时共用
const LAYER_STEP = {
    slices: 0.005,
    strips: 0.0062,
    wedges: 0.006,
    cubes: 0.0125
};

// 每块碎料的位置 / 朝向 / 堆叠层，三种形态共用，保证都是「一小撮」而不是摊开一片
const PILE_SPOTS = [
    [-0.014, 0.010, 0.4, 0],
    [0.013, -0.011, 1.1, 0],
    [0.015, 0.013, 0.2, 0],
    [-0.016, -0.012, 0.9, 0],
    [0.001, 0.002, 1.6, 1],
    [-0.009, -0.014, 0.6, 1],
    [0.012, 0.011, 1.3, 2]
];

// 单块切好的食材：坐在 y=0 上，供碎料堆和菜品摆盘复用（番茄=楔块、胡萝卜/蘑菇=圆片、卷心菜=细丝、其余=丁）
export function createIngredientPiece(id, index = 0) {
    const item = ingredient(id);
    const base = new THREE.Color(item ? item.color : '#cccccc');
    const pale = base.clone().lerp(new THREE.Color(0xffffff), 0.32).getHex();
    const material = mat(index % 2 ? pale : base.getHex(), FLAT);
    const style = CHOP_STYLE[id] || 'cubes';
    if (style === 'slices') {
        return cylinder(0.0155, 0.0155, 0.0045, material, [0, 0.0022, 0], null, 10);
    }
    if (style === 'strips') {
        return box(0.038, 0.006, 0.008, material, [0, 0.003, 0]);
    }
    if (style === 'wedges') {
        const holder = new THREE.Group();
        holder.add(wedge(0.011, 0.017, material, [0, 0.0055, 0]));
        return holder;
    }
    return box(0.0135, 0.013, 0.0135, material, [0, 0.0065, 0]);
}

function choppedPile(id) {
    const step = LAYER_STEP[CHOP_STYLE[id]] || LAYER_STEP.cubes;
    const pieces = PILE_SPOTS.map((spot, index) => {
        const [x, z, spin, layer] = spot;
        const piece = createIngredientPiece(id, index);
        piece.position.set(x, layer * step, z);
        piece.rotation.y = spin;
        return piece;
    });

    return group(pieces);
}

export function createIngredientModel(id, chopped = false) {
    const builder = BUILDERS[id];
    const model = chopped
        ? choppedPile(id)
        : (builder ? builder() : group([sphere(0.035, mat(0xcccccc, FLAT), [0, 0.035, 0], 10)]));
    model.userData.ingredientId = id;
    model.userData.chopped = chopped;
    return makeHighlightable(model);
}

// 冰箱里的一堆同种食材：单件模型按材质烘成合并几何体后，用 InstancedMesh 复制成堆。
// 每堆按 cols × rows 的规则网格在国内整齐排开（奇数行错半格），朝向统一；改 count 就能
// 少显示几件，几何体一次建好，拿取和补货都不重建。
export function createIngredientPile(id, plan) {
    const unit = createIngredientModel(id);
    const baked = bakeModel(unit);
    const size = new THREE.Box3().setFromObject(unit).getSize(new THREE.Vector3());
    const cols = Math.max(1, plan.cols);
    const rows = Math.max(1, plan.rows);
    const count = cols * rows;
    const stepZ = Math.max(size.z * 1.06, 0.05);
    const stepX = Math.max(size.x * 1.06, 0.05);
    const yaw = plan.yaw || 0;
    const pile = new THREE.Group();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler();

    baked.forEach(entry => {
        const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, count);
        for (let i = 0; i < count; i += 1) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            position.set(
                (row - (rows - 1) / 2) * stepX,
                0,
                (col - (cols - 1) / 2) * stepZ + (row % 2 ? stepZ * 0.5 : 0)
            );
            euler.set(0, yaw, 0);
            quaternion.setFromEuler(euler);
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pile.add(mesh);
    });

    pile.userData.unitSize = size;
    pile.userData.capacity = count;
    return makeHighlightable(pile);
}
