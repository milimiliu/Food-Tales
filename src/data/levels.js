const LEVEL_TABLE = [
    { level: 1, exp: 0, unlock: ['tomato_egg', 'veg_salad'], title: '开张营业' },
    { level: 2, exp: 40, unlock: ['potato_soup'], title: '暖汤上桌' },
    { level: 3, exp: 110, unlock: ['mushroom_beef'], title: '火候渐稳' },
    { level: 4, exp: 200, unlock: ['garden_stew'], title: '田园风味' },
    { level: 5, exp: 300, unlock: ['salmon_potato'], title: '压轴主菜' }
];

export const EXP_RULES = {
    cook: 12,
    hotPlate: 6,
    eat: 10,
    wash: 4,
    firstTime: 8,
    daily: 22,
    dailyAll: 30
};

const MAX_LEVEL = LEVEL_TABLE.length;

export function levelRow(level) {
    const index = Math.min(Math.max(level, 1), MAX_LEVEL) - 1;
    return LEVEL_TABLE[index];
}

export function levelOf(exp) {
    let level = 1;
    LEVEL_TABLE.forEach(row => {
        if (exp >= row.exp) {
            level = row.level;
        }
    });
    return level;
}

export function levelStartExp(level) {
    return levelRow(level).exp;
}

export function levelEndExp(level) {
    return level >= MAX_LEVEL ? levelRow(MAX_LEVEL).exp : levelRow(level + 1).exp;
}

export function unlockedAt(level) {
    const set = new Set();
    LEVEL_TABLE.forEach(row => {
        if (row.level <= level) {
            row.unlock.forEach(id => set.add(id));
        }
    });
    return set;
}

export function unlockLevelOf(recipeId) {
    const row = LEVEL_TABLE.find(item => item.unlock.includes(recipeId));
    return row ? row.level : 1;
}
