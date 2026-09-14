import { needsChopping } from '../data/ingredients.js';
import { recipeOf } from '../data/recipes.js';

export function cook(tray) {
    if (tray.length === 0) {
        return { ok: false, reason: 'empty' };
    }
    const pending = tray.filter(entry => !entry.chopped && needsChopping(entry.id));
    if (pending.length > 0) {
        return { ok: false, reason: 'unchopped', pending: pending.map(entry => entry.id) };
    }
    const recipe = recipeOf(tray.map(entry => entry.id));
    if (!recipe) {
        return { ok: false, reason: 'nomatch' };
    }
    return { ok: true, recipe };
}
