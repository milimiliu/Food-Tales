import { INGREDIENTS } from '../data/ingredients.js';
import { RECIPES, recipe } from '../data/recipes.js';
import { EXP_RULES, levelEndExp, levelOf, levelStartExp, unlockedAt } from '../data/levels.js';

const STORAGE_KEY = 'meishi-wuyu-progress-v1';
const SAVE_VERSION = 2;

export const TRAY_SIZE = 6;
const PLATE_STACK = 5;
export const STAR_MAX = 3;

export const state = {
    selected: 0,
    tray: new Array(TRAY_SIZE).fill(null),
    hand: null,
    plates: PLATE_STACK,
    discovered: new Set(),
    cooked: new Set(),
    eaten: new Set(),
    bonus: new Set(),
    stars: {},
    exp: 0,
    daily: [],
    dailyDate: '',
    dailyDone: [],
    dailyRound: 0,
    streak: 0,
    bestStreak: 0,
    washed: 0,
    served: 0
};

const listeners = new Set();

export function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
}

function notify() {
    listeners.forEach(listener => listener(state));
}

function dateKey() {
    const now = new Date();
    return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
}

function seedFrom(text) {
    let seed = 7;
    for (let i = 0; i < text.length; i += 1) {
        seed = (seed * 31 + text.charCodeAt(i)) % 2147483647;
    }
    return seed;
}

function pickDaily(round = 0) {
    const pool = RECIPES.map(item => item.id).filter(id => isUnlocked(id));
    if (pool.length <= 3) {
        return pool;
    }
    let seed = seedFrom(dateKey() + '#' + round);
    const picked = [];
    const used = new Set();
    let attempts = pool.length * 4 + 16;
    while (picked.length < 3 && used.size < pool.length && attempts > 0) {
        attempts -= 1;
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const index = seed % pool.length;
        if (used.has(index)) {
            continue;
        }
        used.add(index);
        picked.push(pool[index]);
    }
    for (let i = 0; picked.length < 3 && i < pool.length; i += 1) {
        if (!picked.includes(pool[i])) {
            picked.push(pool[i]);
        }
    }
    return picked;
}

export function level() {
    return levelOf(state.exp);
}

export function isUnlocked(recipeId) {
    return state.bonus.has(recipeId) || unlockedAt(level()).has(recipeId);
}

export function levelInfo() {
    const current = level();
    const start = levelStartExp(current);
    const end = levelEndExp(current);
    const span = Math.max(end - start, 1);
    return {
        level: current,
        exp: state.exp,
        start,
        end,
        ratio: end > start ? Math.min((state.exp - start) / span, 1) : 1,
        toNext: Math.max(end - state.exp, 0)
    };
}

export function addExp(amount) {
    if (amount <= 0) {
        return [];
    }
    const before = level();
    state.exp += amount;
    const after = level();
    const ups = [];
    for (let next = before + 1; next <= after; next += 1) {
        ups.push(next);
    }
    if (ups.length > 0) {
        ensureDaily();
    }
    notify();
    persist();
    return ups;
}

export function setStars(recipeId, count) {
    const current = state.stars[recipeId] || 0;
    if (count <= current) {
        return false;
    }
    state.stars[recipeId] = Math.min(count, STAR_MAX);
    notify();
    persist();
    return true;
}

export function starsOf(recipeId) {
    return state.stars[recipeId] || 0;
}

export function pushStreak() {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    notify();
    persist();
    return state.streak;
}

export function breakStreak() {
    if (state.streak === 0) {
        return;
    }
    state.streak = 0;
    notify();
    persist();
}

export function ensureDaily() {
    const today = dateKey();
    if (state.dailyDate !== today) {
        state.dailyDate = today;
        state.dailyDone = [];
        state.daily = [];
    }
    const valid = state.daily.filter(id => isUnlocked(id));
    if (valid.length !== state.daily.length) {
        state.dailyDone = state.dailyDone.filter(id => valid.includes(id));
        state.daily = valid;
    }
    if (state.daily.length < 3) {
        const pool = pickDaily(state.dailyRound).filter(id => !state.daily.includes(id));
        state.daily = state.daily.concat(pool.slice(0, 3 - state.daily.length));
    }
    state.dailyDone = state.dailyDone.filter(id => state.daily.includes(id));
    persist();
}

export function dailyDay() {
    return state.dailyRound + 1;
}

export function rollDaily() {
    state.dailyRound += 1;
    state.daily = [];
    state.dailyDone = [];
    ensureDaily();
    notify();
    persist();
}

export function dailyDone(recipeId) {
    return state.dailyDone.includes(recipeId);
}

export function dailyAllDone() {
    return state.daily.length > 0 && state.daily.every(id => dailyDone(id));
}

export function completeDaily(recipeId) {
    if (!state.daily.includes(recipeId) || dailyDone(recipeId)) {
        return false;
    }
    state.dailyDone.push(recipeId);
    notify();
    persist();
    return true;
}

export function countWash() {
    state.washed += 1;
    notify();
    persist();
}

export function countServe() {
    state.served += 1;
    notify();
    persist();
}

function syncHand() {
    state.hand = state.tray[state.selected] || null;
}

export function selectSlot(index) {
    const next = Math.max(0, Math.min(index, TRAY_SIZE - 1));
    if (next === state.selected) {
        return false;
    }
    state.selected = next;
    syncHand();
    notify();
    return true;
}

export function bagHasRoom() {
    return state.tray.some(entry => !entry);
}

export function bagCount() {
    return state.tray.filter(Boolean).length;
}

export function bagAdd(item) {
    let index = state.tray[state.selected] ? state.tray.findIndex(entry => !entry) : state.selected;
    if (index < 0) {
        return -1;
    }
    state.tray[index] = item;
    if (item.kind === 'ingredient') {
        state.discovered.add(item.id);
    }
    syncHand();
    notify();
    persist();
    return index;
}

export function takeSlot(index) {
    if (index < 0 || index >= TRAY_SIZE) {
        return null;
    }
    const entry = state.tray[index] || null;
    state.tray[index] = null;
    syncHand();
    notify();
    persist();
    return entry;
}

export function markChopped(index) {
    const entry = state.tray[index];
    if (!entry || entry.chopped) {
        return false;
    }
    entry.chopped = true;
    syncHand();
    notify();
    persist();
    return true;
}

export function setHand(item) {
    state.tray[state.selected] = item;
    syncHand();
    notify();
    persist();
}

export function takePlateFromStack() {
    if (state.plates <= 0) {
        return false;
    }
    state.plates -= 1;
    notify();
    return true;
}

export function returnPlateToStack() {
    state.plates += 1;
    notify();
}

export function unlockRecipe(recipeId) {
    state.cooked.add(recipeId);
    notify();
    persist();
}

export function markEaten(recipeId) {
    state.eaten.add(recipeId);
    notify();
    persist();
}

export function progress() {
    return {
        ingredients: state.discovered.size,
        ingredientTotal: INGREDIENTS.length,
        recipes: state.cooked.size,
        recipeTotal: RECIPES.length,
        eaten: state.eaten.size
    };
}

function persist() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: SAVE_VERSION,
            discovered: [...state.discovered],
            cooked: [...state.cooked],
            eaten: [...state.eaten],
            bonus: [...state.bonus],
            stars: state.stars,
            exp: state.exp,
            daily: state.daily,
            dailyDate: state.dailyDate,
            dailyDone: state.dailyDone,
            dailyRound: state.dailyRound,
            streak: state.streak,
            bestStreak: state.bestStreak,
            washed: state.washed,
            served: state.served
        }));
    } catch (error) {
        return;
    }
}

export function restore() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            ensureDaily();
            return;
        }
        const saved = JSON.parse(raw);
        state.discovered = new Set(saved.discovered || []);
        state.cooked = new Set(saved.cooked || []);
        state.eaten = new Set(saved.eaten || []);
        state.stars = saved.stars || {};
        state.bonus = new Set(saved.bonus || []);
        state.daily = (saved.daily || []).filter(id => recipe(id) !== undefined);
        state.dailyDate = saved.dailyDate || '';
        state.dailyDone = (saved.dailyDone || []).filter(id => recipe(id) !== undefined);
        state.dailyRound = saved.dailyRound || 0;
        state.streak = saved.streak || 0;
        state.bestStreak = saved.bestStreak || 0;
        state.washed = saved.washed || 0;
        state.served = saved.served || 0;
        if (typeof saved.exp === 'number') {
            state.exp = saved.exp;
        } else {
            state.exp = state.cooked.size * EXP_RULES.cook + state.eaten.size * EXP_RULES.eat;
            state.cooked.forEach(id => state.bonus.add(id));
        }
        ensureDaily();
    } catch (error) {
        ensureDaily();
        return;
    }
}

export function resetProgress() {
    state.discovered = new Set();
    state.cooked = new Set();
    state.eaten = new Set();
    state.bonus = new Set();
    state.stars = {};
    state.exp = 0;
    state.daily = [];
    state.dailyDone = [];
    state.dailyDate = '';
    state.dailyRound = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.washed = 0;
    state.served = 0;
    state.tray = new Array(TRAY_SIZE).fill(null);
    state.selected = 0;
    state.hand = null;
    state.plates = PLATE_STACK;
    ensureDaily();
    persist();
    notify();
}
