import { INGREDIENTS, ingredient } from '../data/ingredients.js';
import { RECIPES } from '../data/recipes.js';
import { STAR_MAX, isUnlocked, level, state, starsOf } from '../game/state.js';
import { unlockLevelOf } from '../data/levels.js';

export function createOverlays(handlers) {
    const menu = document.getElementById('menu');
    const gallery = document.getElementById('gallery');
    const cardOverlay = document.getElementById('card');
    const cardKicker = document.getElementById('card-kicker');
    const cardTitle = document.getElementById('card-title');
    const cardSub = document.getElementById('card-sub');
    const cardItems = document.getElementById('card-items');
    const ingredientGrid = document.getElementById('gallery-ingredients');
    const recipeGrid = document.getElementById('gallery-recipes');
    const ingredientCount = document.getElementById('gallery-ingredient-count');
    const recipeCount = document.getElementById('gallery-recipe-count');
    const galleryStats = document.getElementById('gallery-stats');

    let cardTimer = 0;

    function notifyBlock() {
        if (handlers.onBlockChange) {
            handlers.onBlockChange(isBlocking());
        }
    }

    document.getElementById('btn-start').addEventListener('click', () => {
        closeMenu();
        handlers.onStart();
    });
    document.getElementById('btn-gallery-menu').addEventListener('click', openGallery);
    document.getElementById('btn-reset').addEventListener('click', () => handlers.onReset());
    document.getElementById('btn-gallery-close').addEventListener('click', closeGallery);
    document.getElementById('btn-card-close').addEventListener('click', closeCard);

    function openMenu() {
        menu.classList.remove('hidden');
        notifyBlock();
    }

    function closeMenu() {
        menu.classList.add('hidden');
        notifyBlock();
    }

    function openGallery() {
        renderGallery();
        gallery.classList.remove('hidden');
        notifyBlock();
    }

    function closeGallery() {
        gallery.classList.add('hidden');
        notifyBlock();
    }

    function renderGallery() {
        const starTotal = RECIPES.reduce((sum, item) => sum + starsOf(item.id), 0);
        ingredientCount.textContent = '已收集 ' + state.discovered.size + '/' + INGREDIENTS.length;
        recipeCount.textContent = '已解锁 ' + RECIPES.filter(item => isUnlocked(item.id)).length + '/' + RECIPES.length + ' · 已品尝 ' + state.eaten.size;
        galleryStats.textContent = 'Lv.' + level() + ' · 经验 ' + state.exp + ' · 星星 ' + starTotal + '/' + RECIPES.length * STAR_MAX + ' · 洗过 ' + state.washed + ' 个盘子 · 最长连击 ' + state.bestStreak;
        ingredientGrid.replaceChildren(...INGREDIENTS.map(item => {
            const owned = state.discovered.has(item.id);
            return card({
                emoji: owned ? item.emoji : '❔',
                title: owned ? item.name : '未发现',
                lines: owned ? [item.needsChopping ? '需要切碎后才能下锅' : '可以直接下锅'] : ['在冰箱里找找看'],
                state: owned ? 'owned' : 'locked'
            });
        }));
        recipeGrid.replaceChildren(...RECIPES.map(item => {
            const unlocked = isUnlocked(item.id);
            const cooked = state.cooked.has(item.id);
            const eaten = state.eaten.has(item.id);
            const stars = starsOf(item.id);
            const starLine = '★'.repeat(stars) + '☆'.repeat(STAR_MAX - stars) + ' 出餐质量';
            const parts = item.ingredients.map(id => {
                const base = ingredient(id);
                return unlocked ? base.emoji + base.name : '❔';
            });
            return card({
                emoji: cooked ? item.emoji : (unlocked ? item.emoji : '❔'),
                title: unlocked ? item.name : '未解锁',
                lines: unlocked
                    ? [parts.join(' + '), cooked ? starLine : '还没做过', eaten ? '已品尝 ✔' : item.desc]
                    : ['Lv.' + unlockLevelOf(item.id) + ' 解锁', '继续做菜累积经验'],
                state: cooked ? (eaten ? 'eaten' : 'owned') : (unlocked ? 'ready' : 'locked')
            });
        }));
    }

    function card({ emoji, title, lines, state: cardState }) {
        const node = document.createElement('div');
        node.className = 'card ' + cardState;
        const icon = document.createElement('div');
        icon.className = 'card-emoji';
        icon.textContent = emoji;
        const name = document.createElement('div');
        name.className = 'card-title';
        name.textContent = title;
        node.append(icon, name);
        lines.forEach(line => {
            const p = document.createElement('p');
            p.className = 'card-line';
            p.textContent = line;
            node.appendChild(p);
        });
        return node;
    }

    function showCard({ kicker, title, sub, items = [], duration = 2600 }) {
        cardKicker.textContent = kicker;
        cardTitle.textContent = title;
        cardSub.textContent = sub;
        cardItems.replaceChildren(...items.map(entry => {
            const row = document.createElement('div');
            row.className = 'card-item';
            const icon = document.createElement('span');
            icon.className = 'card-item-emoji';
            icon.textContent = entry.emoji;
            const name = document.createElement('span');
            name.className = 'card-item-name';
            name.textContent = entry.name;
            const note = document.createElement('span');
            note.className = 'card-item-note';
            note.textContent = entry.note || '';
            row.append(icon, name, note);
            return row;
        }));
        cardOverlay.classList.remove('hidden');
        window.clearTimeout(cardTimer);
        cardTimer = window.setTimeout(closeCard, duration);
    }

    function closeCard() {
        window.clearTimeout(cardTimer);
        cardOverlay.classList.add('hidden');
    }

    function cardOpen() {
        return !cardOverlay.classList.contains('hidden');
    }

    function isBlocking() {
        return !menu.classList.contains('hidden') || !gallery.classList.contains('hidden');
    }

    return {
        openMenu,
        openGallery,
        renderGallery,
        showCard,
        closeCard,
        cardOpen,
        isBlocking,
        galleryOpen: () => !gallery.classList.contains('hidden')
    };
}
