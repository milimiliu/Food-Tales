import { ingredient, needsChopping } from '../data/ingredients.js';
import { progress, TRAY_SIZE } from '../game/state.js';
import { recipe } from '../data/recipes.js';

const MAX_TOASTS = 2;

export function createHud(handlers) {
    const elements = {
        root: document.getElementById('hud'),
        hint: document.getElementById('hint'),
        crosshair: document.getElementById('crosshair'),
        stats: document.getElementById('stats'),
        toasts: document.getElementById('toasts'),
        hand: document.getElementById('hand'),
        hotbar: document.getElementById('hotbar-slots'),
        hotbarStatus: document.getElementById('hotbar-status'),
        level: document.getElementById('level'),
        expBar: document.getElementById('exp-bar'),
        daily: document.getElementById('daily'),
        dailyList: document.getElementById('daily-list'),
        dailyTitle: document.getElementById('daily-title'),
        action: document.getElementById('action'),
        actionLabel: document.getElementById('action-label'),
        actionBar: document.getElementById('action-bar')
    };

    document.getElementById('btn-gallery').addEventListener('click', handlers.onOpenGallery);
    document.getElementById('btn-menu').addEventListener('click', handlers.onOpenMenu);

    const slotButtons = [];
    for (let i = 0; i < TRAY_SIZE; i += 1) {
        const button = document.createElement('button');
        button.className = 'hotbar-slot empty';
        button.type = 'button';
        const key = document.createElement('span');
        key.className = 'hotbar-key';
        key.textContent = String(i + 1);
        const icon = document.createElement('span');
        icon.className = 'hotbar-icon';
        button.append(key, icon);
        button.addEventListener('click', () => handlers.onSelectSlot(i));
        elements.hotbar.appendChild(button);
        slotButtons.push({ button, icon });
    }

    let action = null;
    let actionStep = -1;
    let expKey = '';
    let dailyKey = '';

    function show() {
        elements.root.classList.remove('hidden');
    }

    let hintText = null;
    let hintVisible = null;
    let crosshairActive = null;

    function setHint(text, active) {
        if (hintText !== text) {
            hintText = text;
            elements.hint.textContent = text;
        }
        const visible = Boolean(text);
        if (hintVisible !== visible) {
            hintVisible = visible;
            elements.hint.classList.toggle('visible', visible);
        }
        const isActive = Boolean(active);
        if (crosshairActive !== isActive) {
            crosshairActive = isActive;
            elements.crosshair.classList.toggle('active', isActive);
        }
    }

    function slotInfo(entry) {
        if (!entry) {
            return { icon: '', label: '空格子', cls: 'empty' };
        }
        if (entry.kind === 'ingredient') {
            const item = ingredient(entry.id);
            const chopped = entry.chopped === true;
            return {
                icon: item ? item.emoji : '?',
                label: (item ? item.name : entry.id) + (chopped ? '（已切碎）' : (needsChopping(entry.id) ? '（要切碎）' : '')),
                cls: chopped ? 'chopped' : 'raw'
            };
        }
        if (entry.kind === 'plate') {
            return { icon: '🍽', label: '干净盘子', cls: 'plate' };
        }
        if (entry.kind === 'dirtyPlate') {
            return { icon: '🍽', label: '脏盘子', cls: 'dirty' };
        }
        const item = recipe(entry.recipeId);
        return { icon: item ? item.emoji : '🍲', label: item ? item.name : '料理', cls: 'dish' };
    }

    function updateTray(tray, selected = 0) {
        let filled = 0;
        slotButtons.forEach((slot, index) => {
            const entry = tray[index] || null;
            const info = slotInfo(entry);
            if (entry) {
                filled += 1;
            }
            const classes = ['hotbar-slot', info.cls];
            if (index === selected) {
                classes.push('selected');
            }
            slot.button.className = classes.join(' ');
            slot.icon.textContent = info.icon;
            slot.button.title = info.label;
        });
        if (elements.hotbarStatus) {
            elements.hotbarStatus.textContent = filled === 0 ? '空' : filled + '/' + TRAY_SIZE;
        }
    }

    function handLabel(hand) {
        const info = slotInfo(hand);
        return hand ? info.icon + ' ' + info.label : '空手';
    }

    function updateHand(hand) {
        elements.hand.textContent = '手上：' + handLabel(hand);
        elements.hand.classList.toggle('holding', Boolean(hand));
        elements.hand.classList.toggle('dirty', Boolean(hand && hand.kind === 'dirtyPlate'));
    }

    function refreshStats() {
        const data = progress();
        elements.stats.textContent = '食材 ' + data.ingredients + '/' + data.ingredientTotal + ' · 料理 ' + data.recipes + '/' + data.recipeTotal + ' · 已品尝 ' + data.eaten;
    }

    function updateProgress(info) {
        const key = info.level + '|' + Math.round(info.ratio * 100);
        if (key === expKey) {
            return;
        }
        expKey = key;
        elements.level.textContent = 'Lv.' + info.level;
        elements.expBar.style.width = (info.ratio * 100).toFixed(1) + '%';
        elements.level.title = info.end > info.start
            ? '再得 ' + info.toNext + ' 经验升级'
            : '已满级，继续做菜也有奖励';
        elements.expBar.classList.toggle('full', info.end <= info.start);
    }

    function updateDaily(daily, doneIds, streak, day = 1) {
        const key = day + '|' + streak + '|' + daily.join(',') + '|' + doneIds.join(',');
        if (key === dailyKey) {
            return;
        }
        dailyKey = key;
        const rows = daily.filter(id => recipe(id) !== undefined);
        elements.dailyList.replaceChildren(...rows.map(id => {
            const item = recipe(id);
            const row = document.createElement('div');
            row.className = 'daily-row' + (doneIds.includes(id) ? ' done' : '');
            const emoji = document.createElement('span');
            emoji.className = 'daily-emoji';
            emoji.textContent = item.emoji;
            const name = document.createElement('span');
            name.className = 'daily-name';
            name.textContent = item.name;
            const check = document.createElement('span');
            check.className = 'daily-check';
            check.textContent = doneIds.includes(id) ? '✓' : '·';
            row.append(emoji, name, check);
            return row;
        }));
        const doneCount = rows.filter(id => doneIds.includes(id)).length;
        const dayTag = day > 1 ? '第 ' + day + ' 天 · ' : '';
        elements.dailyTitle.textContent = dayTag + '今日菜单 ' + doneCount + '/' + rows.length + (streak > 1 ? ' · 连击 x' + streak : '');
        elements.daily.classList.toggle('all-done', rows.length > 0 && doneCount === rows.length);
    }

    function startAction({ label, duration, onDone }) {
        action = { label, duration, elapsed: 0, onDone };
        actionStep = 0;
        elements.actionLabel.textContent = label;
        elements.action.classList.remove('hidden');
        elements.actionBar.style.transform = 'scaleX(0)';
    }

    function cancelAction() {
        if (!action) {
            return;
        }
        action = null;
        elements.action.classList.add('hidden');
    }

    function busy() {
        return action !== null;
    }

    function tickAction(delta) {
        if (!action) {
            return;
        }
        action.elapsed += delta;
        const ratio = Math.min(action.elapsed / action.duration, 1);
        const step = Math.round(ratio * 500) / 500;
        if (step !== actionStep) {
            actionStep = step;
            elements.actionBar.style.transform = 'scaleX(' + step + ')';
        }
        if (ratio >= 1) {
            const done = action.onDone;
            action = null;
            elements.action.classList.add('hidden');
            if (done) {
                done();
            }
        }
    }

    function toast(message) {
        const node = document.createElement('div');
        node.className = 'toast';
        node.textContent = message;
        elements.toasts.appendChild(node);
        while (elements.toasts.childElementCount > MAX_TOASTS) {
            elements.toasts.firstElementChild.remove();
        }
        window.setTimeout(() => node.classList.add('out'), 2100);
        window.setTimeout(() => node.remove(), 2700);
    }

    return {
        show,
        setHint,
        updateTray,
        updateHand,
        refreshStats,
        updateProgress,
        updateDaily,
        startAction,
        cancelAction,
        busy,
        tickAction,
        toast
    };
}
