let context = null;
let master = null;
let noiseBuffer = null;
let muted = false;
const MASTER_VOLUME = 0.42;

function audioContext() {
    if (context) {
        return context;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
        return null;
    }
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(context.destination);
    const length = Math.floor(context.sampleRate * 0.6);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
    }
    return context;
}

export function resumeAudio() {
    const ctx = audioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }
}

export function toggleMute() {
    muted = !muted;
    if (master) {
        master.gain.value = muted ? 0 : MASTER_VOLUME;
    }
    return muted;
}

export function isMuted() {
    return muted;
}

function tone({ freq, to, type = 'sine', duration = 0.18, volume = 0.18, delay = 0, attack = 0.012 }) {
    const ctx = audioContext();
    if (!ctx || muted) {
        return;
    }
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
}

function noise({ duration = 0.2, volume = 0.2, freq = 1400, q = 0.8, delay = 0, sweepTo, type = 'bandpass' }) {
    const ctx = audioContext();
    if (!ctx || muted) {
        return;
    }
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    filter.Q.value = q;
    if (sweepTo) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 20), start + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.03);
}

export const sfx = {
    click() {
        tone({ freq: 720, to: 900, type: 'triangle', duration: 0.08, volume: 0.1 });
    },
    chop(step) {
        noise({ duration: 0.08, volume: 0.3, freq: 2800 - step * 400, q: 0.7, sweepTo: 900 });
        tone({ freq: 420 - step * 40, to: 200, type: 'triangle', duration: 0.07, volume: 0.1 });
    },
    chopped() {
        noise({ duration: 0.16, volume: 0.26, freq: 2200, q: 0.6, sweepTo: 600 });
        tone({ freq: 660, to: 990, type: 'triangle', duration: 0.16, volume: 0.12 });
    },
    pick() {
        tone({ freq: 880, to: 1320, type: 'sine', duration: 0.12, volume: 0.12 });
    },
    plate() {
        tone({ freq: 1240, type: 'sine', duration: 0.2, volume: 0.14 });
        tone({ freq: 1860, type: 'sine', duration: 0.14, volume: 0.06, delay: 0.02 });
    },
    serve() {
        tone({ freq: 520, to: 780, type: 'triangle', duration: 0.22, volume: 0.13 });
        tone({ freq: 1040, type: 'sine', duration: 0.24, volume: 0.07, delay: 0.06 });
    },
    cook() {
        noise({ duration: 0.6, volume: 0.24, freq: 600, q: 0.5, sweepTo: 2400 });
        tone({ freq: 300, to: 520, type: 'sawtooth', duration: 0.4, volume: 0.05 });
    },
    sizzle() {
        noise({ duration: 1.7, volume: 0.09, freq: 1500, q: 0.45, sweepTo: 820 });
        noise({ duration: 0.9, volume: 0.05, freq: 3400, q: 1.1, delay: 0.2, sweepTo: 1600 });
    },
    drop() {
        noise({ duration: 0.16, volume: 0.17, freq: 1900, q: 0.7, sweepTo: 700 });
        tone({ freq: 320, to: 175, type: 'sine', duration: 0.13, volume: 0.09 });
    },
    toss() {
        noise({ duration: 0.34, volume: 0.2, freq: 700, q: 0.5, sweepTo: 2100 });
        tone({ freq: 260, to: 470, type: 'triangle', duration: 0.22, volume: 0.08 });
    },
    eat() {
        [0, 0.14, 0.28].forEach((delay, index) => {
            tone({ freq: 620 + index * 90, to: 460 + index * 60, type: 'triangle', duration: 0.12, volume: 0.1, delay });
        });
    },
    eatDone() {
        [0, 0.1, 0.2].forEach((delay, index) => {
            tone({ freq: [784, 988, 1318][index], type: 'sine', duration: 0.26, volume: 0.11, delay });
        });
    },
    wash() {
        noise({ duration: 1.1, volume: 0.16, freq: 900, q: 0.4, sweepTo: 2600 });
        noise({ duration: 0.5, volume: 0.12, freq: 3200, q: 1.2, delay: 0.1, sweepTo: 1400 });
    },
    washDone() {
        tone({ freq: 1100, to: 1650, type: 'sine', duration: 0.3, volume: 0.12 });
    },
    sprite() {
        tone({ freq: 1568, type: 'sine', duration: 0.16, volume: 0.07 });
    },
    daily() {
        [0, 0.1].forEach((delay, index) => {
            tone({ freq: index === 0 ? 988 : 1318, type: 'sine', duration: 0.24, volume: 0.11, delay });
        });
    },
    levelUp() {
        [0, 0.12, 0.24, 0.38].forEach((delay, index) => {
            tone({ freq: [523, 659, 784, 1046][index], type: 'triangle', duration: 0.42, volume: 0.13, delay });
        });
        tone({ freq: 261, type: 'sine', duration: 0.8, volume: 0.06, delay: 0.2 });
    },
    deny() {
        tone({ freq: 240, to: 170, type: 'square', duration: 0.14, volume: 0.07 });
    },
    // 脚步：木地板上的一声闷响，左右脚用轻微的音高差区分
    step(soft = false, flip = false) {
        const volume = soft ? 0.028 : 0.048;
        const base = (flip ? 1.12 : 0.94) * (soft ? 0.86 : 1);
        noise({ duration: 0.075, volume: volume * 0.9, freq: 620 * base, q: 0.8, sweepTo: 190 * base });
        tone({ freq: 150 * base, to: 58, type: 'sine', duration: 0.095, volume: volume, attack: 0.004 });
        tone({ freq: 320 * base, to: 140, type: 'triangle', duration: 0.05, volume: volume * 0.35, attack: 0.003 });
    }
};
