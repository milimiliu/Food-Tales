import * as THREE from 'three';
import { box, mat } from './palette.js';
import { recipe } from '../data/recipes.js';

const BOARD_WIDTH = 1.08;
const BOARD_HEIGHT = 0.74;

export function createMenuBoard() {
    const root = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 370;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    root.add(box(BOARD_WIDTH + 0.09, BOARD_HEIGHT + 0.09, 0.05, mat(0x8d5c30, { roughness: 0.78 }), [0, 0, 0]));
    root.add(box(BOARD_WIDTH + 0.03, BOARD_HEIGHT + 0.03, 0.06, mat(0xb0763f, { roughness: 0.82 }), [0, 0, 0.005]));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT), new THREE.MeshBasicMaterial({ map: texture }));
    face.position.z = 0.04;
    root.add(face);
    root.add(box(0.05, 0.05, 0.05, mat(0x2c2c30, { roughness: 0.6 }), [0, BOARD_HEIGHT / 2 + 0.06, 0]));

    const context = canvas.getContext('2d');

    function roundRect(x, y, width, height, radius) {
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
    }

    function draw(daily, doneIds, day = 1) {
        context.fillStyle = '#3b2c1e';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#6b4a2c';
        for (let i = 0; i < 46; i += 1) {
            context.fillRect(0, i * 8 + 2, canvas.width, 1);
        }
        context.fillStyle = '#ffe0b3';
        context.font = 'bold 40px "Microsoft YaHei", "PingFang SC", sans-serif';
        context.textAlign = 'center';
        context.fillText('今日菜单', canvas.width / 2, 62);
        context.fillStyle = 'rgba(255, 224, 179, 0.4)';
        context.fillRect(48, 82, canvas.width - 96, 2);
        context.fillStyle = '#ffb672';
        context.font = 'bold 25px "Microsoft YaHei", "PingFang SC", sans-serif';
        context.textAlign = 'right';
        context.fillText('第 ' + day + ' 天', canvas.width - 48, 60);
        context.textAlign = 'center';

        const rows = (daily.length > 0 ? daily : []).filter(id => recipe(id) !== undefined);
        rows.forEach((id, index) => {
            const item = recipe(id);
            const top = 104 + index * 86;
            const done = doneIds.includes(id);
            context.fillStyle = done ? 'rgba(120, 200, 130, 0.22)' : 'rgba(255, 255, 255, 0.07)';
            roundRect(40, top, canvas.width - 80, 72, 16);
            context.fill();
            context.textAlign = 'left';
            context.font = '38px "Microsoft YaHei", "PingFang SC", sans-serif';
            context.fillText(item.emoji, 62, top + 50);
            context.fillStyle = done ? '#c9f0c9' : '#ffe9cf';
            context.font = 'bold 32px "Microsoft YaHei", "PingFang SC", sans-serif';
            context.fillText(item.name, 122, top + 48);
            context.textAlign = 'right';
            context.font = 'bold 38px "Microsoft YaHei", "PingFang SC", sans-serif';
            context.fillStyle = done ? '#7fd48a' : 'rgba(255, 233, 207, 0.45)';
            context.fillText(done ? '✓' : '○', canvas.width - 62, top + 49);
            context.textAlign = 'left';
            context.fillStyle = '#ffe9cf';
        });
        const doneCount = rows.filter(id => doneIds.includes(id)).length;
        context.textAlign = 'center';
        context.font = '24px "Microsoft YaHei", "PingFang SC", sans-serif';
        context.fillStyle = 'rgba(255, 224, 179, 0.72)';
        context.fillText(rows.length > 0 ? doneCount + ' / ' + rows.length + ' 已完成' : '等待开门营业', canvas.width / 2, canvas.height - 22);
        texture.needsUpdate = true;
    }

    draw([], [], 1);

    return { root, draw };
}
