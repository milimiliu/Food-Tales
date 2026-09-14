import * as THREE from 'three';
import { easeOutCubic } from './tween.js';

const SHAPES = {
    crumb: () => new THREE.BoxGeometry(0.024, 0.024, 0.024),
    steam: () => new THREE.SphereGeometry(0.05, 6, 5),
    spark: () => new THREE.OctahedronGeometry(0.022, 0),
    ring: () => new THREE.TorusGeometry(0.13, 0.014, 6, 20)
};

const MAX_PARTICLES = 96;
const MAX_LABELS = 12;

export function createFx(scene, camera) {
    const root = new THREE.Group();
    scene.add(root);
    const layer = document.getElementById('floaters');
    const particles = [];
    const labels = [];
    const labelPool = [];
    const shapes = new Map();
    const pools = new Map();
    const labelPoint = new THREE.Vector3();
    let created = 0;
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;

    window.addEventListener('resize', () => {
        viewW = window.innerWidth;
        viewH = window.innerHeight;
    });

    function shape(name) {
        if (!shapes.has(name)) {
            shapes.set(name, SHAPES[name]());
        }
        return shapes.get(name);
    }

    function acquire(name, color, opacity) {
        let pool = pools.get(name);
        if (!pool) {
            pool = [];
            pools.set(name, pool);
        }
        let entry = null;
        if (pool.length > 0) {
            entry = pool.pop();
        } else if (created < MAX_PARTICLES) {
            created += 1;
            const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
            const mesh = new THREE.Mesh(shape(name), material);
            mesh.visible = false;
            root.add(mesh);
            entry = { mesh, material, pool: name, velocity: new THREE.Vector3(), gravity: 0, life: 0, ttl: 1, from: 1, to: 1, opacity: 1, spin: 0 };
        } else {
            for (const list of pools.values()) {
                if (list.length > 0) {
                    entry = list.pop();
                    break;
                }
            }
            if (!entry && particles.length > 0) {
                entry = particles.shift();
            }
            if (!entry) {
                return null;
            }
            entry.mesh.visible = false;
        }
        entry.material.color.setHex(color);
        entry.material.opacity = opacity;
        entry.mesh.visible = true;
        return entry;
    }

    function burst(name, position, options = {}) {
        const {
            color = 0xffffff,
            count = 8,
            speed = 1.1,
            spread = 1,
            duration = 0.72,
            gravity = 4.2,
            from = 1,
            to = 0.35,
            opacity = 1,
            spin = 6,
            lift = 0.3,
            radius = 0
        } = options;
        for (let i = 0; i < count; i += 1) {
            const entry = acquire(name, color, opacity);
            if (!entry) {
                continue;
            }
            const mesh = entry.mesh;
            mesh.position.copy(position);
            if (radius > 0) {
                const angle = Math.random() * Math.PI * 2;
                mesh.position.x += Math.cos(angle) * radius;
                mesh.position.z += Math.sin(angle) * radius;
            }
            mesh.scale.setScalar(from);
            entry.velocity.set(
                (Math.random() - 0.5) * spread,
                lift + Math.random() * spread * 0.6,
                (Math.random() - 0.5) * spread
            ).normalize().multiplyScalar(speed * (0.6 + Math.random() * 0.8));
            entry.gravity = gravity * (0.7 + Math.random() * 0.6);
            entry.life = 0;
            entry.ttl = duration * (0.75 + Math.random() * 0.5);
            entry.from = from;
            entry.to = to;
            entry.opacity = opacity;
            entry.spin = spin;
            particles.push(entry);
        }
    }

    function crumbs(position, color) {
        burst('crumb', position, { color, count: 9, speed: 1.5, spread: 1.1, duration: 0.62, gravity: 6, lift: 0.5, to: 0.3 });
    }

    function steam(position, count = 6) {
        burst('steam', position, { color: 0xffffff, count, speed: 0.34, spread: 0.32, duration: 1.5, gravity: -0.35, lift: 0.9, from: 0.5, to: 1.5, opacity: 0.32, spin: 0.6, radius: 0.03 });
    }

    function spark(position, color = 0xffd98a, count = 7) {
        burst('spark', position, { color, count, speed: 1.1, spread: 1, duration: 0.5, gravity: 2.4, lift: 0.8, from: 1.1, to: 0.2 });
    }

    function ring(position, color = 0xffc46b) {
        burst('ring', position, { color, count: 1, speed: 0.05, spread: 0.1, duration: 0.44, gravity: 0, lift: 0, from: 0.5, to: 2.1, opacity: 0.75, spin: 0 });
    }

    function acquireLabel() {
        if (labelPool.length > 0) {
            return labelPool.pop();
        }
        return { node: document.createElement('div'), point: new THREE.Vector3(), life: 0, ttl: 1.5, rise: 0.42 };
    }

    function releaseLabel(entry) {
        entry.node.remove();
        labelPool.push(entry);
    }

    function text(position, content, kind = '') {
        if (!layer) {
            return;
        }
        if (labels.length >= MAX_LABELS) {
            releaseLabel(labels.shift());
        }
        const entry = acquireLabel();
        entry.node.className = kind ? 'floater ' + kind : 'floater';
        entry.node.textContent = content;
        entry.node.style.opacity = '1';
        entry.point.copy(position);
        entry.life = 0;
        entry.ttl = 1.5;
        entry.rise = 0.42;
        if (entry.node.parentNode !== layer) {
            layer.appendChild(entry.node);
        }
        labels.push(entry);
    }

    function update(delta) {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const entry = particles[i];
            entry.life += delta;
            const t = Math.min(entry.life / entry.ttl, 1);
            entry.velocity.y -= entry.gravity * delta;
            entry.mesh.position.addScaledVector(entry.velocity, delta);
            if (entry.spin !== 0) {
                entry.mesh.rotation.x += entry.spin * delta;
                entry.mesh.rotation.y += entry.spin * 0.6 * delta;
            }
            entry.mesh.scale.setScalar(entry.from + (entry.to - entry.from) * t);
            entry.material.opacity = entry.opacity * (1 - t);
            if (t >= 1) {
                entry.mesh.visible = false;
                entry.mesh.scale.setScalar(1);
                entry.mesh.rotation.set(0, 0, 0);
                pools.get(entry.pool).push(entry);
                particles.splice(i, 1);
            }
        }
        for (let i = labels.length - 1; i >= 0; i -= 1) {
            const label = labels[i];
            label.life += delta;
            const t = Math.min(label.life / label.ttl, 1);
            labelPoint.copy(label.point);
            labelPoint.y += easeOutCubic(t) * label.rise;
            const projected = labelPoint.project(camera);
            if (projected.z > 1) {
                label.node.style.display = 'none';
            } else {
                label.node.style.display = 'block';
                const x = (projected.x * 0.5 + 0.5) * viewW;
                const y = (-projected.y * 0.5 + 0.5) * viewH;
                label.node.style.transform = 'translate(-50%, -50%) translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
                label.node.style.opacity = String(Math.max(0, 1 - Math.max(0, t - 0.55) * 2.2));
            }
            if (t >= 1) {
                releaseLabel(label);
                labels.splice(i, 1);
            }
        }
    }

    function clear() {
        particles.forEach(entry => {
            entry.mesh.visible = false;
            entry.mesh.scale.setScalar(1);
            pools.get(entry.pool).push(entry);
        });
        particles.length = 0;
        labels.forEach(label => releaseLabel(label));
        labels.length = 0;
    }

    function count() {
        return { particles: particles.length, labels: labels.length };
    }

    return { crumbs, steam, spark, ring, text, burst, update, clear, count };
}
