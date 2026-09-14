import * as THREE from 'three';
import { mat, cylinder, sphere, ico, group, mergedMesh, makeHighlightable } from './palette.js';
import { createIngredientModel, createIngredientPiece } from './foods.js';

const PLATE_SEGMENTS = 24;
const PLATE_STACK_STEP = 0.016;
// 盘心（凹面）高度：装盘时内容物落在这一层，不再悬空
const PLATE_TOP = 0.0156;

// 剖面自盘底轴心向外：底心 → 圈足 → 盘底 → 盘沿外壁 → 盘沿顶面 → 盘沿内坡
// 盘子按真实尺寸：直径 27cm、盘沿高 2.4cm（改前是 34cm 的大餐盘）
const PLATE_BODY_PROFILE = [
    [0.000, 0.0060],
    [0.049, 0.0060],
    [0.056, 0.0037],
    [0.060, 0.0000],
    [0.075, 0.0000],
    [0.079, 0.0027],
    [0.083, 0.0060],
    [0.110, 0.0065],
    [0.119, 0.0084],
    [0.129, 0.0156],
    [0.135, 0.0213],
    [0.135, 0.0229],
    [0.133, 0.0238],
    [0.121, 0.0238],
    [0.114, 0.0221],
    [0.110, 0.0195],
    [0.107, 0.0172]
];

// 盘心凹面（由边缘往轴心走，法线朝上），外缘与剖面末端重合，接缝齐平
const PLATE_WELL_PROFILE = [
    [0.107, 0.0172],
    [0.094, 0.0162],
    [0.071, 0.0157],
    [0.040, 0.0156],
    [0.000, 0.0156]
];

function latheGeometry(profile) {
    return new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(point[0], point[1])), PLATE_SEGMENTS);
}

const PLATE_BODY_GEOMETRY = latheGeometry(PLATE_BODY_PROFILE);
const PLATE_WELL_GEOMETRY = latheGeometry(PLATE_WELL_PROFILE);

function latheMesh(geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

const PLATE = mat(0xf7f3ea, { roughness: 0.34 });
const PLATE_INNER = mat(0xece5d8, { roughness: 0.42 });
const DIRT = mat(0x9a7b52, { flatShading: true, roughness: 0.9 });

function plateParts() {
    return [
        latheMesh(PLATE_BODY_GEOMETRY, PLATE),
        latheMesh(PLATE_WELL_GEOMETRY, PLATE_INNER)
    ];
}

// 碗的剖面：口径 18cm、深 8cm、带圈足——和盘子一样用 LatheGeometry 车出来，
// 汤面放在口沿下方约 1.8cm，正常俯角（坐着吃饭 40° 上下）能看到碗里的东西。
const BOWL_FLOOR_Y = 0.020;
const BOWL_SURFACE_Y = 0.062;

// 剖面自碗底轴心向外：底心 → 圈足 → 碗壁外 → 口沿 → 碗壁内 → 内底边缘
const BOWL_BODY_PROFILE = [
    [0.000, 0.004],
    [0.038, 0.004],
    [0.048, 0.000],
    [0.053, 0.006],
    [0.058, 0.018],
    [0.075, 0.048],
    [0.086, 0.070],
    [0.090, 0.078],
    [0.086, 0.080],
    [0.082, 0.074],
    [0.070, 0.048],
    [0.058, 0.028],
    [0.050, 0.022]
];

// 碗内底面（由边缘往轴心，法线朝上）
const BOWL_FLOOR_PROFILE = [
    [0.050, 0.022],
    [0.028, 0.0205],
    [0.000, 0.020]
];

const BOWL_BODY_GEOMETRY = latheGeometry(BOWL_BODY_PROFILE);
const BOWL_FLOOR_GEOMETRY = latheGeometry(BOWL_FLOOR_PROFILE);

function bowlParts() {
    return [
        latheMesh(BOWL_BODY_GEOMETRY, PLATE),
        latheMesh(BOWL_FLOOR_GEOMETRY, PLATE_INNER)
    ];
}

// 摆一块切好的食材：[x, 相对基准的高度, z, 朝向]
function scatter(id, spots, baseY) {
    return spots.map((spot, index) => {
        const piece = createIngredientPiece(id, index);
        piece.position.set(spot[0], baseY + spot[1], spot[2]);
        piece.rotation.y = spot[3];
        return piece;
    });
}

const CONTENTS = {
    // 番茄炒蛋：番茄楔块 + 滑蛋块，堆在盘心（都是玩家切出来的那种大小）
    tomato_egg() {
        const curds = [[-0.028, 0.013, -0.012, 0.4], [0.020, 0.015, 0.022, 1.2], [0.042, 0.013, -0.004, 2.1], [-0.002, 0.031, 0.006, 0.8], [0.020, 0.043, -0.014, 1.7]]
            .map(([x, y, z, spin]) => {
                const curd = ico(0.018, mat(0xf2c14e, { flatShading: true }), [x, y, z]);
                curd.scale.set(1, 0.72, 0.95);
                curd.rotation.y = spin;
                return curd;
            });
        return [
            ...scatter('tomato', [
                [-0.042, 0, 0.016, 0.5],
                [0.034, 0, -0.018, 1.2],
                [0.004, 0, 0.036, 0.2],
                [-0.014, 0.017, -0.010, 0.9]
            ], 0),
            ...curds
        ];
    },

    // 时蔬沙拉：碗里拌卷心菜丝 + 胡萝卜片 + 番茄块（干的，没有汤汁）
    veg_salad() {
        return [
            ...bowlParts(),
            ...scatter('cabbage', [
                [-0.030, 0.002, 0.022, 0.4],
                [0.030, 0.002, -0.014, 1.1],
                [0.002, 0.002, 0.032, 0.8],
                [-0.036, 0.012, -0.020, 0.2],
                [0.022, 0.014, 0.018, 1.5],
                [0.004, 0.026, -0.006, 0.6]
            ], BOWL_FLOOR_Y),
            ...scatter('carrot', [
                [-0.020, 0.004, -0.028, 0.3],
                [0.032, 0.006, 0.024, 1.0],
                [0.000, 0.028, 0.014, 1.7]
            ], BOWL_FLOOR_Y),
            ...scatter('tomato', [
                [-0.030, 0.016, 0.010, 0.7],
                [0.026, 0.030, -0.006, 1.3],
                [0.006, 0.040, 0.012, 0.1]
            ], BOWL_FLOOR_Y)
        ];
    },

    // 蘑菇煎牛肉：整块牛排 + 旁边几片蘑菇（不再半埋在肉里）
    mushroom_beef() {
        const steak = createIngredientModel('beef');
        steak.position.set(0, 0, -0.024);
        steak.rotation.y = 0.12;
        return [
            steak,
            ...scatter('mushroom', [
                [-0.046, 0, 0.074, 0.3],
                [0.000, 0, 0.080, 0.9],
                [0.046, 0, 0.070, 1.5],
                [-0.020, 0.0055, 0.052, 0.5],
                [0.030, 0.0055, 0.048, 1.2]
            ], 0)
        ];
    },

    // 土豆浓汤：碗里奶白汤面 + 几粒土豆/胡萝卜小料浮在面上
    potato_soup() {
        return [
            ...bowlParts(),
            cylinder(0.0755, 0.0755, 0.006, mat(0xf3e2b4, { roughness: 0.3 }), [0, BOWL_SURFACE_Y, 0], null, 22),
            ...[[-0.032, 0.020, 0.4], [0.028, -0.018, 1.2], [0.006, 0.036, 2.2]].map(([x, z, spin]) => {
                const bit = ico(0.009, mat(0xe8d09a, { flatShading: true }), [x, BOWL_SURFACE_Y + 0.007, z]);
                bit.scale.set(1.1, 0.5, 1.1);
                bit.rotation.y = spin;
                return bit;
            })
        ];
    },

    // 香煎三文鱼配土豆：楔形鱼排 + 前面两球土豆泥（原来坐标写错，一颗飞到了盘外）
    salmon_potato() {
        const fish = createIngredientModel('salmon');
        fish.position.set(-0.004, 0, -0.02);
        const mash = [[-0.050, 0.046], [0.048, 0.049]].map(([x, z], index) => {
            const ball = sphere(0.022, mat(0xf5ead4, { flatShading: true }), [x, 0.017, z], 10);
            ball.scale.set(1, 0.78, 0.95);
            ball.rotation.y = index * 0.9;
            return ball;
        });
        return [fish, ...mash];
    },

    // 田园炖菜：碗里清汤 + 土豆丁、蘑菇片、卷心菜丝半露在汤面上
    garden_stew() {
        return [
            ...bowlParts(),
            cylinder(0.075, 0.075, 0.006, mat(0xd8a86a, { roughness: 0.35 }), [0, BOWL_SURFACE_Y, 0], null, 22),
            ...scatter('potato', [
                [-0.024, 0.004, 0.020, 0.5],
                [0.030, 0.004, -0.012, 1.3],
                [0.000, 0.016, 0.028, 0.9]
            ], BOWL_SURFACE_Y),
            ...scatter('mushroom', [
                [-0.032, 0.006, -0.014, 0.4],
                [0.020, 0.008, 0.026, 1.6]
            ], BOWL_SURFACE_Y),
            ...scatter('cabbage', [
                [0.006, 0.012, -0.026, 1.1],
                [-0.010, 0.024, 0.004, 0.3]
            ], BOWL_SURFACE_Y)
        ];
    }
};

function contentGroup(recipeId) {
    const holder = new THREE.Group();
    const content = CONTENTS[recipeId];
    if (content) {
        content().forEach(child => holder.add(child));
    }
    return holder;
}

// 把整组内容物落到指定高度的面上：装盘时是盘心凹面，锅里是锅底
function restOn(holder, floorY) {
    if (holder.children.length === 0) {
        return;
    }
    holder.position.y = 0;
    holder.updateWorldMatrix(false, true);
    const bounds = new THREE.Box3().setFromObject(holder);
    holder.position.y = floorY - bounds.min.y;
}

const DIRT_SPOTS = [[-0.044, 0.024], [0.024, -0.036], [0.044, 0.040], [-0.016, -0.040]];
// 与旧模型保持一致：污点略高于盘面、下半截埋进盘体，看上去是抹开的痕迹而不是颗粒
const DIRT_LIFT = [-0.0016, 0.0016, -0.0032, 0];

export function createPlateModel(dirty = false) {
    const container = group(plateParts());
    if (dirty) {
        DIRT_SPOTS.forEach((spot, index) => {
            const smear = ico(0.026, DIRT, [spot[0], PLATE_TOP + DIRT_LIFT[index], spot[1]]);
            smear.scale.set(1.5, 0.22, 1.1);
            container.add(smear);
        });
    }
    container.userData.dirty = dirty;
    return makeHighlightable(container);
}

export function createPlateStackModel(count) {
    const container = group();
    if (count <= 0) {
        return container;
    }
    const bodies = [];
    const wells = [];
    for (let i = 0; i < count; i += 1) {
        const y = i * PLATE_STACK_STEP;
        bodies.push(PLATE_BODY_GEOMETRY.clone().translate(0, y, 0));
        wells.push(PLATE_WELL_GEOMETRY.clone().translate(0, y, 0));
    }
    const body = mergedMesh(bodies, PLATE);
    body.castShadow = true;
    const well = mergedMesh(wells, PLATE_INNER);
    well.castShadow = true;
    container.add(body, well);
    return container;
}

export function createFoodModel(recipeId) {
    const container = contentGroup(recipeId);
    restOn(container, 0);
    container.userData.recipeId = recipeId;
    return makeHighlightable(container);
}

export function createDishModel(recipeId) {
    const container = group(plateParts());
    const content = contentGroup(recipeId);
    restOn(content, PLATE_TOP);
    container.add(content);
    container.userData.recipeId = recipeId;
    return makeHighlightable(container);
}
