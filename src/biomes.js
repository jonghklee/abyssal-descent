// ============================================
// BIOMES - Floor theme system with unique visuals
// ============================================

const BIOME_DEFS = {
    crypt: {
        name: 'Ancient Crypt',
        floors: [1, 4],
        floorColor: [38, 38, 52],
        wallColor: '#4a4a5a',
        wallAccent: '#5a5a6a',
        ambientColor: 'rgba(100, 130, 180, 0.03)',
        fogColor: 'rgba(20, 20, 40, 0.65)',
        torchColor: '#ff6600',
        enemyTypes: ['slime', 'skeleton', 'bat'],
        music: 'crypt',
        particleColor: '#546e7a',
        waterColor: [26, 58, 90],
    },
    inferno: {
        name: 'Infernal Depths',
        floors: [5, 9],
        floorColor: [52, 30, 28],
        wallColor: '#5a3a3a',
        wallAccent: '#6a4a4a',
        ambientColor: 'rgba(255, 100, 50, 0.04)',
        fogColor: 'rgba(40, 15, 10, 0.6)',
        torchColor: '#ff3300',
        enemyTypes: ['skeleton', 'zombie', 'mage', 'bat'],
        music: 'inferno',
        particleColor: '#ff6d00',
        waterColor: [90, 30, 10], // Lava-like
        hasLavaParticles: true,
    },
    void: {
        name: 'The Void',
        floors: [10, 14],
        floorColor: [25, 20, 45],
        wallColor: '#3a2a5a',
        wallAccent: '#4a3a6a',
        ambientColor: 'rgba(120, 80, 255, 0.05)',
        fogColor: 'rgba(15, 10, 30, 0.7)',
        torchColor: '#7c4dff',
        enemyTypes: ['ghost', 'mage', 'knight', 'bat'],
        music: 'void',
        particleColor: '#7c4dff',
        waterColor: [40, 20, 80],
        hasVoidParticles: true,
    },
    abyss: {
        name: 'The Abyss',
        floors: [15, 19],
        floorColor: [15, 15, 20],
        wallColor: '#2a2a3a',
        wallAccent: '#3a3a4a',
        ambientColor: 'rgba(255, 20, 60, 0.04)',
        fogColor: 'rgba(10, 5, 15, 0.75)',
        torchColor: '#ff1744',
        enemyTypes: ['ghost', 'mage', 'knight', 'zombie'],
        music: 'abyss',
        particleColor: '#ff1744',
        waterColor: [50, 10, 20],
        hasAbyssParticles: true,
    },
    heaven: {
        name: 'Celestial Ruins',
        floors: [20, 99],
        floorColor: [45, 45, 55],
        wallColor: '#6a6a7a',
        wallAccent: '#8a8a9a',
        ambientColor: 'rgba(255, 255, 200, 0.06)',
        fogColor: 'rgba(30, 30, 40, 0.5)',
        torchColor: '#fff9c4',
        enemyTypes: ['knight', 'mage', 'ghost'],
        music: 'heaven',
        particleColor: '#fff9c4',
        waterColor: [60, 70, 100],
        hasHolyParticles: true,
    },
};

class BiomeSystem {
    constructor() {
        this.current = null;
        this.transitionTimer = 0;
        this.ambientParticles = [];
    }

    getBiome(floor) {
        for (const [id, biome] of Object.entries(BIOME_DEFS)) {
            if (floor >= biome.floors[0] && floor <= biome.floors[1]) {
                return { id, ...biome };
            }
        }
        return { id: 'crypt', ...BIOME_DEFS.crypt };
    }

    setFloor(floor) {
        const newBiome = this.getBiome(floor);
        if (!this.current || this.current.id !== newBiome.id) {
            this.current = newBiome;
            this.transitionTimer = 2;
        }
    }

    update(dt, camera) {
        if (this.transitionTimer > 0) this.transitionTimer -= dt;

        // Ambient particles based on biome
        if (this.current && Math.random() < 0.15) {
            const cx = camera.x + Utils.rand(-camera.halfW, camera.halfW);
            const cy = camera.y + Utils.rand(-camera.halfH, camera.halfH);

            if (this.current.hasLavaParticles) {
                this.ambientParticles.push({
                    x: cx, y: cy,
                    vy: Utils.rand(-0.8, -0.2),
                    vx: Utils.rand(-0.2, 0.2),
                    life: Utils.rand(1, 3),
                    maxLife: 3,
                    size: Utils.rand(1, 3),
                    color: Utils.randChoice(['#ff6d00', '#ff3d00', '#ff9100']),
                });
            } else if (this.current.hasVoidParticles) {
                this.ambientParticles.push({
                    x: cx, y: cy,
                    vy: Utils.rand(-0.3, 0.3),
                    vx: Utils.rand(-0.3, 0.3),
                    life: Utils.rand(2, 5),
                    maxLife: 5,
                    size: Utils.rand(1, 2),
                    color: Utils.randChoice(['#7c4dff', '#b388ff', '#ea80fc']),
                });
            } else if (this.current.hasAbyssParticles) {
                this.ambientParticles.push({
                    x: cx, y: cy,
                    vy: Utils.rand(0.1, 0.5),
                    vx: Utils.rand(-0.1, 0.1),
                    life: Utils.rand(1, 4),
                    maxLife: 4,
                    size: Utils.rand(1, 2),
                    color: Utils.randChoice(['#ff1744', '#d50000', '#b71c1c']),
                });
            } else if (this.current.hasHolyParticles) {
                this.ambientParticles.push({
                    x: cx, y: cy,
                    vy: Utils.rand(-0.5, -0.1),
                    vx: Utils.rand(-0.1, 0.1),
                    life: Utils.rand(2, 5),
                    maxLife: 5,
                    size: Utils.rand(1, 3),
                    color: Utils.randChoice(['#fff9c4', '#fff176', '#ffee58']),
                });
            }
        }

        // Update ambient particles
        for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
            const p = this.ambientParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;
            if (p.life <= 0) this.ambientParticles.splice(i, 1);
        }

        // Cap particles
        if (this.ambientParticles.length > 100) {
            this.ambientParticles.splice(0, this.ambientParticles.length - 100);
        }
    }

    drawAmbient(ctx) {
        for (const p of this.ambientParticles) {
            const alpha = Math.min(p.life / p.maxLife, 1) * 0.4;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawBiomeName(ctx, w, h) {
        if (!this.current || this.transitionTimer <= 0) return;
        const alpha = Math.min(this.transitionTimer / 1, 1);
        ctx.globalAlpha = alpha * 0.8;
        ctx.textAlign = 'center';
        ctx.fillStyle = this.current.particleColor;
        ctx.font = '12px monospace';
        ctx.fillText(`~ ${this.current.name} ~`, w / 2, 110);
        ctx.globalAlpha = 1;
    }

    getFloorColor(tx, ty) {
        if (!this.current) return [38, 38, 52];
        const c = this.current.floorColor;
        const v = ((tx * 7 + ty * 13) % 5) * 2;
        return [c[0] + v, c[1] + v, c[2] + v];
    }

    getFogColor() {
        return this.current ? this.current.fogColor : 'rgba(0,0,0,0.65)';
    }
}
