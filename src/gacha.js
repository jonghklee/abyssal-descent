// ============================================
// GACHA - Loot box / random reward system
// ============================================

const GACHA_RARITIES = {
    common:    { color: '#9e9e9e', glow: '#757575', weight: 50, name: 'Common',    stars: 1 },
    uncommon:  { color: '#4caf50', glow: '#2e7d32', weight: 30, name: 'Uncommon',  stars: 2 },
    rare:      { color: '#2196f3', glow: '#1565c0', weight: 14, name: 'Rare',      stars: 3 },
    epic:      { color: '#9c27b0', glow: '#6a1b9a', weight: 5,  name: 'Epic',      stars: 4 },
    legendary: { color: '#ff9800', glow: '#e65100', weight: 0.9, name: 'Legendary', stars: 5 },
    mythic:    { color: '#ff1744', glow: '#d50000', weight: 0.1, name: 'MYTHIC',   stars: 6 },
};

// Gacha reward pools
const GACHA_REWARDS = {
    weapon: (rarity, floor) => {
        const types = Object.keys(WEAPON_TYPES);
        const type = Utils.randChoice(types);
        return {
            type: 'weapon',
            rarity,
            item: new Weapon(type, rarity === 'mythic' ? 'legendary' : rarity),
            name: null, // Set after creation
        };
    },
    relic: (rarity) => {
        const relics = RELIC_POOL.filter(r => r.rarity === rarity ||
            (rarity === 'mythic' && r.rarity === 'legendary'));
        if (relics.length === 0) return GACHA_REWARDS.weapon(rarity);
        return {
            type: 'relic',
            rarity,
            item: Utils.randChoice(relics),
        };
    },
    consumable: (rarity) => {
        const amounts = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8, mythic: 15 };
        return {
            type: 'consumable',
            rarity,
            item: { potions: amounts[rarity] || 1 },
        };
    },
    gold: (rarity, floor) => {
        const mult = { common: 1, uncommon: 2, rare: 5, epic: 10, legendary: 25, mythic: 100 };
        return {
            type: 'gold',
            rarity,
            item: { amount: (mult[rarity] || 1) * (10 + floor * 5) },
        };
    },
    stat: (rarity) => {
        const boosts = {
            common:    [{ stat: 'maxHp', val: 5, name: '+5 HP' }],
            uncommon:  [{ stat: 'attack', val: 3, name: '+3 ATK' }, { stat: 'defense', val: 2, name: '+2 DEF' }],
            rare:      [{ stat: 'critChance', val: 0.05, name: '+5% Crit' }, { stat: 'speed', val: 15, name: '+15 SPD' }],
            epic:      [{ stat: 'critMultiplier', val: 0.3, name: '+30% Crit DMG' }, { stat: 'lifesteal', val: 0.03, name: '+3% Lifesteal' }],
            legendary: [{ stat: 'attack', val: 8, name: '+8 ATK' }, { stat: 'maxHp', val: 30, name: '+30 HP' }],
            mythic:    [{ stat: 'attack', val: 15, name: '+15 ATK & +50 HP', extra: { stat: 'maxHp', val: 50 } }],
        };
        const pool = boosts[rarity] || boosts.common;
        return {
            type: 'stat',
            rarity,
            item: Utils.randChoice(pool),
        };
    },
};

// Relics - passive items that provide ongoing bonuses
const RELIC_POOL = [
    { id: 'vampFang', name: 'Vampire Fang', desc: '+8% Lifesteal', rarity: 'rare', icon: '🦷',
      apply: (p) => { p.lifesteal += 0.08; } },
    { id: 'ironShield', name: 'Iron Shield', desc: '+5 Defense', rarity: 'uncommon', icon: '🛡',
      apply: (p) => { p.defense += 5; } },
    { id: 'swiftBoots', name: 'Swift Boots', desc: '+30 Speed', rarity: 'uncommon', icon: '👢',
      apply: (p) => { p.speed += 30; } },
    { id: 'bloodRing', name: 'Blood Ring', desc: '+25 HP, +5 ATK', rarity: 'rare', icon: '💍',
      apply: (p) => { p.maxHp += 25; p.hp += 25; p.attack += 5; } },
    { id: 'luckyCharm', name: 'Lucky Charm', desc: '+12% Crit Chance', rarity: 'rare', icon: '🍀',
      apply: (p) => { p.critChance += 0.12; } },
    { id: 'demonHeart', name: 'Demon Heart', desc: '+50 HP, +10 ATK, -3 DEF', rarity: 'epic', icon: '💜',
      apply: (p) => { p.maxHp += 50; p.hp += 50; p.attack += 10; p.defense = Math.max(0, p.defense - 3); } },
    { id: 'ghostCloak', name: 'Ghost Cloak', desc: 'Dash CD -50%', rarity: 'epic', icon: '👻',
      apply: (p) => { p.dashMaxCooldown *= 0.5; } },
    { id: 'warGod', name: "War God's Blessing", desc: '+20 ATK, +20% Crit DMG', rarity: 'legendary', icon: '⚡',
      apply: (p) => { p.attack += 20; p.critMultiplier += 0.2; } },
    { id: 'phoenix', name: 'Phoenix Feather', desc: 'Revive once with 50% HP', rarity: 'legendary', icon: '🔥',
      apply: (p) => { p.hasRevive = true; } },
    { id: 'voidStone', name: 'Void Stone', desc: '+100 HP, +15 ATK, +10 DEF', rarity: 'legendary', icon: '🌑',
      apply: (p) => { p.maxHp += 100; p.hp += 100; p.attack += 15; p.defense += 10; } },
    // Extra relics for variety
    { id: 'thornArmor', name: 'Thorn Armor', desc: 'Reflect 20% melee damage', rarity: 'uncommon', icon: '🌵',
      apply: (p) => { p.thornDmg = (p.thornDmg || 0) + 0.2; } },
    { id: 'magnet', name: 'Gold Magnet', desc: '+50% pickup range', rarity: 'uncommon', icon: '🧲',
      apply: (p) => { /* Applied via item magnetRange */ } },
    { id: 'hourglass', name: 'Frozen Hourglass', desc: 'Slow enemies 20% near you', rarity: 'rare', icon: '⏳',
      apply: (p) => { p.auraSlowPct = 0.2; } },
    { id: 'crown', name: 'King\'s Crown', desc: '+3 ATK per floor', rarity: 'epic', icon: '👑',
      apply: (p) => { p.atkPerFloor = (p.atkPerFloor || 0) + 3; } },
    { id: 'dice', name: 'Chaos Dice', desc: 'Random +0~20 ATK each room', rarity: 'epic', icon: '🎲',
      apply: (p) => { p.chaosDice = true; } },
    { id: 'compass', name: 'Dungeon Compass', desc: 'Reveal full minimap', rarity: 'rare', icon: '🧭',
      apply: (p) => { p.fullMapReveal = true; } },
    { id: 'souljar', name: 'Soul Jar', desc: '+50% Souls on death', rarity: 'legendary', icon: '🏺',
      apply: (p) => { p.soulBonus = 1.5; } },
];

class GachaSystem {
    constructor() {
        this.active = false;
        this.phase = 'idle'; // idle, spinning, revealing, reward
        this.timer = 0;
        this.result = null;
        this.reward = null;
        this.spinSpeed = 0;
        this.currentRarityIndex = 0;
        this.rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        this.sparkParticles = [];
        this.bannerPulse = 0;
        this.callback = null;
        this.floor = 1;

        // Pity system
        this.pullCount = 0;
        this.pityThreshold = 30; // Guaranteed epic+ at 30 pulls
        this.legendaryPity = 60; // Guaranteed legendary+ at 60
    }

    pull(floor, callback) {
        if (this.active) return;
        this.active = true;
        this.phase = 'spinning';
        this.timer = 0;
        this.spinSpeed = 20;
        this.currentRarityIndex = 0;
        this.floor = floor;
        this.callback = callback;
        this.pullCount++;
        this.sparkParticles = [];

        // Determine rarity with pity
        this.result = this.determineRarity();

        GameAudio.play('chest');
    }

    determineRarity() {
        let weights = {};
        for (const [key, val] of Object.entries(GACHA_RARITIES)) {
            weights[key] = val.weight;
        }

        // Pity system - increase rates
        if (this.pullCount >= this.legendaryPity) {
            weights.legendary += 30;
            weights.mythic += 5;
        } else if (this.pullCount >= this.pityThreshold) {
            weights.epic += 20;
            weights.legendary += 10;
        }

        // Soft pity: gradually increase from pull 20
        if (this.pullCount > 20) {
            const bonus = (this.pullCount - 20) * 2;
            weights.epic += bonus;
            weights.legendary += bonus * 0.3;
        }

        const keys = Object.keys(weights);
        const vals = Object.values(weights);
        const rarity = Utils.weightedChoice(keys, vals);

        // Reset pity on good pull
        if (rarity === 'legendary' || rarity === 'mythic') {
            this.pullCount = 0;
        }

        return rarity;
    }

    generateReward(rarity) {
        const rewardTypes = ['weapon', 'relic', 'stat', 'gold', 'consumable', 'pet'];
        const typeWeights = [25, 20, 20, 10, 10, 15];
        const type = Utils.weightedChoice(rewardTypes, typeWeights);

        if (type === 'pet') {
            // Pet reward
            if (typeof PET_DEFS !== 'undefined') {
                const petPool = PET_DEFS.filter(p => p.rarity === rarity ||
                    (rarity === 'mythic' && p.rarity === 'legendary') ||
                    (rarity === 'common' && p.rarity === 'common'));
                const petDef = petPool.length > 0 ? Utils.randChoice(petPool) :
                    Utils.randChoice(PET_DEFS);
                return {
                    type: 'pet',
                    rarity,
                    item: petDef,
                };
            }
            return GACHA_REWARDS.weapon(rarity, this.floor);
        }

        return GACHA_REWARDS[type](rarity, this.floor);
    }

    update(dt) {
        if (!this.active) return;
        this.timer += dt;
        this.bannerPulse += dt * 4;

        switch (this.phase) {
            case 'spinning':
                this.spinSpeed *= 0.97;
                this.currentRarityIndex = (this.currentRarityIndex + this.spinSpeed * dt) % this.rarityOrder.length;

                // Add spark particles during spin
                if (Math.random() < 0.3) {
                    this.sparkParticles.push({
                        x: Utils.rand(0.3, 0.7),
                        y: Utils.rand(0.3, 0.6),
                        vx: Utils.rand(-0.5, 0.5),
                        vy: Utils.rand(-1, -0.3),
                        life: Utils.rand(0.3, 0.8),
                        maxLife: 0.8,
                        size: Utils.rand(2, 5),
                        color: GACHA_RARITIES[this.rarityOrder[Math.floor(this.currentRarityIndex) % this.rarityOrder.length]].color,
                    });
                }

                if (this.timer > 2.5) {
                    this.phase = 'revealing';
                    this.timer = 0;
                    this.reward = this.generateReward(this.result);
                    Utils.addShake(this.result === 'mythic' ? 20 : this.result === 'legendary' ? 12 : 6);

                    // Epic+ gets special effects
                    const rarityIdx = this.rarityOrder.indexOf(this.result);
                    if (rarityIdx >= 3) { // epic+
                        Utils.addFlash(GACHA_RARITIES[this.result].color, 0.5);
                        Utils.addFreeze(rarityIdx >= 4 ? 8 : 4);
                    }
                    GameAudio.play('levelUp');
                }
                break;

            case 'revealing':
                if (this.timer > 2.0) {
                    this.phase = 'reward';
                    this.timer = 0;
                }
                break;

            case 'reward':
                // Wait for player input to close
                break;
        }

        // Update spark particles
        for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
            const sp = this.sparkParticles[i];
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.life -= dt;
            if (sp.life <= 0) this.sparkParticles.splice(i, 1);
        }
    }

    close(player) {
        if (this.phase !== 'reward' || !this.reward) return;

        // Apply reward
        switch (this.reward.type) {
            case 'weapon':
                // Will be picked up as weapon drop
                if (this.callback) this.callback(this.reward);
                break;
            case 'relic':
                this.reward.item.apply(player);
                if (!player.relics) player.relics = [];
                player.relics.push(this.reward.item);
                break;
            case 'consumable':
                player.potions += this.reward.item.potions;
                break;
            case 'gold':
                player.gold += this.reward.item.amount;
                break;
            case 'stat':
                const s = this.reward.item;
                player[s.stat] += s.val;
                if (s.stat === 'maxHp') player.hp += s.val;
                if (s.extra) {
                    player[s.extra.stat] += s.extra.val;
                    if (s.extra.stat === 'maxHp') player.hp += s.extra.val;
                }
                break;
            case 'pet':
                if (typeof game !== 'undefined' && game.petSystem) {
                    const pet = game.petSystem.addPet(this.reward.item);
                }
                break;
        }

        GameAudio.play('pickup');
        this.active = false;
        this.phase = 'idle';
        this.reward = null;
    }

    draw(ctx, w, h) {
        if (!this.active) return;

        // Dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // Spark particles (background)
        for (const sp of this.sparkParticles) {
            ctx.globalAlpha = sp.life / sp.maxLife;
            ctx.fillStyle = sp.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = sp.color;
            ctx.beginPath();
            ctx.arc(sp.x * w, sp.y * h, sp.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        if (this.phase === 'spinning') {
            this.drawSpinning(ctx, w, h, cx, cy);
        } else if (this.phase === 'revealing') {
            this.drawRevealing(ctx, w, h, cx, cy);
        } else if (this.phase === 'reward') {
            this.drawReward(ctx, w, h, cx, cy);
        }
    }

    drawSpinning(ctx, w, h, cx, cy) {
        // Spinning rarity display
        const idx = Math.floor(this.currentRarityIndex) % this.rarityOrder.length;
        const rarity = this.rarityOrder[idx];
        const info = GACHA_RARITIES[rarity];

        // Glow circle
        const radius = 80 + Math.sin(this.timer * 10) * 10;
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 30;
        ctx.shadowColor = info.glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Rarity text
        ctx.fillStyle = info.color;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(info.name, cx, cy + 10);

        // Stars
        ctx.fillStyle = info.color;
        ctx.font = '24px monospace';
        const stars = '★'.repeat(info.stars);
        ctx.fillText(stars, cx, cy + 45);

        ctx.shadowBlur = 0;

        // "Opening..." text
        ctx.fillStyle = '#78909c';
        ctx.font = '14px monospace';
        ctx.fillText('Opening...', cx, cy - radius - 20);

        // Progress bar
        const pct = Math.min(this.timer / 2.5, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx - 100, cy + 80, 200, 6);
        ctx.fillStyle = info.color;
        ctx.fillRect(cx - 100, cy + 80, 200 * pct, 6);
    }

    drawRevealing(ctx, w, h, cx, cy) {
        const info = GACHA_RARITIES[this.result];
        const t = Math.min(this.timer / 1.0, 1);
        const eased = Utils.easeOutElastic(t);

        // Dramatic background rays
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + this.timer * 0.5;
            ctx.rotate(angle);
            ctx.fillStyle = `rgba(${this.result === 'mythic' ? '255,23,68' : '255,255,255'}, ${0.05 * eased})`;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-20, -400 * eased);
            ctx.lineTo(20, -400 * eased);
            ctx.closePath();
            ctx.fill();
            ctx.rotate(-angle);
        }
        ctx.restore();

        // Expanding circle
        const expandRadius = 150 * eased;
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 40 * eased;
        ctx.shadowColor = info.glow;
        ctx.beginPath();
        ctx.arc(cx, cy, expandRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Rarity banner
        if (t > 0.3) {
            const bannerAlpha = Math.min((t - 0.3) / 0.3, 1);
            ctx.globalAlpha = bannerAlpha;

            // Banner background
            const bannerH = 60;
            ctx.fillStyle = `rgba(0,0,0,0.8)`;
            ctx.fillRect(0, cy - bannerH / 2 - 40, w, bannerH);
            ctx.fillStyle = info.color;
            ctx.fillRect(0, cy - bannerH / 2 - 40, w, 3);
            ctx.fillRect(0, cy + bannerH / 2 - 40 - 3, w, 3);

            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 20;
            ctx.shadowColor = info.glow;
            ctx.fillStyle = info.color;
            ctx.fillText(`★ ${info.name.toUpperCase()} ★`, cx, cy - 20);

            // Stars animation
            const stars = info.stars;
            ctx.font = '28px monospace';
            for (let i = 0; i < stars; i++) {
                const starDelay = 0.3 + i * 0.1;
                if (t > starDelay) {
                    const starAlpha = Math.min((t - starDelay) / 0.2, 1);
                    ctx.globalAlpha = starAlpha * bannerAlpha;
                    const sx = cx - (stars - 1) * 18 + i * 36;
                    const bounce = Math.sin((t - starDelay) * 8) * 5 * (1 - Math.min((t - starDelay), 0.5));
                    ctx.fillText('★', sx, cy + 15 - bounce);
                }
            }

            ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
    }

    drawReward(ctx, w, h, cx, cy) {
        const info = GACHA_RARITIES[this.result];
        const reward = this.reward;
        if (!reward) return;

        // Subtle background glow
        const glowRadius = 200 + Math.sin(this.bannerPulse) * 20;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        grad.addColorStop(0, `${info.color}22`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Reward card
        const cardW = 280;
        const cardH = 300;
        const cardX = cx - cardW / 2;
        const cardY = cy - cardH / 2;

        // Card bg
        ctx.fillStyle = 'rgba(15,15,25,0.95)';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Rarity bar top
        ctx.fillStyle = info.color;
        ctx.fillRect(cardX, cardY, cardW, 4);

        // Type label
        ctx.textAlign = 'center';
        ctx.fillStyle = '#546e7a';
        ctx.font = '10px monospace';
        ctx.fillText(reward.type.toUpperCase(), cx, cardY + 22);

        // Icon area
        ctx.font = '48px monospace';
        let icon = '?';
        let name = 'Unknown';
        let desc = '';

        switch (reward.type) {
            case 'weapon':
                icon = '⚔';
                name = reward.item.getDisplayName();
                desc = `DMG: ${reward.item.damage} | ${reward.item.weaponType}`;
                if (reward.item.effects.length > 0) {
                    desc += `\nEffects: ${reward.item.effects.join(', ')}`;
                }
                break;
            case 'relic':
                icon = reward.item.icon;
                name = reward.item.name;
                desc = reward.item.desc;
                break;
            case 'consumable':
                icon = '🧪';
                name = `${reward.item.potions} Potions`;
                desc = 'Heal 40% HP each';
                break;
            case 'gold':
                icon = '💰';
                name = `${reward.item.amount} Gold`;
                desc = 'Pure treasure!';
                break;
            case 'stat':
                icon = '⬆';
                name = reward.item.name;
                desc = 'Permanent stat boost';
                break;
            case 'pet':
                icon = reward.item.icon || '🐾';
                name = reward.item.name;
                desc = reward.item.desc || 'A new companion!';
                break;
        }

        ctx.fillText(icon, cx, cardY + 90);

        // Name
        ctx.fillStyle = info.color;
        ctx.font = 'bold 16px monospace';
        ctx.shadowBlur = 10;
        ctx.shadowColor = info.glow;
        ctx.fillText(name, cx, cardY + 130);
        ctx.shadowBlur = 0;

        // Rarity
        ctx.fillStyle = info.color;
        ctx.font = '11px monospace';
        ctx.fillText(`[${info.name.toUpperCase()}]`, cx, cardY + 150);

        // Stars
        ctx.font = '18px monospace';
        const stars = '★'.repeat(info.stars) + '☆'.repeat(6 - info.stars);
        ctx.fillText(stars, cx, cardY + 175);

        // Description
        ctx.fillStyle = '#b0bec5';
        ctx.font = '12px monospace';
        const lines = desc.split('\n');
        lines.forEach((line, i) => {
            ctx.fillText(line, cx, cardY + 205 + i * 16);
        });

        // Accept button
        const pulse = Math.sin(this.bannerPulse * 2) * 0.15 + 0.85;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = info.color;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('[ Press SPACE or Click to Accept ]', cx, cardY + cardH - 20);
        ctx.globalAlpha = 1;

        // Pity counter (subtle)
        ctx.fillStyle = '#263238';
        ctx.font = '9px monospace';
        ctx.fillText(`Pull #${this.pullCount} | Pity: ${this.pityThreshold - this.pullCount % this.pityThreshold}`, cx, cardY + cardH + 20);
    }
}
