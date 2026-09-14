const active = [];

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function tween({ duration = 0.3, delay = 0, ease = easeOutCubic, onUpdate, onDone }) {
    const entry = {
        time: -delay,
        duration: Math.max(duration, 0.0001),
        ease,
        onUpdate,
        onDone
    };
    active.push(entry);
    return entry;
}

export function updateTweens(delta) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
        const entry = active[i];
        entry.time += delta;
        if (entry.time < 0) {
            continue;
        }
        const t = Math.min(entry.time / entry.duration, 1);
        if (entry.onUpdate) {
            entry.onUpdate(entry.ease(t), t);
        }
        if (t >= 1) {
            active.splice(i, 1);
            if (entry.onDone) {
                entry.onDone();
            }
        }
    }
}

export function tweenCount() {
    return active.length;
}

export function arcTo(from, to, height, { duration = 0.4, ease = easeOutCubic, onUpdate, onDone }) {
    const start = from.clone();
    const end = to.clone();
    const control = start.clone().lerp(end, 0.5);
    control.y += height;
    return tween({
        duration,
        ease,
        onUpdate: (eased, raw) => {
            const a = start.clone().lerp(control, eased);
            const b = control.clone().lerp(end, eased);
            if (onUpdate) {
                onUpdate(a.lerp(b, eased), raw);
            }
        },
        onDone
    });
}
