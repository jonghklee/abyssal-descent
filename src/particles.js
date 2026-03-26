// ============================================
// PARTICLES - Visual effects system
// ============================================

class Particle {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.vx = opts.vx || 0;
        this.vy = opts.vy || 0;
        this.ax = opts.ax || 0;
        this.ay = opts.ay || 0;
        this.life = opts.life || 1;
        this.maxLife = this.life;
        this.size = opts.size || 3;
        this.endSize = opts.endSize ?? 0;
        this.color = opts.color || '#fff';
        this.endColor = opts.endColor || null;
        this.shape = opts.shape || 'circle'; // circle, square, star, line
        this.rotation = opts.rotation || 0;
        this.rotSpeed = opts.rotSpeed || 0;
        this.friction = opts.friction ?? 0.98;
        this.gravity = opts.gravity || 0;
        this.glow = opts.glow || false;
        this.glowSize = opts.glowSize || 10;
        this.trail = opts.trail || false;
        this.trailLength = opts.trailLength || 5;
        this.trailHistory = [];
        this.alive = true;
        this.alpha = opts.alpha ?? 1;
        this.fadeStyle = opts.fadeStyle || 'linear'; // linear, late, early
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.alive = false;
            return;
        }

        if (this.trail) {
            this.trailHistory.unshift({ x: this.x, y: this.y });
            if (this.trailHistory.length > this.trailLength) {
                this.trailHistory.pop();
            }
        }

        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.vy += this.gravity * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.rotation += this.rotSpeed * dt;
    }

    draw(ctx) {
        const t = 1 - this.life / this.maxLife;
        let alpha;
        switch (this.fadeStyle) {
            case 'late': alpha = this.alpha * (1 - Math.pow(t, 3)); break;
            case 'early': alpha = this.alpha * (1 - t); break;
            default: alpha = this.alpha * (1 - t);
        }

        const size = Utils.lerp(this.size, this.endSize, t);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.glow) {
            ctx.shadowBlur = this.glowSize * (1 - t);
            ctx.shadowColor = this.color;
        }

        // Trail
        if (this.trail && this.trailHistory.length > 1) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let i = 0; i < this.trailHistory.length; i++) {
                const p = this.trailHistory[i];
                ctx.lineTo(p.x - this.x, p.y - this.y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = size * 0.5 * (1 - t);
            ctx.stroke();
        }

        ctx.fillStyle = this.color;

        switch (this.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'square':
                ctx.fillRect(-size, -size, size * 2, size * 2);
                break;
            case 'star':
                this.drawStar(ctx, size);
                break;
            case 'line':
                ctx.strokeStyle = this.color;
                ctx.lineWidth = size * 0.3;
                ctx.beginPath();
                ctx.moveTo(-size, 0);
                ctx.lineTo(size, 0);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    drawStar(ctx, size) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const method = i === 0 ? 'moveTo' : 'lineTo';
            ctx[method](Math.cos(angle) * size, Math.sin(angle) * size);
        }
        ctx.closePath();
        ctx.fill();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 1500; // Performance cap
    }

    add(particle) {
        if (this.particles.length < this.maxParticles) {
            this.particles.push(particle);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].alive) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }

    clear() {
        this.particles = [];
    }

    // ---- Effect presets ----

    bloodSplatter(x, y, angle, count = 15) {
        for (let i = 0; i < count; i++) {
            const spread = Utils.rand(-0.8, 0.8);
            const speed = Utils.rand(2, 8);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                life: Utils.rand(0.3, 0.8),
                size: Utils.rand(1, 4),
                endSize: 0,
                color: Utils.randChoice(['#ff1744', '#d50000', '#b71c1c', '#ff5252']),
                gravity: Utils.rand(0.1, 0.3),
                friction: 0.95,
            }));
        }
    }

    hitSpark(x, y, color = '#ffeb3b', count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(3, 10);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Utils.rand(0.1, 0.3),
                size: Utils.rand(1, 3),
                endSize: 0,
                color: color,
                shape: 'line',
                rotation: angle,
                friction: 0.92,
                glow: true,
                glowSize: 8,
            }));
        }
    }

    explosion(x, y, color = '#ff6600', count = 30) {
        // Core flash
        this.add(new Particle(x, y, {
            life: 0.15,
            size: 30,
            endSize: 60,
            color: '#fff',
            glow: true,
            glowSize: 30,
            fadeStyle: 'early',
        }));

        // Debris
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(2, 12);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Utils.rand(0.3, 1.0),
                size: Utils.rand(2, 6),
                endSize: 0,
                color: Utils.randChoice([color, '#ff9800', '#ffeb3b', '#fff']),
                gravity: Utils.rand(0.05, 0.2),
                friction: 0.96,
                glow: true,
                glowSize: 6,
                trail: true,
                trailLength: 4,
            }));
        }

        // Smoke
        for (let i = 0; i < 10; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(0.5, 3);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: Utils.rand(0.5, 1.5),
                size: Utils.rand(5, 15),
                endSize: Utils.rand(20, 40),
                color: 'rgba(100,100,100,0.3)',
                friction: 0.97,
                fadeStyle: 'late',
            }));
        }
    }

    dustPuff(x, y, count = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(0.3, 1.5);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5,
                life: Utils.rand(0.3, 0.6),
                size: Utils.rand(2, 5),
                endSize: Utils.rand(6, 12),
                color: 'rgba(180,170,150,0.3)',
                friction: 0.96,
            }));
        }
    }

    levelUpEffect(x, y) {
        for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const speed = Utils.rand(3, 8);
            this.add(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Utils.rand(0.5, 1.2),
                size: Utils.rand(2, 4),
                endSize: 0,
                color: Utils.randChoice(['#64ffda', '#00e5ff', '#18ffff', '#fff']),
                glow: true,
                glowSize: 10,
                trail: true,
                trailLength: 6,
                friction: 0.94,
            }));
        }

        // Central burst
        this.add(new Particle(x, y, {
            life: 0.4,
            size: 10,
            endSize: 80,
            color: 'rgba(100,255,218,0.4)',
            glow: true,
            glowSize: 40,
        }));
    }

    itemPickup(x, y, color = '#ffd740') {
        for (let i = 0; i < 12; i++) {
            this.add(new Particle(x, y, {
                vx: Utils.rand(-1, 1),
                vy: Utils.rand(-3, -1),
                life: Utils.rand(0.4, 0.8),
                size: Utils.rand(1, 3),
                endSize: 0,
                color: color,
                shape: 'star',
                rotSpeed: Utils.rand(-5, 5),
                glow: true,
                glowSize: 6,
            }));
        }
    }

    damageNumber(x, y, text, color = '#ff1744') {
        // This will be handled by the UI system
        return { x, y, text, color, life: 1.0, vy: -2 };
    }

    portalEffect(x, y) {
        for (let i = 0; i < 3; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const dist = Utils.rand(10, 30);
            this.add(new Particle(
                x + Math.cos(angle) * dist,
                y + Math.sin(angle) * dist, {
                vx: Math.cos(angle + Math.PI / 2) * 1,
                vy: Math.sin(angle + Math.PI / 2) * 1 - 0.5,
                life: Utils.rand(0.3, 0.8),
                size: Utils.rand(2, 4),
                endSize: 0,
                color: Utils.randChoice(['#7c4dff', '#b388ff', '#ea80fc', '#e040fb']),
                glow: true,
                glowSize: 8,
            }));
        }
    }

    torchFlicker(x, y) {
        if (Math.random() > 0.3) return;
        this.add(new Particle(x + Utils.rand(-3, 3), y, {
            vx: Utils.rand(-0.3, 0.3),
            vy: Utils.rand(-1.5, -0.5),
            life: Utils.rand(0.2, 0.5),
            size: Utils.rand(1, 3),
            endSize: 0,
            color: Utils.randChoice(['#ff6d00', '#ff9100', '#ffab00', '#ffd740']),
            glow: true,
            glowSize: 6,
        }));
    }

    trailEffect(x, y, color = '#64ffda') {
        this.add(new Particle(x, y, {
            life: Utils.rand(0.1, 0.3),
            size: Utils.rand(1, 3),
            endSize: 0,
            color: color,
            glow: true,
            glowSize: 4,
        }));
    }
}

const particles = new ParticleSystem();
