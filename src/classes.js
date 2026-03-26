// ============================================
// CLASSES - Starting class selection
// ============================================

const CLASS_DEFS = {
    warrior: {
        name: 'Warrior',
        icon: '⚔',
        color: '#f44336',
        desc: 'High HP, strong melee. Starts with Battle Axe.',
        stats: { maxHp: 130, attack: 14, defense: 5, speed: 140, critChance: 0.03, critMultiplier: 1.8, lifesteal: 0 },
        weapon: { type: 'axe', rarity: 'common' },
        potions: 4,
        passive: 'Berserker: +1 ATK per 10 kills',
        passiveApply: (p) => { p.killAttackBonus = true; },
    },
    rogue: {
        name: 'Rogue',
        icon: '🗡',
        color: '#64ffda',
        desc: 'Fast attacks, high crit. Starts with Shadow Dagger.',
        stats: { maxHp: 80, attack: 8, defense: 2, speed: 190, critChance: 0.20, critMultiplier: 2.5, lifesteal: 0 },
        weapon: { type: 'dagger', rarity: 'common' },
        potions: 2,
        passive: 'Assassin: First hit on enemy deals 2x',
        passiveApply: (p) => { p.assassinFirstHit = true; },
    },
    mage: {
        name: 'Mage',
        icon: '🔮',
        color: '#7c4dff',
        desc: 'Ranged damage, skills recharge faster. Starts with Fire Staff.',
        stats: { maxHp: 70, attack: 12, defense: 1, speed: 150, critChance: 0.08, critMultiplier: 2.0, lifesteal: 0 },
        weapon: { type: 'staff', rarity: 'common' },
        potions: 3,
        passive: 'Arcane: Skill cooldowns -30%',
        passiveApply: (p) => { p.skillCdReduction = 0.7; },
    },
    // HIDDEN CLASS — unlocked by playing all 3 classes + reaching floor 10
    necromancer: {
        name: 'Necromancer',
        icon: '💀',
        color: '#e040fb',
        desc: 'Summon undead, drain life. Starts with Void Staff.',
        stats: { maxHp: 60, attack: 10, defense: 0, speed: 130, critChance: 0.05, critMultiplier: 2.0, lifesteal: 0.10 },
        weapon: { type: 'staff', rarity: 'uncommon' },
        potions: 2,
        passive: 'Undying: Kill enemies to summon skeleton allies (max 3)',
        passiveApply: (p) => { p.necroSummon = true; p.necroMax = 3; p.necroCount = 0; },
        hidden: true,
        unlockCondition: 'Play all 3 base classes & reach floor 10',
    },
};

class ClassSelect {
    constructor() {
        this.active = false;
        this.selectedClass = null;
        this.hoveredIndex = -1;
        this.animTimer = 0;
    }

    isHiddenUnlocked() {
        if (typeof game === 'undefined' || !game.meta) return false;
        const d = game.meta.data;
        const classesPlayed = d.classesPlayed ? Object.keys(d.classesPlayed).length : 0;
        return classesPlayed >= 3 && d.bestFloor >= 10;
    }

    getAvailableClasses() {
        const classes = Object.entries(CLASS_DEFS).filter(([id, cls]) => {
            if (cls.hidden) return this.isHiddenUnlocked();
            return true;
        });
        return classes;
    }

    show() {
        this.active = true;
        this.selectedClass = null;
        this.hoveredIndex = -1;
        this.animTimer = 0;
    }

    select(classId, player) {
        const cls = CLASS_DEFS[classId];
        if (!cls) return;

        this.selectedClass = classId;
        this.active = false;

        // Apply class stats
        Object.assign(player, cls.stats);
        player.potions = cls.potions;

        // Re-apply meta-progression bonuses AFTER class stats
        if (typeof game !== 'undefined' && game.meta) {
            game.meta.applyToPlayer(player);
        }
        player.hp = player.maxHp;

        // Give class weapon
        // Use milestone unlocked rarity if better than class default
        let weaponRarity = cls.weapon.rarity;
        if (typeof game !== 'undefined' && game.meta && game.meta.data.unlocks) {
            const unlockedRarity = game.meta.data.unlocks.startRarity;
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            if (unlockedRarity && rarityOrder.indexOf(unlockedRarity) > rarityOrder.indexOf(weaponRarity)) {
                weaponRarity = unlockedRarity;
            }
        }
        player.weapons = [new Weapon(cls.weapon.type, weaponRarity)];
        player.currentWeapon = 0;

        // Apply passive
        cls.passiveApply(player);
        player.className = cls.name;
        player.classIcon = cls.icon;
        player.classColor = cls.color;
        player.classPassive = cls.passive;

        GameAudio.play('levelUp');
        Utils.addFlash(cls.color, 0.3);

        // Random start blessing (one per run)
        if (typeof game !== 'undefined') {
            const startBlessings = [
                { msg: '🎁 Bonus: +3 Potions!', apply: () => { player.potions += 3; } },
                { msg: '🎁 Bonus: +50 Gold!', apply: () => { player.gold += 50; } },
                { msg: '🎁 Bonus: +5 ATK!', apply: () => { player.attack += 5; } },
                { msg: '🎁 Bonus: +20 Max HP!', apply: () => { player.maxHp += 20; player.hp = player.maxHp; } },
                { msg: '🎁 Bonus: +10% Crit!', apply: () => { player.critChance += 0.1; } },
                { msg: '🎁 Bonus: +3 DEF!', apply: () => { player.defense += 3; } },
                { msg: '🎁 Bonus: Free Gacha Pull!', apply: () => {
                    setTimeout(() => {
                        if (game.gacha) game.gacha.pull(1, (r) => { if (r.type === 'weapon') game.weaponPickup = r.item; });
                    }, 3000);
                }},
                { msg: 'No bonus this time...', apply: () => {} },
            ];
            const blessing = Utils.randChoice(startBlessings);
            blessing.apply();
            setTimeout(() => {
                game.ui.notify(blessing.msg, '#ffd740', 3);
                game.ui.notify(`${cls.icon} ${cls.name}: ${cls.passive}`, cls.color, 4);
            }, 1500);
        }
    }

    update(dt) {
        if (this.active) this.animTimer += dt;
    }

    draw(ctx, w, h) {
        if (!this.active) return;

        // Full screen overlay
        ctx.fillStyle = 'rgba(5,5,12,0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 32px monospace';
        ctx.fillText('Choose Your Class', w / 2, h * 0.12);

        ctx.fillStyle = '#546e7a';
        ctx.font = '13px monospace';
        ctx.fillText('Each class has unique stats, weapon, and passive ability', w / 2, h * 0.17);

        // Class cards
        const classes = this.getAvailableClasses();
        const cardW = 240;
        const cardH = 320;
        const gap = 30;
        const totalW = classes.length * cardW + (classes.length - 1) * gap;
        const startX = (w - totalW) / 2;
        const cardY = h * 0.22;

        for (let i = 0; i < classes.length; i++) {
            const [id, cls] = classes[i];
            const x = startX + i * (cardW + gap);
            const isHovered = this.hoveredIndex === i;

            // Card entrance animation
            const delay = i * 0.15;
            const t = Math.max(0, this.animTimer - delay);
            const scale = Math.min(t * 4, 1);

            ctx.save();
            ctx.translate(x + cardW / 2, cardY + cardH / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(x + cardW / 2), -(cardY + cardH / 2));

            // Card bg
            ctx.fillStyle = isHovered ? 'rgba(30,30,50,0.95)' : 'rgba(18,18,30,0.95)';
            ctx.fillRect(x, cardY, cardW, cardH);

            // Border
            ctx.strokeStyle = isHovered ? cls.color : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = isHovered ? 3 : 1;
            ctx.strokeRect(x, cardY, cardW, cardH);

            // Top color bar
            ctx.fillStyle = cls.color;
            ctx.fillRect(x, cardY, cardW, 4);

            // Icon
            ctx.font = '48px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(cls.icon, x + cardW / 2, cardY + 60);

            // Name
            ctx.fillStyle = cls.color;
            ctx.font = 'bold 20px monospace';
            ctx.fillText(cls.name, x + cardW / 2, cardY + 95);

            // Description
            ctx.fillStyle = '#b0bec5';
            ctx.font = '11px monospace';
            const descLines = this.wrapText(cls.desc, 28);
            descLines.forEach((line, li) => {
                ctx.fillText(line, x + cardW / 2, cardY + 120 + li * 14);
            });

            // Stats
            const statsY = cardY + 160;
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            const stats = [
                { label: 'HP', val: cls.stats.maxHp, color: '#4caf50' },
                { label: 'ATK', val: cls.stats.attack, color: '#ff5252' },
                { label: 'DEF', val: cls.stats.defense, color: '#78909c' },
                { label: 'SPD', val: cls.stats.speed, color: '#4fc3f7' },
                { label: 'CRIT', val: `${Math.floor(cls.stats.critChance * 100)}%`, color: '#ffeb3b' },
            ];
            for (let s = 0; s < stats.length; s++) {
                ctx.fillStyle = '#546e7a';
                ctx.fillText(stats[s].label, x + 20, statsY + s * 16);
                ctx.fillStyle = stats[s].color;
                ctx.textAlign = 'right';
                ctx.fillText(String(stats[s].val), x + cardW - 20, statsY + s * 16);
                ctx.textAlign = 'left';
            }

            // Passive
            ctx.fillStyle = cls.color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PASSIVE:', x + cardW / 2, statsY + 90);
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '9px monospace';
            ctx.fillText(cls.passive, x + cardW / 2, statsY + 104);

            // Key hint
            ctx.fillStyle = isHovered ? cls.color : '#455a64';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`[${i + 1}]`, x + cardW / 2, cardY + cardH - 15);

            ctx.restore();
        }

        // Instructions
        ctx.textAlign = 'center';
        ctx.fillStyle = '#455a64';
        ctx.font = '11px monospace';
        ctx.fillText('Press 1, 2, or 3  |  Hover to preview', w / 2, h * 0.92);
    }

    wrapText(text, maxChars) {
        if (text.length <= maxChars) return [text];
        const words = text.split(' ');
        const lines = [];
        let current = '';
        for (const word of words) {
            if ((current + ' ' + word).trim().length > maxChars) {
                if (current) lines.push(current);
                current = word;
            } else {
                current = (current + ' ' + word).trim();
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    handleMouseMove(mx, my, w, h) {
        if (!this.active) return;
        const classes = Object.entries(CLASS_DEFS);
        const cardW = 240, cardH = 320, gap = 30;
        const totalW = classes.length * cardW + (classes.length - 1) * gap;
        const startX = (w - totalW) / 2;
        const cardY = h * 0.22;

        this.hoveredIndex = -1;
        for (let i = 0; i < classes.length; i++) {
            const x = startX + i * (cardW + gap);
            if (mx >= x && mx <= x + cardW && my >= cardY && my <= cardY + cardH) {
                this.hoveredIndex = i;
                break;
            }
        }
    }
}
