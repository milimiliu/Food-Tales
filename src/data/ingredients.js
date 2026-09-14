export const INGREDIENTS = [
    { id: 'tomato', name: '番茄', emoji: '🍅', color: '#e0463a', needsChopping: true },
    { id: 'egg', name: '鸡蛋', emoji: '🥚', color: '#f2e2c4', needsChopping: false },
    { id: 'potato', name: '土豆', emoji: '🥔', color: '#c69a5c', needsChopping: true },
    { id: 'carrot', name: '胡萝卜', emoji: '🥕', color: '#e8823a', needsChopping: true },
    { id: 'cabbage', name: '卷心菜', emoji: '🥬', color: '#7fbf5a', needsChopping: true },
    { id: 'mushroom', name: '蘑菇', emoji: '🍄', color: '#c9a98a', needsChopping: true },
    { id: 'beef', name: '牛肉', emoji: '🥩', color: '#b4453c', needsChopping: true },
    { id: 'salmon', name: '三文鱼', emoji: '🐟', color: '#f08a5d', needsChopping: true }
];

const INGREDIENT_MAP = new Map(INGREDIENTS.map(item => [item.id, item]));

export function ingredient(id) {
    return INGREDIENT_MAP.get(id);
}

export function needsChopping(id) {
    const item = INGREDIENT_MAP.get(id);
    return Boolean(item && item.needsChopping);
}
