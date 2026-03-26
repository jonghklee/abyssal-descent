// ============================================
// ASCENSION - Prestige system & Combo Finishers
// ============================================

const ASCENSION_MODIFIERS = [
    { name: 'Tough Enemies',    desc: 'Enemies have +50% HP',       apply: (g) => { g.enemyHpMult = (g.enemyHpMult || 1) * 1.5; } },
    { name: 'Deadly Foes',      desc: 'Enemies deal +30% damage',   apply: (g) => { g.enemyDmgMult = (g.enemyDmgMult || 1) * 1.3; } },
    { name: 'Scarce Potions',   desc: 'Start with 1 potion',        apply: (g) => { g.startPotions = 1; } },
    { name: 'Elite Swarm',      desc: '2x elite spawn chance',      apply: (g) => { g.eliteChanceMult = (g.eliteChanceMult || 1) * 2; } },
    { name: 'Cursed Run',       desc: 'Start with a random curse',  apply: (g) => { g.startCursed = true; } },
    { name: 'Speed Run',        desc: 'Time limit per floor (90s)', apply: (g) => { g.floorTimeLimit = 90; } },
    { name: 'Glass Cannon',     desc: '-50% HP, +50% damage',       apply: (g) => { g.glassCannonMode = true; } },
    { name: 'Chaos Mode',       desc: 'Random events every room',   apply: (g) => { g.chaosMode = true; } },
];

class AscensionSystem {
    constructor() {
        this.level = 0; // 0 = normal, 1+ = ascension levels
        this.maxAscension = 8;
        this.activeModifiers = [];
        this.showScreen = false;
        this.animTimer = 0;
    }

    canAscend() {
        return this.level < this.maxAscension;
    }

    ascend(game) {
        if (!this.canAscend()) return;
        this.level++;

        // Add modifier for this ascension level
        const mod = ASCENSION_MODIFIERS[this.level - 1];
        if (mod) {
            this.activeModifiers.push(mod);
            mod.apply(game);
        }
    }

    applyToEnemy(enemy, game) {
        if (game.enemyHpMult) {
            enemy.maxHp = Math.floor(enemy.maxHp * game.enemyHpMult);
            enemy.hp = enemy.maxHp;
        }
        if (game.enemyDmgMult) {
            enemy.baseAttack = Math.floor(enemy.baseAttack * game.enemyDmgMult);
        }
    }

    applyToPlayer(player, game) {
        if (game.startPotions !== undefined) player.potions = game.startPotions;
        if (game.glassCannonMode) {
            player.maxHp = Math.floor(player.maxHp * 0.5);
            player.hp = player.maxHp;
            player.attack = Math.floor(player.attack * 1.5);
        }
    }

    getRewardMultiplier() {
        return 1 + this.level * 0.5; // +50% rewards per ascension
    }

    showAscensionScreen() {
        this.showScreen = true;
        this.animTimer = 0;
    }

    update(dt) {
        if (this.showScreen) this.animTimer += dt;
    }

    draw(ctx, w, h) {
        if (!this.showScreen) return;

        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#ffd740';
        ctx.font = 'bold 36px monospace';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffd740';
        ctx.fillText('CONGRATULATIONS!', cx, h * 0.15);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#78909c';
        ctx.font = '14px monospace';
        ctx.fillText('You have conquered the dungeon!', cx, h * 0.21);

        // Current ascension
        ctx.fillStyle = '#b388ff';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`Current Ascension: ${this.level}`, cx, h * 0.30);

        // Next modifier preview
        if (this.canAscend()) {
            const nextMod = ASCENSION_MODIFIERS[this.level];
            if (nextMod) {
                ctx.fillStyle = '#ff5252';
                ctx.font = 'bold 14px monospace';
                ctx.fillText(`Next Challenge: ${nextMod.name}`, cx, h * 0.40);
                ctx.fillStyle = '#ef9a9a';
                ctx.font = '12px monospace';
                ctx.fillText(nextMod.desc, cx, h * 0.44);
            }

            // Reward bonus
            const nextMult = 1 + (this.level + 1) * 0.5;
            ctx.fillStyle = '#4caf50';
            ctx.font = '12px monospace';
            ctx.fillText(`Soul Reward: x${nextMult.toFixed(1)}`, cx, h * 0.50);
        }

        // Active modifiers
        if (this.activeModifiers.length > 0) {
            ctx.fillStyle = '#546e7a';
            ctx.font = '10px monospace';
            ctx.fillText('Active Modifiers:', cx, h * 0.58);
            for (let i = 0; i < this.activeModifiers.length; i++) {
                ctx.fillStyle = '#ff8a80';
                ctx.fillText(`- ${this.activeModifiers[i].name}: ${this.activeModifiers[i].desc}`, cx, h * 0.62 + i * 16);
            }
        }

        // Choices
        const btnY = h * 0.78;
        ctx.font = 'bold 16px monospace';
        if (this.canAscend()) {
            ctx.fillStyle = '#ffd740';
            ctx.fillText('[ 1 ] ASCEND (Harder + More Rewards)', cx, btnY);
        }
        ctx.fillStyle = '#4caf50';
        ctx.fillText('[ 2 ] New Run (Same Difficulty)', cx, btnY + 30);
        ctx.fillStyle = '#78909c';
        ctx.fillText('[ 3 ] Soul Forge (Spend Souls)', cx, btnY + 60);
    }
}

// ============================================
// COMBO FINISHER - Special moves at high combo
// ============================================

class ComboFinisher {
    constructor() {
        this.ready = false;
        this.charging = false;
        this.chargeTimer = 0;
        this.active = false;
        this.activeTimer = 0;
        this.type = null;
        this.lastComboCheck = 0;

        this.thresholds = [
            { combo: 15, name: 'BLADE STORM',    color: '#4fc3f7', dmgMult: 3,  range: 100, type: 'aoe' },
            { combo: 30, name: 'JUDGEMENT',       color: '#ffeb3b', dmgMult: 5,  range: 150, type: 'beam' },
            { combo: 50, name: 'APOCALYPSE',      color: '#ff1744', dmgMult: 10, range: 200, type: 'nuke' },
        ];
    }

    update(dt, player) {
        if (this.active) {
            this.activeTimer -= dt;
            if (this.activeTimer <= 0) this.active = false;
        }

        // Check if finisher is ready (don't re-check every frame)
        if (player.combo !== this.lastComboCheck) {
            this.lastComboCheck = player.combo;
            this.ready = false;
            this.type = null;

            // Find highest available finisher
            for (let i = this.thresholds.length - 1; i >= 0; i--) {
                if (player.combo >= this.thresholds[i].combo) {
                    if (!this.ready) GameAudio.play('comboReady'); // Sound on first ready
                    this.ready = true;
                    this.type = this.thresholds[i];
                    break;
                }
            }
        }
    }

    execute(player, enemies, combat, vfx) {
        if (!this.ready || !this.type) return false;

        const fin = this.type;
        this.active = true;
        this.activeTimer = 0.5;
        this.ready = false;

        // Damage all enemies in range
        let hitCount = 0;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(player.x, player.y, e.x, e.y);
            if (d < fin.range) {
                const dmg = Math.floor(player.attack * fin.dmgMult);
                e.takeDamage(dmg, player.x, player.y);
                combat.addDamageNumber(e.x, e.y - e.h / 2, dmg, true);
                particles.hitSpark(e.x, e.y, fin.color, 15);
                hitCount++;
            }
        }

        // Visual effects
        Utils.addShake(15);
        Utils.addFreeze(8);
        Utils.addSlowMo(0.15, 0.8);
        Utils.addFlash(fin.color, 0.5);

        // VFX based on type
        if (vfx) {
            if (fin.type === 'aoe') {
                vfx.comboExplosion();
            } else if (fin.type === 'beam') {
                vfx.critSlash(player.facing);
                vfx.critSlash(player.facing + Math.PI / 4);
            } else if (fin.type === 'nuke') {
                vfx.screenCrack();
                vfx.comboExplosion();
                vfx.critSlash(0);
                vfx.critSlash(Math.PI / 2);
            }
        }

        // Massive particle explosion
        for (let i = 0; i < 60; i++) {
            const angle = (i / 60) * Math.PI * 2;
            const speed = Utils.rand(3, 12);
            particles.add(new Particle(player.x, player.y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Utils.rand(0.5, 1.5),
                size: Utils.rand(2, 6),
                endSize: 0,
                color: Utils.randChoice([fin.color, '#fff', '#ffd740']),
                glow: true,
                glowSize: 12,
                trail: true,
                trailLength: 5,
                friction: 0.95,
            }));
        }

        // Audio
        GameAudio.play('bossDeath');

        // Reset combo
        player.combo = 0;

        return hitCount;
    }

    drawHUD(ctx, w, h) {
        if (!this.ready || !this.type) return;

        // Finisher ready indicator
        const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.textAlign = 'center';

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(w / 2 - 110, h * 0.88, 220, 28);
        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.type.color;
        ctx.strokeRect(w / 2 - 110, h * 0.88, 220, 28);

        ctx.fillStyle = this.type.color;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`⚡ ${this.type.name} READY! [F] ⚡`, w / 2, h * 0.88 + 18);

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ============================================
// DAILY CHALLENGE - Seeded daily runs
// ============================================

class DailyChallenge {
    constructor() {
        this.active = false;
        this.seed = this.getDailySeed();
        this.modifiers = [];
        this.score = 0;
    }

    getDailySeed() {
        const now = new Date();
        return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    }

    generateModifiers() {
        // Seeded random modifiers based on date
        const rng = this.seededRandom(this.seed);
        const mods = [];

        const allMods = [
            { name: 'Double Speed',   desc: 'Everything moves 2x faster', icon: '⚡' },
            { name: 'Glass Cannon',   desc: '1 HP, 10x damage',          icon: '💎' },
            { name: 'Swarm Mode',     desc: '3x enemies, 3x XP',         icon: '🐜' },
            { name: 'Legendary Only', desc: 'All weapons are legendary',  icon: '⭐' },
            { name: 'No Potions',     desc: 'Potions are disabled',       icon: '🚫' },
            { name: 'Bounty Hunter',  desc: '5x gold, shops cost 5x',    icon: '💰' },
            { name: 'Chaos Shrine',   desc: 'Shrine every room',         icon: '🌀' },
            { name: 'Pet Army',       desc: 'Start with 3 random pets',  icon: '🐾' },
        ];

        // Pick 2 modifiers
        const idx1 = Math.floor(rng() * allMods.length);
        let idx2 = Math.floor(rng() * allMods.length);
        while (idx2 === idx1) idx2 = Math.floor(rng() * allMods.length);

        mods.push(allMods[idx1], allMods[idx2]);
        return mods;
    }

    seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    start(game) {
        this.active = true;
        this.modifiers = this.generateModifiers();
        this.score = 0;
    }

    addScore(amount) {
        if (this.active) this.score += amount;
    }

    drawBadge(ctx, w) {
        if (!this.active) return;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd740';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('DAILY CHALLENGE', w - 20, 95);
        ctx.fillStyle = '#78909c';
        ctx.font = '9px monospace';
        ctx.fillText(`Score: ${this.score}`, w - 20, 108);
        ctx.fillText(`Seed: ${this.seed}`, w - 20, 120);
    }
}
