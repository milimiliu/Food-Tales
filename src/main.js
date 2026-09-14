import * as THREE from 'three';
import { buildKitchen, ROOM } from './world/kitchen.js';
import { buildTable } from './world/table.js';
import { createMenuBoard } from './world/board.js';
import { createIngredientModel, createIngredientPiece, createIngredientPile } from './world/foods.js';
import { createPlateModel, createPlateStackModel, createFoodModel, createDishModel } from './world/dishes.js';
import { ingredient, needsChopping } from './data/ingredients.js';
import { recipe } from './data/recipes.js';
import { EXP_RULES, levelRow, unlockLevelOf } from './data/levels.js';
import { createControls } from './core/controls.js';
import { createPicker } from './core/picker.js';
import { arcTo, tween, tweenCount, updateTweens } from './core/tween.js';
import { isMuted, resumeAudio, sfx, toggleMute } from './core/audio.js';
import { createFx } from './core/fx.js';
import { cook } from './game/cooking.js';
import {
    TRAY_SIZE,
    addExp,
    bagAdd,
    bagCount,
    bagHasRoom,
    breakStreak,
    completeDaily,
    countServe,
    countWash,
    dailyAllDone,
    dailyDay,
    ensureDaily,
    isUnlocked,
    levelInfo,
    markChopped,
    markEaten,
    pushStreak,
    resetProgress,
    restore,
    rollDaily,
    returnPlateToStack,
    selectSlot,
    setHand,
    setStars,
    state,
    subscribe,
    takeSlot,
    takePlateFromStack,
    unlockRecipe
} from './game/state.js';
import { createHud } from './ui/hud.js';
import { createOverlays } from './ui/overlays.js';

const PICK_DISTANCE = 3.6;
const DOOR_SPEED = 3.6;
const CHOP_STEPS = 3;
const EAT_TIME = 1.7;
const WASH_TIME = 1.5;
const HOT_WINDOW = 28000;

const HAND_BASE = new THREE.Vector3(0.32, -0.24, -0.62);
const HAND_SCALE = 0.6;
// 食材模型按真实尺寸建模（番茄 7cm、胡萝卜 20cm…），手上/锅里用放大系数把它拉回可读的大小
// 手上的大小按模型自身尺寸归一化：小的放大、长条（胡萝卜）收一点，避免顶出画面
const HAND_INGREDIENT_TARGET = 0.12;
const HAND_INGREDIENT_MIN = 0.75;
const HAND_INGREDIENT_MAX = 1.6;
const POT_DROP_SCALE = 1.0;
const POT_REST_SCALE = 0.85;

function handScaleFor(model) {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (!(longest > 0)) {
        return 1;
    }
    return THREE.MathUtils.clamp(HAND_INGREDIENT_TARGET / longest, HAND_INGREDIENT_MIN, HAND_INGREDIENT_MAX);
}

const canvas = document.getElementById('game-canvas');
const BASE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);
function createRenderer() {
    const antialias = (window.devicePixelRatio || 1) <= 1.25;
    try {
        return new THREE.WebGLRenderer({ canvas, antialias });
    } catch (error) {
        return new THREE.WebGLRenderer({ canvas, antialias: false });
    }
}

const renderer = createRenderer();
canvas.addEventListener('webglcontextlost', () => {
    if (typeof window.showFatal === 'function') {
        window.showFatal('显卡上下文丢失，画面会尝试自动恢复；若一直黑屏，请按 Ctrl+Shift+R 强制刷新（多开同一个游戏页面容易触发）。');
    }
});
renderer.setPixelRatio(BASE_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const SHADOW_INTERVAL = 100;
const RES_SCALE_MIN = 0.55;
let renderScale = 1;
let frameAvgMs = 16.7;
let refreshMs = 16.7;
let slowStreak = 0;
let settleFrames = 60;
let scaleCooldown = 0;
let lastShadowAt = 0;

function applyRenderScale() {
    renderer.setPixelRatio(BASE_PIXEL_RATIO * renderScale);
}

function adaptResolution(rawDelta) {
    const frameMs = Math.min(rawDelta * 1000, 120);
    frameAvgMs += (frameMs - frameAvgMs) * 0.1;
    refreshMs = Math.max(4, Math.min(40, refreshMs + (frameMs - refreshMs) * (frameMs < refreshMs ? 0.25 : 0.002)));
    if (settleFrames > 0) {
        settleFrames -= 1;
        slowStreak = 0;
        return;
    }
    slowStreak = frameAvgMs > refreshMs * 1.3 ? slowStreak + 1 : 0;
    scaleCooldown -= rawDelta;
    if (scaleCooldown > 0) {
        return;
    }
    if (slowStreak > 20 && renderScale > RES_SCALE_MIN) {
        renderScale = Math.max(RES_SCALE_MIN, renderScale - 0.1);
        applyRenderScale();
        scaleCooldown = 0.5;
        slowStreak = 0;
        frameAvgMs = refreshMs;
    } else if (frameAvgMs < refreshMs * 1.03 && renderScale < 1) {
        renderScale = Math.min(1, renderScale + 0.08);
        applyRenderScale();
        scaleCooldown = 1.2;
    }
}

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.06, 60);
camera.rotation.order = 'YXZ';

const kitchen = buildKitchen();
const table = buildTable();
kitchen.root.add(table.root);

const menuBoard = createMenuBoard();
menuBoard.root.position.set(-3.94 + ROOM.left, 1.62, 0.75);
menuBoard.root.rotation.y = Math.PI / 2;
kitchen.root.add(menuBoard.root);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe4f5);
scene.add(kitchen.root, camera);

const picker = createPicker(camera, PICK_DISTANCE);
const controls = createControls(camera, canvas, kitchen.bounds);
const fx = createFx(scene, camera);

const TABLE_SLOTS = table.slots;
const PAN_SLOT_LEFT = kitchen.cookStation.foodSpotLeft.clone();
const PAN_SLOT_RIGHT = kitchen.cookStation.foodSpotRight.clone();

const fridge = kitchen.fridge;
const chopStation = kitchen.chopStation;
const knifeBaseY = chopStation.knife.position.y;
const chopAnim = { time: -1 };
const chopWork = { key: null, steps: 0 };
const emptyHitbox = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

let fridgeOpen = false;

const handAnchor = new THREE.Group();
handAnchor.position.copy(HAND_BASE);
handAnchor.rotation.x = 0.38;
camera.add(handAnchor);

const handMotion = { punch: 0, bob: 0, sway: 0 };
let handModel = null;
let handKey = '';

const plateStackGroup = new THREE.Group();
plateStackGroup.position.copy(kitchen.plateSpot);
kitchen.root.add(plateStackGroup);

const plateHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), emptyHitbox);
plateHitbox.position.set(kitchen.plateSpot.x, kitchen.plateSpot.y + 0.13, kitchen.plateSpot.z);
kitchen.root.add(plateHitbox);

const spots = kitchen.ingredientSpots.map((spot, index) => {
    const capacity = spot.cols * spot.rows;
    const pile = createIngredientPile(spot.ingredientId, { cols: spot.cols, rows: spot.rows });
    pile.position.copy(spot.position);
    kitchen.root.add(pile);
    picker.register(pile, { kind: 'ingredient', spotIndex: index });
    return {
        spot,
        pile,
        capacity,
        count: capacity,
        // 大堆补得密一些，整堆补满的时间都在 15 秒上下
        refillStep: Math.max(700, 7000 / capacity),
        readyAt: 0
    };
});

// 拿掉 / 补回一件：InstancedMesh 只改实例数量，几何体建一次就够
function applyPileCount(entry) {
    entry.pile.children.forEach(mesh => {
        if (mesh.isInstancedMesh) {
            mesh.count = entry.count;
        }
    });
}

const items = [];
let nextItemId = 1;
let stackKey = -1;
let boardKey = '';

const lockTip = document.getElementById('lock-tip');
const touchDevice = window.matchMedia('(hover: none)').matches;
let playing = false;
let lockWorked = false;

function refreshLockTip() {
    const waiting = playing && lockWorked && !controls.isLocked() && !touchDevice;
    lockTip.classList.toggle('hidden', !waiting);
}

function openGallery() {
    overlays.openGallery();
}

function openMenu() {
    overlays.openMenu();
}

const hud = createHud({
    onSelectSlot: index => selectSlot(index),
    onOpenGallery: () => openGallery(),
    onOpenMenu: () => openMenu()
});

const overlays = createOverlays({
    onStart: () => {
        playing = true;
        hud.show();
        prewarm();
        controls.requestLock();
        refreshLockTip();
        hud.toast('先打开冰箱拿食材，做完菜记得用空盘子装盘');
    },
    onBlockChange: blocked => {
        if (blocked) {
            controls.releaseLock();
        } else if (playing) {
            controls.requestLock();
        }
        refreshLockTip();
    },
    onReset: () => {
        resetProgress();
        items.slice().forEach(item => removeItem(item));
        fridgeOpen = false;
        fridge.pivot.rotation.y = 0;
        fridge.updateArea();
        cookState[0].time = -1; cookState[0].recipe = null;
        cookState[1].time = -1; cookState[1].recipe = null;
        hud.cancelAction();
        fx.clear();
        setBubbles(false);
        chopWork.key = null;
        chopWork.steps = 0;
        clearPot(0); clearPot(1);
        overlays.renderGallery();
        hud.toast('进度已重置，重新开始吧');
    }
});

function itemModel(kind, recipeId) {
    if (kind === 'food') {
        return createFoodModel(recipeId);
    }
    if (kind === 'dirty') {
        return createPlateModel(true);
    }
    return createDishModel(recipeId);
}

function slotPosition(place, slot) {
    if (place === 'pan') {
        return slot % 2 === 0 ? PAN_SLOT_LEFT : PAN_SLOT_RIGHT;
    }
    return TABLE_SLOTS[slot];
}

function freeSlot(place) {
    if (place === 'pan') {
        const left = items.some(e => e.place === 'pan' && e.slot <= 0);
        const right = items.some(e => e.place === 'pan' && e.slot > 0);
        if (!left) return 0;
        if (!right) return 1;
        return -1;
    }
    const used = items.filter(entry => entry.place === place).map(entry => entry.slot);
    for (let i = 0; i < TABLE_SLOTS.length; i += 1) {
        if (!used.includes(i)) {
            return i;
        }
    }
    return -1;
}

function handPoint() {
    return handAnchor.getWorldPosition(new THREE.Vector3());
}

function contactPoint(item) {
    return item.node.position.clone().setY(item.node.position.y + 0.08);
}

function spawnItem(kind, recipeId, place, slot, options = {}) {
    const model = itemModel(kind, recipeId);
    const target = slotPosition(place, slot).clone();
    const item = {
        id: nextItemId,
        kind,
        recipeId,
        place,
        slot,
        node: model,
        hot: Boolean(options.hot),
        flying: Boolean(options.fly),
        bornAt: performance.now()
    };
    nextItemId += 1;
    items.push(item);
    kitchen.root.add(model);
    model.rotation.y = (item.id * 0.9) % (Math.PI * 2);

    if (options.fly) {
        const start = handPoint();
        model.position.copy(start);
        model.scale.setScalar(0.7);
        arcTo(start, target, 0.5, {
            duration: 0.42,
            onUpdate: (point, raw) => {
                model.position.copy(point);
                model.scale.setScalar(0.7 + raw * 0.3);
            },
            onDone: () => {
                model.position.copy(target);
                model.scale.setScalar(1);
                item.flying = false;
                picker.register(model, { kind: 'item', itemId: item.id, priority: 2 });
                fx.ring(target, 0xffc46b);
            }
        });
    } else {
        model.position.copy(target);
        picker.register(model, { kind: 'item', itemId: item.id, priority: 2 });
        if (kind === 'food') {
            fx.steam(target.clone().setY(target.y + 0.05), 5);
        }
    }
    return item;
}

function removeItem(item) {
    picker.unregister(item.node);
    item.node.removeFromParent();
    const index = items.indexOf(item);
    if (index >= 0) {
        items.splice(index, 1);
    }
}

function replaceItem(item, kind, recipeId) {
    picker.unregister(item.node);
    item.node.removeFromParent();
    const model = itemModel(kind, recipeId);
    const target = slotPosition(item.place, item.slot).clone();
    model.position.copy(target);
    model.rotation.y = (item.id * 0.9) % (Math.PI * 2);
    kitchen.root.add(model);
    picker.register(model, { kind: 'item', itemId: item.id, priority: 2 });
    item.node = model;
    item.kind = kind;
    item.recipeId = recipeId;
    model.scale.setScalar(1.25);
    tween({
        duration: 0.28,
        onUpdate: eased => model.scale.setScalar(1.25 - eased * 0.25),
        onDone: () => model.scale.setScalar(1)
    });
}

function findItem(itemId) {
    return items.find(entry => entry.id === itemId) || null;
}

function handKeyOf(hand) {
    if (!hand) {
        return '';
    }
    return hand.kind + ':' + (hand.recipeId || '') + ':' + (hand.id || '') + ':' + (hand.chopped ? 1 : 0);
}

function refreshHandModel() {
    const key = handKeyOf(state.hand);
    if (key === handKey) {
        return;
    }
    handKey = key;
    if (handModel) {
        handAnchor.remove(handModel);
        handModel = null;
    }
    const hand = state.hand;
    if (!hand) {
        return;
    }
    let handScale = HAND_SCALE;
    if (hand.kind === 'plate') {
        handModel = createPlateModel(false);
    } else if (hand.kind === 'dirtyPlate') {
        handModel = createPlateModel(true);
    } else if (hand.kind === 'ingredient') {
        handModel = createIngredientModel(hand.id, hand.chopped === true);
        handScale = handScaleFor(handModel);
    } else {
        handModel = createDishModel(hand.recipeId);
    }
    const model = handModel;
    model.userData.handScale = handScale;
    model.scale.setScalar(handScale * 0.72);
    model.traverse(child => {
        if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
        }
    });
    handAnchor.add(model);
    tween({
        duration: 0.24,
        onUpdate: eased => {
            if (handModel === model) {
                model.scale.setScalar(handScale * (0.72 + 0.28 * eased));
            }
        },
        onDone: () => {
            if (handModel === model) {
                model.scale.setScalar(handScale);
            }
        }
    });
}

function refreshPlateStack() {
    if (stackKey === state.plates) {
        return;
    }
    const grew = state.plates > stackKey && stackKey >= 0;
    stackKey = state.plates;
    plateStackGroup.clear();
    if (state.plates > 0) {
        const stack = createPlateStackModel(state.plates);
        plateStackGroup.add(stack);
        if (grew) {
            stack.scale.setScalar(1.18);
            tween({
                duration: 0.3,
                onUpdate: eased => stack.scale.setScalar(1.18 - eased * 0.18),
                onDone: () => stack.scale.setScalar(1)
            });
        }
    }
}

function refreshBoard() {
    const key = dailyDay() + '|' + state.daily.join(',') + '|' + state.dailyDone.join(',');
    if (key === boardKey) {
        return;
    }
    boardKey = key;
    menuBoard.draw(state.daily, state.dailyDone, dailyDay());
}

function setBubbles(active) {
    kitchen.sinkStation.bubbles.visible = active;
}

function itemName(entry) {
    if (!entry) {
        return '空手';
    }
    if (entry.kind === 'ingredient') {
        const item = ingredient(entry.id);
        return item ? item.name : entry.id;
    }
    if (entry.kind === 'plate') {
        return '干净盘子';
    }
    if (entry.kind === 'dirtyPlate') {
        return '脏盘子';
    }
    const item = recipe(entry.recipeId);
    return item ? item.name : '料理';
}

function namesOf(ids) {
    return ids.map(id => ingredient(id).name).join('、');
}

function stash(entry) {
    if (!bagHasRoom()) {
        hud.toast('物品栏满了，先按 Q 把手上的东西放回去');
        sfx.deny();
        return false;
    }
    return bagAdd(entry) >= 0;
}

function grant(amount, position, label, kind = 'good') {
    const ups = addExp(amount);
    if (position && label) {
        fx.text(position, label, kind);
    }
    ups.forEach(reached => showLevelUp(reached));
    return ups.length > 0;
}

function showLevelUp(reached) {
    const row = levelRow(reached);
    const unlocks = row.unlock.map(id => recipe(id));
    sfx.levelUp();
    hud.toast('升级！Lv.' + reached + ' · ' + row.title);
    fx.text(handPoint().add(new THREE.Vector3(0, 0.25, 0)), 'Lv.' + reached, 'level');
    overlays.showCard({
        kicker: 'LEVEL UP',
        title: 'Lv.' + reached,
        sub: row.title,
        items: unlocks.length > 0
            ? unlocks.map(item => ({ emoji: item.emoji, name: item.name, note: '新菜谱' }))
            : [{ emoji: '💪', name: '继续做菜也能变强', note: '经验继续累积' }]
    });
    overlays.renderGallery();
}

function checkDaily(recipeId, position) {
    if (!completeDaily(recipeId)) {
        return;
    }
    const all = dailyAllDone();
    sfx.daily();
    grant(all ? EXP_RULES.daily + EXP_RULES.dailyAll : EXP_RULES.daily, position, '今日菜单 +' + EXP_RULES.daily + ' 经验', 'star');
    if (!all) {
        return;
    }
    rollDaily();
    sfx.sprite();
    hud.toast('菜单全清，新一天开始了');
    overlays.showCard({
        kicker: 'MENU CLEAR',
        title: '第 ' + dailyDay() + ' 天',
        sub: '菜单全部完成，全清奖励 +' + EXP_RULES.dailyAll + ' 经验，新的菜单已经挂上看板',
        items: state.daily.filter(id => recipe(id) !== undefined).map(id => ({ emoji: recipe(id).emoji, name: recipe(id).name, note: '新菜单' })),
        duration: 3800
    });
}

function hintFor(hovered) {
    if (!hovered) {
        return '';
    }
    const data = hovered.data;
    const hand = state.hand;
    const name = itemName(hand);
    if (data.kind === 'fridge') {
        return fridgeOpen ? '关上冰箱门' : '打开冰箱门 · 食材都在里面';
    }
    if (data.kind === 'ingredient') {
        const entry = spots[data.spotIndex];
        if (!entry) {
            return '';
        }
        if (!fridgeOpen) {
            return '先打开冰箱门';
        }
        const label = ingredient(entry.spot.ingredientId).name;
        if (entry.count <= 0) {
            return '「' + label + '」刚被拿空，马上补货';
        }
        if (!bagHasRoom()) {
            return '物品栏满了 · 先按 Q 放回手上的东西';
        }
        return '拿取「' + label + '」';
    }
    if (data.kind === 'chop') {
        if (!hand || hand.kind !== 'ingredient') {
            return '切菜板 · 先用数字键选中要切的食材';
        }
        if (hand.chopped) {
            return '「' + name + '」已经切好了';
        }
        if (!needsChopping(hand.id)) {
            return '「' + name + '」不用切，直接下锅';
        }
        const steps = chopWork.key === chopKey(hand) ? chopWork.steps : 0;
        return '连点切碎「' + name + '」（' + steps + '/' + CHOP_STEPS + '）';
    }
    if (data.kind === 'stove') {
    if (cookState[0].time >= 0 && cookState[0].recipe || cookState[1].time >= 0 && cookState[1].recipe) {
        const active = cookState[0].time >= 0 ? cookState[0] : cookState[1];
        return '正在翻炒「' + active.recipe.name + '」…';
    }
    const inPan0 = panFood(0);
    const inPan1 = panFood(1);
    if (inPan0 || inPan1) {
        if (hand && hand.kind === 'plate') {
            const panItem = inPan0 || inPan1;
            return '把' + (inPan0 ? '左' : '右') + '锅里的「' + recipe(panItem.recipeId).name + '」装进盘子';
        }
        const panItem = inPan0 || inPan1;
        return (inPan0 && inPan1)
            ? '两个锅都有菜 · 选一个空盘子来装'
            : (inPan0 ? '左' : '右') + '锅里还温着「' + recipe(panItem.recipeId).name + '」· 选一个空盘子来装';
    }
    if (hand && hand.kind === 'ingredient') {
        if (!hand.chopped && needsChopping(hand.id)) {
            return '「' + name + '」要先去切菜板切碎';
        }
        const bothEmpty = potState.ids[0].length === 0 && potState.ids[1].length === 0;
        if (bothEmpty) return '把「' + name + '」放进锅里';
        const parts = [];
        if (potState.ids[0].length) parts.push('左锅有 ' + namesOf(potState.ids[0]));
        if (potState.ids[1].length) parts.push('右锅有 ' + namesOf(potState.ids[1]));
        return parts.join(' · ');
    }
    const leftLen = potState.ids[0].length;
    const rightLen = potState.ids[1].length;
    if (leftLen + rightLen > 0) {
        const parts = [];
        if (leftLen) parts.push('左锅有 ' + namesOf(potState.ids[0]));
        if (rightLen) parts.push('右锅有 ' + namesOf(potState.ids[1]));
        return parts.join(' · ') + ' · 空手点击捞回物品栏';
    }
    if (hand && hand.kind === 'dish') {
        return '「' + name + '」已经装好盘了 · 端到餐桌上去';
    }
    if (hand && hand.kind === 'plate') {
        return '锅是空的 · 先选中切好的食材放进锅里';
    }
    if (hand && hand.kind === 'dirtyPlate') {
        return '脏盘子得先去水槽洗干净';
    }
    return '灶台 · 先用数字键选中切好的食材·左右两个灶眼都可以用';
}if (data.kind === 'plates') {
        if (!hand) {
            return state.plates > 0 ? '拿一个干净盘子（盘堆剩 ' + state.plates + ' 个）' : '盘堆空了，先去水槽洗盘子';
        }
        return hand.kind === 'plate' ? '把盘子放回盘堆' : '手上拿着「' + name + '」· 换到空格子再拿盘子';
    }
    if (data.kind === 'sink') {
        if (hand && hand.kind === 'dirtyPlate') {
            return '把脏盘子洗干净';
        }
        if (hand && hand.kind === 'plate') {
            return '水槽 · 这个盘子已经是干净的';
        }
        return '水槽 · 选中脏盘子才能洗';
    }
    if (data.kind === 'table') {
        if (hand && hand.kind === 'dish') {
            return '把「' + name + '」端上餐桌';
        }
        if (hand) {
            return '餐桌 · 手上要端着做好的菜才能上桌';
        }
        return '餐桌 · 做好菜端过来就能吃';
    }
    if (data.kind === 'item') {
        const item = findItem(data.itemId);
        if (!item) {
            return '';
        }
        if (item.kind === 'food') {
            const hot = performance.now() - item.bornAt <= HOT_WINDOW;
            const where = '锅里';
            const label = '「' + recipe(item.recipeId).name + '」';
            if (hand && hand.kind === 'plate') {
                return '把' + where + '的' + label + '装进盘子' + (hot ? '（趁热 +' + EXP_RULES.hotPlate + ' 经验）' : '');
            }
            if (!hand) {
                return label + '在' + where + ' · 先选一个空盘子，再到盘堆拿';
            }
            return hand.kind === 'dirtyPlate' ? '脏盘子不能装菜，先去水槽洗' : '手上拿着' + name + '，换个空盘子来装';
        }
        if (item.kind === 'dish') {
            return '吃' + '「' + recipe(item.recipeId).name + '」';
        }
        if (hand) {
            return '手上拿着「' + name + '」· 换个空格子再来拿';
        }
        return bagHasRoom() ? '拿走脏盘子，去水槽洗干净' : '物品栏满了，先按 Q 放回点东西';
    }
    return '';
}

function takeIngredient(spotIndex) {
    const entry = spots[spotIndex];
    if (!entry || entry.count <= 0) {
        return;
    }
    if (!fridgeOpen) {
        hud.toast('冰箱门关着，先打开再拿');
        sfx.deny();
        return;
    }
    if (!bagHasRoom()) {
        hud.toast('物品栏满了，按 Q 先把手上的东西放回去');
        sfx.deny();
        return;
    }
    const id = entry.spot.ingredientId;
    const isNew = !state.discovered.has(id);
    bagAdd({ kind: 'ingredient', id, chopped: false });
    entry.count -= 1;
    applyPileCount(entry);
    entry.readyAt = performance.now() + entry.refillStep;
    sfx.pick();
    fx.spark(entry.spot.position.clone().setY(entry.spot.position.y + 0.05), 0xffe6b0, 6);
    fx.text(entry.spot.position.clone().setY(entry.spot.position.y + 0.16), '+' + ingredient(id).name, 'good');
    if (isNew) {
        hud.toast('新食材入册：' + ingredient(id).name);
    }
}

function dropSelected() {
    const entry = state.hand;
    if (!entry) {
        hud.toast('手上没有东西');
        sfx.deny();
        return;
    }
    if (entry.kind === 'ingredient') {
        const spot = spots.find(item => item.spot.ingredientId === entry.id && item.count < item.capacity);
        takeSlot(state.selected);
        if (spot) {
            spot.count += 1;
            applyPileCount(spot);
        }
        sfx.click();
        hud.toast('把「' + itemName(entry) + '」放回了冰箱');
        return;
    }
    if (entry.kind === 'plate') {
        takeSlot(state.selected);
        returnPlateToStack();
        sfx.plate();
        fx.spark(kitchen.plateSpot.clone().setY(kitchen.plateSpot.y + 0.08), 0xffe6b0, 5);
        hud.toast('盘子放回了盘堆');
        return;
    }
    if (entry.kind === 'dirtyPlate') {
        sfx.deny();
        hud.toast('脏盘子只能拿去水槽洗');
        return;
    }
    sfx.deny();
    hud.toast('做好的菜要端到餐桌上，不能丢');
}

function toggleFridge() {
    fridgeOpen = !fridgeOpen;
    sfx.pick();
    hud.toast(fridgeOpen ? '冰箱门开了，食材都在里面' : '冰箱门关上了');
}

// 砧板上掉出来的碎屑：按食材的切配形态现做（圆片/细丝/楔块/丁），和切碎后的手持模型一致
const CHOP_BITS_SPOTS = [
    [-0.08, 0.04, 0.4],
    [0.02, 0.09, 1.2],
    [0.09, 0.02, 0.2],
    [-0.02, -0.02, 0.9],
    [0.07, 0.11, 1.6],
    [-0.06, -0.06, 2.2]
];

function playChop(ingredientId) {
    chopStation.bits.clear();
    CHOP_BITS_SPOTS.forEach((spot, index) => {
        const piece = createIngredientPiece(ingredientId, index);
        piece.position.set(0.6 + spot[0], 0.955, -0.04 + spot[1]);
        piece.rotation.y = spot[2];
        chopStation.bits.add(piece);
    });
    chopStation.bits.visible = true;
    chopAnim.time = 0;
}

function updateChop(delta) {
    if (chopAnim.time < 0) {
        return;
    }
    chopAnim.time += delta;
    const time = chopAnim.time;
    if (time < 0.86) {
        const phase = (time / 0.86) * Math.PI * 4;
        chopStation.knife.position.y = knifeBaseY - Math.abs(Math.sin(phase)) * 0.032;
        chopStation.knife.rotation.z = Math.sin(phase) * 0.1;
        return;
    }
    chopStation.knife.position.y = knifeBaseY;
    chopStation.knife.rotation.z = 0;
    if (time > 0.86 + 1.9) {
        chopStation.bits.visible = false;
        chopAnim.time = -1;
    }
}

function punchKnife() {
    const start = knifeBaseY;
    tween({
        duration: 0.28,
        onUpdate: (eased, raw) => {
            chopStation.knife.position.y = start - Math.sin(raw * Math.PI) * 0.05;
            chopStation.knife.rotation.z = Math.sin(raw * Math.PI) * 0.06;
        },
        onDone: () => {
            chopStation.knife.position.y = start;
            chopStation.knife.rotation.z = 0;
        }
    });
}

function updateFridge(delta) {
    const target = fridgeOpen ? fridge.openAngle : 0;
    const current = fridge.pivot.rotation.y;
    if (Math.abs(target - current) < 0.002) {
        if (current !== target) {
            fridge.pivot.rotation.y = target;
            fridge.updateArea();
            controls.resolve();
        }
        return;
    }
    const step = Math.min(DOOR_SPEED * delta, Math.abs(target - current));
    fridge.pivot.rotation.y = current + Math.sign(target - current) * step;
    fridge.updateArea();
    controls.resolve();
}

const COOK_TIME = 2.1;
const COOK_SPREAD = [[-0.05, -0.035], [0.045, 0.02], [0.005, 0.055], [0.055, -0.04], [-0.045, 0.045]];
const cookPanLeft = kitchen.cookStation.panLeft;
const cookPanRight = kitchen.cookStation.panRight;
const cookPanBodyLeft = cookPanLeft.userData.body;
const cookPanBodyRight = cookPanRight.userData.body;
const cookRestLeft = cookPanLeft.position.clone();
const cookRestRight = cookPanRight.position.clone();
const cookPointLeft = kitchen.cookStation.foodSpotLeft.clone();
const cookPointRight = kitchen.cookStation.foodSpotRight.clone();
const cookState = [
    { time: -1, flame: 0, jolt: 0, steam: 0, tossed: false, recipe: null, activeBurner: 0 },
    { time: -1, flame: 0, jolt: 0, steam: 0, tossed: false, recipe: null, activeBurner: 1 }
];
const potState = { ids: [[], []], models: [[], []], burner: 0 };

function panFood(burner) {
    return items.find(entry => entry.place === 'pan' && entry.slot === burner) || null;
}

function cookTopPoint(burner) {
    const pt = burner === 0 ? cookPointLeft : cookPointRight;
    // 锅内底往上 7cm，正好在锅沿上方，特效不会从锅里冒出来
    return pt.clone().setY(pt.y + 0.07);
}

function potPoint(index, burner) {
    const offset = COOK_SPREAD[index % COOK_SPREAD.length];
    const pt = burner === 0 ? cookPointLeft : cookPointRight;
    // 锅里的食材贴在锅内底上（原来固定抬高 5.5cm，锅改成有内胆后就浮空了）
    return pt.clone().add(new THREE.Vector3(offset[0], 0.004, offset[1]));
}

function clearPot(burner) {
    const ids = potState.ids[burner] || [];
    const models = potState.models[burner] || [];
    models.forEach(node => node.removeFromParent());
    models.length = 0;
    ids.length = 0;
}

function dropInPot(id, burner) {
    const node = createIngredientModel(id, true);
    node.scale.setScalar(POT_DROP_SCALE);
    const start = handPoint();
    node.position.copy(start);
    kitchen.root.add(node);
    const potIds = potState.ids[burner] = potState.ids[burner] || [];
    const potModels = potState.models[burner] = potState.models[burner] || [];
    potIds.push(id);
    potModels.push(node);
    const target = potPoint(potIds.length - 1, burner);
    arcTo(start, target, 0.44, {
        duration: 0.38,
        onUpdate: point => node.position.copy(point),
        onDone: () => {
            node.position.copy(target);
            node.scale.setScalar(POT_REST_SCALE);
            cookState[burner].jolt = 1;
            sfx.drop();
            fx.spark(target, ingredient(id).color, 5);
            fx.steam(target, 2);
            checkPot(burner);
        }
    });
}

function checkPot(burner) {
    const ids = potState.ids[burner] || [];
    if (ids.length === 0) {
        return;
    }
    const result = cook(ids.map(id => ({ id, chopped: true })));
    if (!result.ok) {
        if (result.reason === 'nomatch') {
            hud.toast(burnerName(burner) + '里现在是 ' + namesOf(ids) + '，再加点别的试试');
        }
        return;
    }
    if (!isUnlocked(result.recipe.id)) {
        hud.toast('「' + result.recipe.name + '」要 Lv.' + unlockLevelOf(result.recipe.id) + ' 才解锁，空手点灶台可以捞回来');
        sfx.deny();
        return;
    }
    beginCook(result.recipe, burner);
}

function returnPotToBag(burner) {
    const ids = potState.ids[burner] || [];
    if (ids.length === 0) {
        return false;
    }
    if (bagCount() + ids.length > TRAY_SIZE) {
        hud.toast('物品栏放不下锅里的食材，先按 Q 放回一些东西');
        sfx.deny();
        return false;
    }
    const copied = ids.slice();
    clearPot(burner);
    copied.forEach(id => bagAdd({ kind: 'ingredient', id, chopped: true }));
    sfx.pick();
    hud.toast('把' + burnerName(burner) + '里的 ' + namesOf(copied) + ' 捞回了物品栏');
    return true;
}

function burnerName(b) {
    return b === 0 ? '左锅' : '右锅';
}

function beginCook(recipeInfo, burner) {
    const cs = cookState[burner];
    cs.time = 0;
    cs.jolt = 0;
    cs.steam = 0;
    cs.tossed = false;
    cs.recipe = recipeInfo;
    cs.activeBurner = burner;
    sfx.sizzle();
    fx.ring(cookTopPoint(burner), 0xffa657);
    hud.startAction({
        label: '开火下锅 · ' + recipeInfo.name,
        duration: COOK_TIME,
        onDone: () => finishCook(burner)
    });
}

function finishCook(burner) {
    const cs = cookState[burner];
    const recipeInfo = cs.recipe;
    cs.time = -1;
    cs.recipe = null;
    const panBody = burner === 0 ? cookPanBodyLeft : cookPanBodyRight;
    const pan = burner === 0 ? cookPanLeft : cookPanRight;
    const rest = burner === 0 ? cookRestLeft : cookRestRight;
    panBody.rotation.set(0, 0, 0);
    pan.position.copy(rest);
    clearPot(burner);
    if (!recipeInfo) {
        return;
    }
    const item = spawnItem('food', recipeInfo.id, 'pan', burner, { hot: true });
    const isNew = !state.cooked.has(recipeInfo.id);
    unlockRecipe(recipeInfo.id);
    setStars(recipeInfo.id, 1);
    sfx.cook();
    fx.spark(cookTopPoint(burner), 0xffd9a0, 7);
    fx.steam(cookTopPoint(burner), 4);
    const at = contactPoint(item);
    hud.toast('出锅：' + recipeInfo.name + '，就在' + burnerName(burner) + '里，拿个空盘子来装');
    checkDaily(recipeInfo.id, at);
    const gain = EXP_RULES.cook + (isNew ? EXP_RULES.firstTime : 0);
    grant(gain, at, (isNew ? '首次出炉 ' : '') + '+' + gain + ' 经验');
}

function burnerFlame(b) {
    return b === 0 ? kitchen.cookStation.flameLeft : kitchen.cookStation.flameRight;
}

function burnerLight(b) {
    return b === 0 ? kitchen.cookStation.flameLightLeft : kitchen.cookStation.flameLightRight;
}

function updateCook(delta) {
    for (let burner = 0; burner < 2; burner += 1) {
        const cs = cookState[burner];
        const cooking = cs.time >= 0;
        if (cooking) {
            cs.time = Math.min(cs.time + delta, COOK_TIME);
        }
        const inPan = panFood(burner);
        const wanted = cooking ? 1 : (inPan ? 0.3 : 0);
        cs.flame += (wanted - cs.flame) * Math.min(delta * 7, 1);
        const flame = burnerFlame(burner);
        flame.visible = cs.flame > 0.03;
        if (flame.visible) {
            const wobble = 1 + Math.sin(performance.now() * 0.012 + burner * 3.7) * 0.14;
            const size = 0.35 + 0.65 * cs.flame;
            flame.scale.set(wobble * size, Math.max(cs.flame * wobble, 0.06), wobble * size);
        }
        const light = burnerLight(burner);
        light.intensity = cs.flame * 1.6 * (1 + Math.sin(performance.now() * 0.021 + burner * 4.2) * 0.14);

        if (!cooking) {
            const panBody = burner === 0 ? cookPanBodyLeft : cookPanBodyRight;
            const pan = burner === 0 ? cookPanLeft : cookPanRight;
            const rest = burner === 0 ? cookRestLeft : cookRestRight;
            cs.jolt = Math.max(0, cs.jolt - delta * 3.4);
            if (cs.jolt <= 0) {
                panBody.rotation.set(0, 0, 0);
                pan.position.copy(rest);
            }
            continue;
        }

        const panBody = burner === 0 ? cookPanBodyLeft : cookPanBodyRight;
        const pan = burner === 0 ? cookPanLeft : cookPanRight;
        const rest = burner === 0 ? cookRestLeft : cookRestRight;
        const time = cs.time;
        const env = Math.min(1, time / 0.22) * Math.min(1, (COOK_TIME - time) / 0.4);
        const shake = Math.sin(time * 27) * 0.05 * env + cs.jolt * 0.075;
        const bob = Math.sin(time * 33) * 0.008 * env;
        let tilt = 0;
        if (time > 1.25 && time < 1.85) {
            tilt = Math.sin(((time - 1.25) / 0.6) * Math.PI) * 0.5;
        }
        panBody.rotation.z = shake;
        panBody.rotation.x = tilt;
        pan.position.set(rest.x, rest.y + bob + tilt * 0.035, rest.z);
        cs.steam += delta;
        if (cs.steam > 0.2) {
            cs.steam = 0;
            fx.steam(cookTopPoint(burner), 2);
        }
        if (!cs.tossed && time > 1.52) {
            cs.tossed = true;
            sfx.toss();
            fx.crumbs(cookTopPoint(burner), 0xffc46b);
            fx.spark(cookTopPoint(burner), 0xffb066, 6);
            fx.steam(cookTopPoint(burner), 3);
            const potModels = potState.models[burner] || [];
            potModels.forEach((node, index) => {
                const restPos = node.position.clone();
                tween({
                    duration: 0.5,
                    delay: index * 0.05,
                    onUpdate: eased => {
                        node.position.copy(restPos);
                        node.position.y = restPos.y + Math.sin(eased * Math.PI) * 0.2;
                        node.rotation.x = eased * 1.4;
                    },
                    onDone: () => {
                        node.position.copy(restPos);
                        node.rotation.x = 0;
                    }
                });
            });
        }
    }
}
function chopKey(entry) {
    return state.selected + ':' + entry.id;
}

function doChop() {
    const entry = state.hand;
    if (!entry || entry.kind !== 'ingredient') {
        hud.toast('先用数字键选中要切的食材');
        sfx.deny();
        return;
    }
    if (entry.chopped) {
        hud.toast('「' + itemName(entry) + '」已经切好了');
        sfx.deny();
        return;
    }
    if (!needsChopping(entry.id)) {
        hud.toast('「' + itemName(entry) + '」不用切，直接下锅就行');
        sfx.deny();
        return;
    }
    const key = chopKey(entry);
    if (chopWork.key !== key) {
        chopWork.key = key;
        chopWork.steps = 0;
    }
    chopWork.steps += 1;
    const board = new THREE.Vector3(0.6, 0.95, 0);
    const color = new THREE.Color(ingredient(entry.id).color).getHex();
    handMotion.punch = 1;
    if (chopWork.steps < CHOP_STEPS) {
        punchKnife();
        sfx.chop(chopWork.steps);
        fx.crumbs(board, color);
        return;
    }
    markChopped(state.selected);
    sfx.chopped();
    fx.crumbs(board, color);
    fx.text(board.clone().setY(board.y + 0.18), '切碎了「' + itemName(entry) + '」', 'good');
    chopWork.key = null;
    chopWork.steps = 0;
    playChop(entry.id);
    hud.toast('「' + itemName(entry) + '」切好了，可以下锅了');
}

function doCook(burner) {
    if (burner === undefined || burner === null) {
        burner = 0;
    }
    const inPan = panFood(burner);
    if (inPan) {
        if (state.hand && state.hand.kind === 'plate') {
            return;
        }
        hud.toast('' + (burner === 0 ? '左' : '右') + '锅里还温着「' + recipe(inPan.recipeId).name + '」，选一个空盘子来装');
        sfx.deny();
        return;
    }
    if (cookState[burner].time >= 0) {
        return;
    }
    const entry = state.hand;
    if (entry && entry.kind === 'ingredient') {
        if (!entry.chopped && needsChopping(entry.id)) {
            hud.toast('「' + itemName(entry) + '」要先去切菜板切碎');
            sfx.deny();
            return;
        }
        takeSlot(state.selected);
        sfx.pick();
        hud.toast('下锅：' + itemName(entry));
        dropInPot(entry.id, burner);
        return;
    }
    const ids = potState.ids[burner] || [];
    if (ids.length > 0) {
        if (returnPotToBag(burner)) {
            return;
        }
    }
    sfx.deny();
    hud.toast(entry ? '手上要拿着切好的食材才能下锅' : '先用数字键选中切好的食材');
}

function usePlateStack() {
    const hand = state.hand;
    if (!hand) {
        if (!takePlateFromStack()) {
            hud.toast('盘堆空了，先把脏盘子洗干净');
            sfx.deny();
            return;
        }
        setHand({ kind: 'plate' });
        sfx.plate();
        fx.ring(kitchen.plateSpot.clone().setY(kitchen.plateSpot.y + 0.06), 0xffd9a0);
        return;
    }
    if (hand.kind === 'plate') {
        returnPlateToStack();
        setHand(null);
        sfx.plate();
        fx.spark(kitchen.plateSpot.clone().setY(kitchen.plateSpot.y + 0.08), 0xffe6b0, 5);
        hud.toast('盘子放回了盘堆');
        return;
    }
    hud.toast(hand.kind === 'dirtyPlate' ? '脏盘子得先洗干净才能放回盘堆' : '手上还端着菜');
    sfx.deny();
}

function useSink() {
    const hand = state.hand;
    if (!hand || hand.kind !== 'dirtyPlate') {
        hud.toast(hand && hand.kind === 'plate' ? '这个盘子已经是干净的了' : '把脏盘子拿过来才能洗');
        sfx.deny();
        return;
    }
    const at = kitchen.sinkSpot.clone().setY(1.0);
    setBubbles(true);
    sfx.wash();
    hud.startAction({
        label: '冲一冲、刷一刷',
        duration: WASH_TIME,
        onDone: () => {
            setBubbles(false);
            setHand({ kind: 'plate' });
            countWash();
            sfx.washDone();
            fx.spark(at, 0xbfe4ff, 9);
            fx.ring(at, 0xbfe4ff);
            grant(EXP_RULES.wash, at, '洗干净 +' + EXP_RULES.wash + ' 经验');
            hud.toast('盘子洗好了，可以再次装菜');
        }
    });
}

function useTable() {
    const hand = state.hand;
    if (!hand || hand.kind !== 'dish') {
        hud.toast(hand && hand.kind === 'plate' ? '盘子还空着，先去装一份菜' : '端着做好的菜才能上桌');
        if (hand) {
            sfx.deny();
        }
        return;
    }
    const slot = freeSlot('table');
    if (slot < 0) {
        hud.toast('餐桌摆满了，先吃掉一份');
        sfx.deny();
        return;
    }
    const name = recipe(hand.recipeId).name;
    const hot = Boolean(state.hand.hot);
    setHand(null);
    const item = spawnItem('dish', hand.recipeId, 'table', slot, { fly: true, hot });
    item.hot = hot;
    countServe();
    if (hot) {
        const streak = pushStreak();
        const bonus = EXP_RULES.hotPlate + Math.min(streak, 5) * 2;
        grant(bonus, contactPoint(item), '趁热上桌 +' + bonus + ' 经验', 'star');
        setStars(hand.recipeId, 2);
        if (streak >= 2) {
            fx.text(contactPoint(item).add(new THREE.Vector3(0, 0.22, 0)), '连击 x' + streak, 'star');
        }
    } else {
        breakStreak();
        hud.toast('这盘有点凉了，下次出锅就趁热带过来吧');
    }
    hud.toast('上菜：' + name + '，再点一下就能吃');
    sfx.serve();
}

function eatDish(item) {
    const dish = recipe(item.recipeId);
    const at = contactPoint(item);
    sfx.eat();
    fx.text(at, '开始品尝…');
    hud.startAction({
        label: '品尝「' + dish.name + '」',
        duration: EAT_TIME,
        onDone: () => {
            markEaten(item.recipeId);
            const stars = item.hot ? 3 : 2;
            setStars(item.recipeId, stars);
            sfx.eatDone();
            fx.spark(at, 0xffe0a8, 10);
            fx.text(at.clone().setY(at.y + 0.1), '★'.repeat(stars) + ' 吃得很满足', 'star');
            grant(EXP_RULES.eat, at, '+' + EXP_RULES.eat + ' 经验');
            replaceItem(item, 'dirty', null);
            hud.toast('盘子变脏了，拿去水槽洗一洗');
        }
    });
}

function useItem(itemId) {
    const item = findItem(itemId);
    if (!item || item.flying) {
        return;
    }
    const hand = state.hand;
    if (item.kind === 'food') {
        if (hand && hand.kind === 'plate') {
            const id = item.recipeId;
            const hot = performance.now() - item.bornAt <= HOT_WINDOW;
            const from = item.node.position.clone();
            const flying = itemModel('dish', id);
            const index = items.indexOf(item);
            if (index >= 0) {
                items.splice(index, 1);
            }
            picker.unregister(item.node);
            item.node.removeFromParent();
            flying.position.copy(from);
            kitchen.root.add(flying);
            const target = handPoint();
            arcTo(from, target, 0.35, {
                duration: 0.3,
                onUpdate: (point, raw) => {
                    flying.position.copy(point);
                    flying.scale.setScalar(Math.max(0.25, 1 - raw * 0.7));
                },
                onDone: () => flying.removeFromParent()
            });
            setHand({ kind: 'dish', recipeId: id, hot });
            sfx.plate();
            fx.spark(from, 0xfff0c8, 6);
            hud.toast('装盘：' + recipe(id).name + (hot ? ' · 趁热' : ''));
            return;
        }
        if (hand && hand.kind === 'dish') {
            hud.toast('手上已经端着「' + itemName(hand) + '」了');
            sfx.deny();
            return;
        }
        if (hand && hand.kind === 'dirtyPlate') {
            hud.toast('脏盘子不能装菜，先去水槽洗');
            sfx.deny();
            return;
        }
        hud.toast('先换到一个空格子，到盘堆拿个空盘子，再回来装' + (item.place === 'pan' ? '锅里的' : '') + '菜');
        sfx.deny();
        return;
    }
    if (item.kind === 'dirty') {
        if (!stash({ kind: 'dirtyPlate' })) {
            return;
        }
        removeItem(item);
        sfx.pick();
        hud.toast('拿起脏盘子，去水槽洗一洗');
        return;
    }
    eatDish(item);
}

function handlePick(data) {
    if (data.kind === 'ingredient') {
        takeIngredient(data.spotIndex);
        return;
    }
    if (data.kind === 'fridge') {
        toggleFridge();
        return;
    }
    if (data.kind === 'chop') {
        doChop();
        return;
    }
    if (data.kind === 'stove') {
        doCook(data.burner);
        return;
    }
    if (data.kind === 'plates') {
        usePlateStack();
        return;
    }
    if (data.kind === 'sink') {
        useSink();
        return;
    }
    if (data.kind === 'table') {
        useTable();
        return;
    }
    if (data.kind === 'item') {
        useItem(data.itemId);
    }
}

function updateRespawns(now) {
    spots.forEach(entry => {
        if (entry.count >= entry.capacity || now < entry.readyAt) {
            return;
        }
        entry.count += 1;
        applyPileCount(entry);
        entry.readyAt = now + entry.refillStep;
    });
}

picker.register(kitchen.cookStation.hitboxLeft, { kind: 'stove', burner: 0, priority: 1 });
picker.register(kitchen.cookStation.hitboxRight, { kind: 'stove', burner: 1, priority: 1 });
picker.register(fridge.hitbox, { kind: 'fridge', priority: 2 });
picker.register(chopStation.hitbox, { kind: 'chop', priority: 2 });
picker.register(kitchen.sinkStation.hitbox, { kind: 'sink', priority: 2 });
picker.register(table.hitbox, { kind: 'table', priority: 1 });
picker.register(plateHitbox, { kind: 'plates', priority: 2 });

const soundButton = document.getElementById('btn-sound');
soundButton.textContent = isMuted() ? '🔇' : '🔊';
soundButton.addEventListener('click', () => {
    resumeAudio();
    soundButton.textContent = toggleMute() ? '🔇' : '🔊';
});

controls.onLockChange(locked => {
    if (locked) {
        lockWorked = true;
    }
    refreshLockTip();
});

controls.onTap(() => {
    resumeAudio();
    if (overlays.cardOpen()) {
        overlays.closeCard();
        return;
    }
    if (hud.busy() || overlays.isBlocking()) {
        return;
    }
    if (!playing) {
        return;
    }
    if (!touchDevice && lockWorked && !controls.isLocked()) {
        controls.requestLock();
        refreshLockTip();
        return;
    }
    const hovered = picker.getHovered();
    if (hovered) {
        handMotion.punch = Math.max(handMotion.punch, 0.7);
        handlePick(hovered.data);
    }
});

const DIGIT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

window.addEventListener('keydown', event => {
    if (event.repeat || !playing) {
        return;
    }
    const slot = DIGIT_CODES.indexOf(event.code);
    if (slot >= 0 && slot < TRAY_SIZE && !overlays.isBlocking()) {
        if (selectSlot(slot)) {
            sfx.click();
        }
        return;
    }
    if (overlays.isBlocking()) {
        return;
    }
    if (event.code === 'KeyQ') {
        dropSelected();
        return;
    }
    if (event.code === 'KeyE') {
        openGallery();
        return;
    }
    if (event.code === 'KeyM') {
        openMenu();
    }
});

subscribe(() => {
    hud.updateTray(state.tray, state.selected);
    hud.updateHand(state.hand);
    hud.refreshStats();
    hud.updateProgress(levelInfo());
    hud.updateDaily(state.daily, state.dailyDone, state.streak, dailyDay());
    refreshHandModel();
    refreshPlateStack();
    refreshBoard();
    if (overlays.galleryOpen()) {
        overlays.renderGallery();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
let bobTime = 0;
let smoothMove = 0;
let lastPosition = new THREE.Vector3();
let stepDistance = 0;
let stepFlip = false;

// 脚步声：按走过的距离触发（站着约 0.72m 一步、蹲着约 1.05m 一步，蹲着更轻）
function updateFootsteps(travelled) {
    if (!travelled) {
        return;
    }
    stepDistance += travelled;
    const stride = controls.isCrouched() ? 1.05 : 0.72;
    if (stepDistance < stride) {
        return;
    }
    stepDistance = 0;
    stepFlip = !stepFlip;
    sfx.step(controls.isCrouched(), stepFlip);
}

function updateHandMotion(delta) {
    const moved = lastPosition.distanceTo(camera.position);
    lastPosition.copy(camera.position);
    const target = Math.min(moved / Math.max(delta * 2.2, 0.0001), 1);
    smoothMove += (target - smoothMove) * Math.min(delta * 7, 1);
    handMotion.punch = Math.max(0, handMotion.punch - delta * 4.2);
    bobTime += delta;
    handAnchor.position.set(
        HAND_BASE.x + Math.sin(bobTime * 4.4) * 0.012 * smoothMove,
        HAND_BASE.y + Math.sin(bobTime * 8.8) * 0.016 * smoothMove - handMotion.punch * 0.028,
        HAND_BASE.z - handMotion.punch * 0.05
    );
    handAnchor.rotation.z = Math.sin(bobTime * 4.4) * 0.05 * smoothMove;
    if (handModel) {
        handModel.scale.setScalar((handModel.userData.handScale || HAND_SCALE) * (1 + handMotion.punch * 0.07));
    }
}

let frameWorst = 0;
let frameCount = 0;
let warmed = false;
let worldChanged = true;
let lastWorldKey = -1;

function worldKey() {
    let key = items.length * 7 + (potState.models[0].length + potState.models[1].length) * 131 + state.plates * 3;
    for (let i = 0; i < spots.length; i += 1) {
        key += (spots[i].count + 1) * (i * 7 + 3);
    }
    if (kitchen.sinkStation.bubbles.visible) {
        key += 512;
    }
    return key;
}

function prewarm() {
    if (warmed) {
        return;
    }
    warmed = true;
    try {
        prewarmScene();
    } catch (error) {
        warmed = true;
    }
}

function prewarmScene() {
    window.setTimeout(resumeAudio, 260);
    const hidden = [];
    scene.traverse(object => {
        if (!object.visible) {
            hidden.push(object);
            object.visible = true;
        }
    });
    renderer.compile(scene, camera);
    const probe = camera.position.clone();
    fx.crumbs(probe, 0xffffff);
    fx.steam(probe, 2);
    fx.spark(probe);
    fx.ring(probe);
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    fx.clear();
    hidden.forEach(object => {
        object.visible = false;
    });
    renderer.render(scene, camera);
}

function animate(now) {
    window.requestAnimationFrame(animate);
    const rawDelta = (now - lastTime) / 1000;
    lastTime = now;
    if (document.hidden) {
        return;
    }
    const stalled = rawDelta > 0.25;
    const delta = Math.min(rawDelta, 0.1);
    frameWorst = Math.max(frameWorst, rawDelta);
    frameCount += 1;

    updateTweens(delta);
    fx.update(delta);
    updateFridge(delta);
    updateChop(delta);
    updateCook(delta);
    hud.tickAction(delta);

    if (overlays.isBlocking()) {
        hud.setHint('', false);
    } else {
        updateFootsteps(controls.update(delta));
        updateRespawns(now);
        hud.setHint(hintFor(picker.detect()), true);
    }

    updateHandMotion(delta);
    const worldKeyNow = worldKey();
    if (worldKeyNow !== lastWorldKey) {
        lastWorldKey = worldKeyNow;
        worldChanged = true;
    }
    const doorMoving = Math.abs(fridge.pivot.rotation.y - (fridgeOpen ? fridge.openAngle : 0)) > 0.0006;
    const animating = tweenCount() > 0 || chopAnim.time >= 0 || cookState[0].time >= 0 || cookState[1].time >= 0;
    if (worldChanged || doorMoving || (animating && now - lastShadowAt >= SHADOW_INTERVAL)) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowAt = now;
    }
    worldChanged = false;
    if (stalled) {
        frameAvgMs = refreshMs;
        slowStreak = 0;
        settleFrames = Math.max(settleFrames, 30);
    } else {
        adaptResolution(rawDelta);
    }
    renderer.render(scene, camera);
}

if (import.meta.env.DEV) {
    window.__game = {
        camera,
        renderer,
        scene,
        kitchen,
        table,
        menuBoard,
        picker,
        fx,
        items,
        spots,
        cookState,
        potState,
        state,
        sfx,
        setHand,
        fridge,
        chopStation,
        takeIngredient,
        doChop,
        doCook,
        usePlateStack,
        rollDaily,
        useSink,
        useTable,
        useItem,
        toggleFridge,
        handPoint,
        perf: () => {
            const snapshot = {
                worstFrame: Number(frameWorst.toFixed(3)),
                frames: frameCount,
                fps: Math.round(1000 / Math.max(frameAvgMs, 0.1)),
                avgFrameMs: Number(frameAvgMs.toFixed(2)),
                renderScale: Number(renderScale.toFixed(2)),
                refreshMs: Number(refreshMs.toFixed(2)),
                pixelRatio: Number(renderer.getPixelRatio().toFixed(3)),
                drawCalls: renderer.info.render.calls,
                targets: picker.targetCount(),
                tweens: tweenCount(),
                nodes: document.querySelectorAll('*').length,
                particles: fx.count().particles,
                labels: fx.count().labels,
                heapMB: window.performance.memory ? Math.round(window.performance.memory.usedJSHeapSize / 1048576) : -1
            };
            frameWorst = 0;
            frameCount = 0;
            return snapshot;
        },
        pot: () => potState.ids[0].slice().concat(potState.ids[1]),
        teleport: (x, z, yaw, pitch = 0) => controls.setView(new THREE.Vector3(x, 1.62, z), yaw, pitch),
        cookPhase: () => Math.max(cookState[0].time, cookState[1].time),
        dropSelected,
        selectSlot,
        isFridgeOpen: () => fridgeOpen,
        toggleCrouch: () => controls.toggleCrouch(),
        isCrouched: () => controls.isCrouched()
    };
}

restore();
ensureDaily();
hud.updateTray(state.tray);
hud.updateHand(state.hand);
hud.refreshStats();
hud.updateProgress(levelInfo());
hud.updateDaily(state.daily, state.dailyDone, state.streak, dailyDay());
refreshHandModel();
refreshPlateStack();
refreshBoard();
controls.setObstacles(kitchen.obstacles.concat(table.obstacles, [fridge.area]));
controls.setView(kitchen.spawn.position, kitchen.spawn.yaw);
lastPosition.copy(camera.position);
overlays.openMenu();
window.setTimeout(prewarm, 400);
window.requestAnimationFrame(animate);
window.__bootOk = true;
