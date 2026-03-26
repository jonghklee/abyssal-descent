// ============================================
// SYNERGY - Relic combination effects
// ============================================

const SYNERGY_DEFS = [
    {
        id: 'vampiric_rage',
        name: 'Vampiric Rage',
        desc: 'Lifesteal heals 3x more!',
        icon: '🩸⚡',
        color: '#e91e63',
        requires: ['vampFang', 'bloodRing'],
        apply: (p) => { p.lifesteal += 0.15; },
    },
    {
        id: 'speed_demon',
        name: 'Speed Demon',
        desc: '+50% Attack Speed!',
        icon: '👢⚡',
        color: '#00e5ff',
        requires: ['swiftBoots', 'ghostCloak'],
        apply: (p) => { /* Applied via weapon cooldown reduction in combat */ },
        combatMod: { attackSpeedMult: 0.5 },
    },
    {
        id: 'holy_guardian',
        name: 'Holy Guardian',
        desc: 'Revive with full HP + 10s invuln!',
        icon: '🔥👼',
        color: '#fff9c4',
        requires: ['phoenix', 'voidStone'],
        apply: (p) => { p.holyRevive = true; },
    },
    {
        id: 'berserker_fury',
        name: 'Berserker Fury',
        desc: 'Below 30% HP: +100% DMG!',
        icon: '💜🗡',
        color: '#ff1744',
        requires: ['demonHeart', 'warGod'],
        apply: (p) => { p.berserkerFury = true; },
    },
    {
        id: 'lucky_strike',
        name: 'Lucky Strike',
        desc: 'Crits drop bonus gold!',
        icon: '🍀💰',
        color: '#ffd740',
        requires: ['luckyCharm', 'ironShield'],
        apply: (p) => { p.critGold = true; },
    },
    {
        id: 'eternal_king',
        name: 'Eternal King',
        desc: 'Crown + Soul Jar: 3x Souls earned!',
        icon: '👑🏺',
        color: '#ffd740',
        requires: ['crown', 'souljar'],
        apply: (p) => { p.soulBonus = 3.0; },
    },
    {
        id: 'chaos_magnet',
        name: 'Chaos Magnet',
        desc: 'Dice + Magnet: items fly to you from everywhere!',
        icon: '🎲🧲',
        color: '#ff9800',
        requires: ['dice', 'magnet'],
        apply: (p) => { p.magnetMult = 5.0; },
    },
    {
        id: 'time_lord',
        name: 'Time Lord',
        desc: 'Hourglass + Compass: enemies move 50% slower!',
        icon: '⏳🧭',
        color: '#4fc3f7',
        requires: ['hourglass', 'compass'],
        apply: (p) => { p.auraSlowPct = 0.5; },
    },
];

class SynergySystem {
    constructor() {
        this.activeSynergies = [];
        this.displayQueue = [];
        this.displayTimer = 0;
        this.currentDisplay = null;
    }

    check(player) {
        if (!player.relics) return;
        const relicIds = player.relics.map(r => r.id);

        for (const syn of SYNERGY_DEFS) {
            if (this.activeSynergies.find(s => s.id === syn.id)) continue;

            const hasAll = syn.requires.every(req => relicIds.includes(req));
            if (hasAll) {
                this.activate(syn, player);
            }
        }
    }

    activate(synergy, player) {
        this.activeSynergies.push(synergy);
        if (synergy.apply) synergy.apply(player);

        this.displayQueue.push(synergy);
        Utils.addShake(12);
        Utils.addFlash(synergy.color, 0.4);
        GameAudio.play('levelUp');
    }

    update(dt) {
        if (this.currentDisplay) {
            this.displayTimer -= dt;
            if (this.displayTimer <= 0) this.currentDisplay = null;
        }
        if (!this.currentDisplay && this.displayQueue.length > 0) {
            this.currentDisplay = this.displayQueue.shift();
            this.displayTimer = 4;
        }
    }

    draw(ctx, w, h) {
        if (!this.currentDisplay) return;

        const syn = this.currentDisplay;
        const alpha = Math.min(this.displayTimer, 1);
        const cx = w / 2;
        const cy = h * 0.35;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Background banner
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(cx - 180, cy - 30, 360, 70);
        ctx.strokeStyle = syn.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = syn.color;
        ctx.strokeRect(cx - 180, cy - 30, 360, 70);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = syn.color;
        ctx.font = 'bold 10px monospace';
        ctx.fillText('✨ SYNERGY ACTIVATED ✨', cx, cy - 15);

        // Name
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`${syn.icon} ${syn.name}`, cx, cy + 8);

        // Description
        ctx.fillStyle = '#b0bec5';
        ctx.font = '11px monospace';
        ctx.fillText(syn.desc, cx, cy + 28);

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ============================================
// META-PROGRESSION - Permanent upgrades between runs
// ============================================

class MetaProgression {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('abyssal_descent_meta');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return {
            totalRuns: 0,
            bestFloor: 0,
            bestKills: 0,
            totalKills: 0,
            totalGold: 0,
            totalBossKills: 0,
            souls: 0, // Meta currency
            upgrades: {
                startHp: 0,      // +5 HP per level
                startAtk: 0,     // +2 ATK per level
                startDef: 0,     // +1 DEF per level
                startPotions: 0, // +1 potion per level
                startSpeed: 0,   // +5 speed per level
                luckBoost: 0,    // +2% gacha rarity per level
                xpBoost: 0,      // +10% XP per level
                goldBoost: 0,    // +10% gold per level
            },
            achievements: [],
            petsUnlocked: [],
            unlocks: {},       // Permanent unlocks
            milestones: {},    // Completed milestones
            classesPlayed: {}, // Track classes used
        };
    }

    // Check and apply milestone unlocks
    checkMilestones(game) {
        const d = this.data;
        if (!d.milestones) d.milestones = {};
        if (!d.unlocks) d.unlocks = {};
        const milestones = [
            { id: 'kills_100',   check: d.totalKills >= 100,    reward: 'Start +5 ATK',       apply: () => { d.unlocks.bonusAtk = 5; } },
            { id: 'kills_500',   check: d.totalKills >= 500,    reward: 'Start +10 ATK',      apply: () => { d.unlocks.bonusAtk = 10; } },
            { id: 'kills_1000',  check: d.totalKills >= 1000,   reward: 'Start +20 ATK',      apply: () => { d.unlocks.bonusAtk = 20; } },
            { id: 'floor_10',    check: d.bestFloor >= 10,      reward: 'Unlock Rare start weapon', apply: () => { d.unlocks.startRarity = 'rare'; } },
            { id: 'floor_20',    check: d.bestFloor >= 20,      reward: 'Unlock Epic start weapon', apply: () => { d.unlocks.startRarity = 'epic'; } },
            { id: 'runs_10',     check: d.totalRuns >= 10,      reward: '+50 Start HP',        apply: () => { d.unlocks.bonusHp = 50; } },
            { id: 'runs_25',     check: d.totalRuns >= 25,      reward: '+100 Start HP',       apply: () => { d.unlocks.bonusHp = 100; } },
            { id: 'boss_5',      check: d.totalBossKills >= 5,  reward: 'Start +5 DEF',       apply: () => { d.unlocks.bonusDef = 5; } },
            { id: 'gold_5000',   check: d.totalGold >= 5000,    reward: 'Start +100 Gold',    apply: () => { d.unlocks.startGold = 100; } },
            { id: 'victory',     check: d.victories >= 1,      reward: 'Unlock Ascension!',  apply: () => { d.unlocks.ascensionUnlocked = true; } },
            { id: 'victory_3',   check: d.victories >= 3,      reward: 'Start +30 ATK',      apply: () => { d.unlocks.bonusAtk = 30; } },
        ];

        let newUnlocks = [];
        for (const m of milestones) {
            if (m.check && !d.milestones[m.id]) {
                d.milestones[m.id] = true;
                m.apply();
                newUnlocks.push(m.reward);
            }
        }
        if (newUnlocks.length > 0) this.save();
        return newUnlocks;
    }

    save() {
        try {
            localStorage.setItem('abyssal_descent_meta', JSON.stringify(this.data));
        } catch(e) {}
    }

    endRun(player, floor, game) {
        this.data.totalRuns++;
        this.data.bestFloor = Math.max(this.data.bestFloor, floor);
        this.data.bestKills = Math.max(this.data.bestKills, player.kills);
        this.data.totalKills += player.kills;
        this.data.totalGold += Math.floor(player.gold);
        // Track total play time
        if (!this.data.totalPlayTime) this.data.totalPlayTime = 0;
        if (game && game.playTime) this.data.totalPlayTime += Math.floor(game.playTime);

        // Earn souls based on performance
        const floorSouls = floor * 5;
        const killSouls = Math.floor(player.kills * 0.5);
        const levelSouls = player.level * 3;
        const totalSouls = floorSouls + killSouls + levelSouls;
        this.data.souls += totalSouls;

        this.save();
        return totalSouls;
    }

    applyToPlayer(player) {
        const u = this.data.upgrades;
        player.maxHp += u.startHp * 5;
        player.hp = player.maxHp;
        player.attack += u.startAtk * 2;
        player.defense += u.startDef * 1;
        player.potions += u.startPotions * 1;
        player.speed += u.startSpeed * 5;

        // Apply milestone unlocks
        const unlocks = this.data.unlocks || {};
        if (unlocks.bonusAtk) player.attack += unlocks.bonusAtk;
        if (unlocks.bonusHp) { player.maxHp += unlocks.bonusHp; player.hp = player.maxHp; }
        if (unlocks.bonusDef) player.defense += unlocks.bonusDef;
        if (unlocks.startGold) player.gold += unlocks.startGold;
    }

    getUpgradeCost(upgradeId) {
        const level = this.data.upgrades[upgradeId] || 0;
        return 10 + level * 15; // Increasing cost
    }

    canUpgrade(upgradeId) {
        return this.data.souls >= this.getUpgradeCost(upgradeId);
    }

    buyUpgrade(upgradeId) {
        const cost = this.getUpgradeCost(upgradeId);
        if (this.data.souls < cost) return false;
        this.data.souls -= cost;
        this.data.upgrades[upgradeId] = (this.data.upgrades[upgradeId] || 0) + 1;
        this.save();
        return true;
    }

    drawUpgradeScreen(ctx, w, h, input) {
        ctx.fillStyle = 'rgba(5,5,10,0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#7c4dff';
        ctx.font = 'bold 28px monospace';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#7c4dff';
        ctx.fillText('SOUL FORGE', w / 2, 60);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#78909c';
        ctx.font = '12px monospace';
        ctx.fillText('Spend souls to permanently strengthen your next runs', w / 2, 85);

        // Souls display
        ctx.fillStyle = '#b388ff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`Souls: ${this.data.souls}`, w / 2, 115);

        // Upgrade grid
        const upgrades = [
            { id: 'startHp',      name: 'Vitality',     desc: '+5 Starting HP',      icon: '♥' },
            { id: 'startAtk',     name: 'Power',        desc: '+2 Starting ATK',     icon: '⚔' },
            { id: 'startDef',     name: 'Armor',        desc: '+1 Starting DEF',     icon: '🛡' },
            { id: 'startPotions', name: 'Alchemy',      desc: '+1 Starting Potion',  icon: '🧪' },
            { id: 'startSpeed',   name: 'Agility',      desc: '+5 Starting Speed',   icon: '→' },
            { id: 'luckBoost',    name: 'Fortune',      desc: '+2% Gacha Luck',      icon: '🍀' },
            { id: 'xpBoost',      name: 'Wisdom',       desc: '+10% XP Gain',        icon: '📚' },
            { id: 'goldBoost',    name: 'Greed',        desc: '+10% Gold Gain',      icon: '💰' },
        ];

        const cols = 4;
        const cellW = 160;
        const cellH = 90;
        const gap = 15;
        const gridW = cols * cellW + (cols - 1) * gap;
        const startX = (w - gridW) / 2;
        const startY = 145;

        for (let i = 0; i < upgrades.length; i++) {
            const u = upgrades[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cellW + gap);
            const y = startY + row * (cellH + gap);
            const level = this.data.upgrades[u.id] || 0;
            const cost = this.getUpgradeCost(u.id);
            const canBuy = this.data.souls >= cost;

            // Cell bg
            ctx.fillStyle = canBuy ? 'rgba(30,25,50,0.9)' : 'rgba(20,20,30,0.9)';
            ctx.fillRect(x, y, cellW, cellH);
            ctx.strokeStyle = canBuy ? '#7c4dff' : '#333';
            ctx.lineWidth = canBuy ? 2 : 1;
            ctx.strokeRect(x, y, cellW, cellH);

            // Icon & Name
            ctx.textAlign = 'center';
            ctx.font = '18px monospace';
            ctx.fillText(u.icon, x + cellW / 2, y + 25);
            ctx.fillStyle = canBuy ? '#e0e0e0' : '#546e7a';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(u.name, x + cellW / 2, y + 42);

            // Level
            ctx.fillStyle = '#b388ff';
            ctx.font = '9px monospace';
            ctx.fillText(`Lv.${level}`, x + cellW / 2, y + 56);

            // Cost
            ctx.fillStyle = canBuy ? '#b388ff' : '#455a64';
            ctx.font = '10px monospace';
            ctx.fillText(`${cost} souls`, x + cellW / 2, y + 72);

            // Key hint
            ctx.fillStyle = '#455a64';
            ctx.font = '8px monospace';
            ctx.fillText(`[${i + 1}]`, x + cellW / 2, y + 85);
        }

        // Stats
        const statsY = startY + 2 * (cellH + gap) + 20;
        ctx.fillStyle = '#455a64';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Total Runs: ${this.data.totalRuns} | Best Floor: ${this.data.bestFloor} | Total Kills: ${this.data.totalKills}`, w / 2, statsY);

        // Continue
        ctx.fillStyle = '#78909c';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('[ SPACE ] Start New Run', w / 2, h - 40);
        ctx.fillText('[ ESC ] Back to Title', w / 2, h - 20);
    }
}
