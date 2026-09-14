export const RECIPES = [
    {
        id: 'tomato_egg',
        name: '番茄炒蛋',
        emoji: '🍳',
        ingredients: ['tomato', 'egg'],
        desc: '酸甜裹着蛋香，最家常也最难失手的一道菜。'
    },
    {
        id: 'veg_salad',
        name: '时蔬沙拉',
        emoji: '🥗',
        ingredients: ['tomato', 'cabbage', 'carrot'],
        desc: '把三种蔬菜的清脆叠在一起，淋一点油醋汁。'
    },
    {
        id: 'mushroom_beef',
        name: '蘑菇煎牛肉',
        emoji: '🥘',
        ingredients: ['beef', 'mushroom'],
        desc: '牛肉煎到焦边，蘑菇吸满了锅里的肉汁。'
    },
    {
        id: 'potato_soup',
        name: '土豆浓汤',
        emoji: '🍲',
        ingredients: ['potato', 'carrot'],
        desc: '熬到绵软的土豆与胡萝卜，暖胃又温柔。'
    },
    {
        id: 'salmon_potato',
        name: '香煎三文鱼配土豆',
        emoji: '🍽️',
        ingredients: ['salmon', 'potato'],
        desc: '外皮微脆的三文鱼，配一勺绵密土豆泥。'
    },
    {
        id: 'garden_stew',
        name: '田园炖菜',
        emoji: '🥣',
        ingredients: ['potato', 'mushroom', 'cabbage'],
        desc: '慢火炖出的田园气息，简单却让人安心。'
    }
];

const RECIPE_MAP = new Map(RECIPES.map(item => [item.id, item]));

export function recipe(id) {
    return RECIPE_MAP.get(id);
}

export function recipeOf(ingredientIds) {
    const key = signature(ingredientIds);
    if (!key) {
        return null;
    }
    return RECIPES.find(item => signature(item.ingredients) === key) || null;
}

function signature(ingredientIds) {
    if (!ingredientIds || ingredientIds.length === 0) {
        return '';
    }
    return [...ingredientIds].sort().join('+');
}
