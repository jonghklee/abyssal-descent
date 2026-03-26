// ============================================
// VFX - Special visual effects (crit cuts, rare drops)
// ============================================

class VFXSystem {
    constructor() {
        this.effects = [];
    }

    update(dt) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].timer += dt;
            if (this.effects[i].timer > this.effects[i].duration) {
                this.effects.splice(i, 1);
            }
        }
    }

    // Screen-cutting critical hit effect
    critSlash(angle) {
        this.effects.push({
            type: 'critSlash',
            angle: angle || Utils.rand(-0.3, 0.3),
            timer: 0,
            duration: 0.4,
            color: '#ffeb3b',
        });
    }

    // Legendary drop beam of light
    legendaryBeam(screenX, screenY) {
        this.effects.push({
            type: 'legendaryBeam',
            x: screenX,
            y: screenY,
            timer: 0,
            duration: 1.5,
            color: '#ff9800',
        });
    }

    // Boss entrance
    bossEntrance() {
        this.effects.push({
            type: 'bossEntrance',
            timer: 0,
            duration: 2.0,
        });
    }

    // Screen crack on massive hit
    screenCrack() {
        this.effects.push({
            type: 'screenCrack',
            timer: 0,
            duration: 0.8,
            cracks: Array.from({ length: Utils.randInt(3, 6) }, () => ({
                x: Utils.rand(0.3, 0.7),
                y: Utils.rand(0.3, 0.7),
                angle: Utils.rand(0, Math.PI * 2),
                length: Utils.rand(0.1, 0.3),
                branches: Utils.randInt(2, 4),
            })),
        });
    }

    // Combo explosion
    comboExplosion() {
        this.effects.push({
            type: 'comboExplosion',
            timer: 0,
            duration: 0.6,
        });
    }

    draw(ctx, w, h) {
        for (const fx of this.effects) {
            const t = fx.timer / fx.duration;

            switch (fx.type) {
                case 'critSlash':
                    this.drawCritSlash(ctx, w, h, fx, t);
                    break;
                case 'legendaryBeam':
                    this.drawLegendaryBeam(ctx, w, h, fx, t);
                    break;
                case 'bossEntrance':
                    this.drawBossEntrance(ctx, w, h, fx, t);
                    break;
                case 'screenCrack':
                    this.drawScreenCrack(ctx, w, h, fx, t);
                    break;
                case 'comboExplosion':
                    this.drawComboExplosion(ctx, w, h, fx, t);
                    break;
            }
        }
    }

    drawCritSlash(ctx, w, h, fx, t) {
        const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(fx.angle);

        // Slash line
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 4 * (1 - t);
        ctx.shadowBlur = 20;
        ctx.shadowColor = fx.color;

        const len = Math.min(t * 5, 1) * w * 0.8;
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();

        // Secondary thinner line
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(-len / 2, -3);
        ctx.lineTo(len / 2, -3);
        ctx.moveTo(-len / 2, 3);
        ctx.lineTo(len / 2, 3);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();

        // "CRITICAL!" text flash
        if (t < 0.5) {
            ctx.globalAlpha = (0.5 - t) / 0.5;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffeb3b';
            ctx.font = 'bold 24px monospace';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffeb3b';
            ctx.fillText('CRITICAL!', w / 2, h / 2 - 30);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    drawLegendaryBeam(ctx, w, h, fx, t) {
        const alpha = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.7) / 0.3);
        const beamWidth = 30 * (1 - t * 0.3);

        ctx.save();
        ctx.globalAlpha = alpha * 0.6;

        // Beam of light from top
        const grad = ctx.createLinearGradient(fx.x, 0, fx.x, h);
        grad.addColorStop(0, 'rgba(255, 152, 0, 0)');
        grad.addColorStop(0.3, `rgba(255, 152, 0, ${alpha * 0.3})`);
        grad.addColorStop(0.5, `rgba(255, 255, 200, ${alpha * 0.5})`);
        grad.addColorStop(0.7, `rgba(255, 152, 0, ${alpha * 0.3})`);
        grad.addColorStop(1, 'rgba(255, 152, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(fx.x - beamWidth / 2, 0, beamWidth, h);

        // Sparkle ring at item position
        const ringR = 20 + t * 40;
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    drawBossEntrance(ctx, w, h, fx, t) {
        if (t > 0.8) return;

        // Red vignette
        const alpha = t < 0.3 ? t / 0.3 : (0.8 - t) / 0.5;
        const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(180, 0, 0, ${alpha * 0.4})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Warning text
        if (t < 0.6) {
            const textAlpha = Math.sin(t * 15) * 0.3 + 0.7;
            ctx.globalAlpha = textAlpha * alpha;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff1744';
            ctx.font = 'bold 36px monospace';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff1744';
            ctx.fillText('⚠ WARNING ⚠', w / 2, h / 2 - 10);
            ctx.font = '16px monospace';
            ctx.fillText('A powerful enemy approaches...', w / 2, h / 2 + 25);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    drawScreenCrack(ctx, w, h, fx, t) {
        const alpha = 1 - t;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        for (const crack of fx.cracks) {
            const cx = crack.x * w;
            const cy = crack.y * h;
            const len = crack.length * w * Math.min(t * 3, 1);

            // Main crack
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
                cx + Math.cos(crack.angle) * len,
                cy + Math.sin(crack.angle) * len
            );
            ctx.stroke();

            // Branches
            for (let b = 0; b < crack.branches; b++) {
                const bStart = Utils.rand(0.2, 0.8);
                const bLen = len * Utils.rand(0.2, 0.5);
                const bAngle = crack.angle + Utils.rand(-0.8, 0.8);
                const bx = cx + Math.cos(crack.angle) * len * bStart;
                const by = cy + Math.sin(crack.angle) * len * bStart;

                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(
                    bx + Math.cos(bAngle) * bLen,
                    by + Math.sin(bAngle) * bLen
                );
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    drawComboExplosion(ctx, w, h, fx, t) {
        const alpha = 1 - t;
        const radius = t * Math.max(w, h) * 0.4;

        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 3 * (1 - t);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ff9800';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
