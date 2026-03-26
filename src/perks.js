// ============================================
// PERKS - Level-up choice system (roguelike core)
// ============================================

const PERK_POOL = [
    {
        id: 'maxHp',
        name: 'Vitality',
        description: '+20 Max HP',
        icon: '♥',
        color: '#f44336',
        rarity: 'common',
        apply(player) { player.maxHp += 20; player.hp += 20; },
    },
    {
        id: 'attack',
        name: 'Strength',
        description: '+5 Attack',
        icon: '⚔',
        color: '#ff9800',
        rarity: 'common',
        apply(player) { player.attack += 5; },
    },
    {
        id: 'speed',
        name: 'Swiftness',
        description: '+20 Move Speed',
        icon: '→',
        color: '#4fc3f7',
        rarity: 'common',
        apply(player) { player.speed += 20; },
    },
    {
        id: 'defense',
        name: 'Toughness',
        description: '+3 Defense',
        icon: '◆',
        color: '#78909c',
        rarity: 'common',
        apply(player) { player.defense += 3; },
    },
    {
        id: 'crit',
        name: 'Precision',
        description: '+8% Crit Chance',
        icon: '!',
        color: '#ffeb3b',
        rarity: 'uncommon',
        apply(player) { player.critChance += 0.08; },
    },
    {
        id: 'critDmg',
        name: 'Brutality',
        description: '+50% Crit Damage',
        icon: '!!',
        color: '#ff5722',
        rarity: 'uncommon',
        apply(player) { player.critMultiplier += 0.5; },
    },
    {
        id: 'lifesteal',
        name: 'Vampirism',
        description: '+5% Lifesteal',
        icon: '♦',
        color: '#e91e63',
        rarity: 'rare',
        apply(player) { player.lifesteal += 0.05; },
    },
    {
        id: 'dashCd',
        name: 'Agility',
        description: '-0.3s Dash Cooldown',
        icon: '⤷',
        color: '#64ffda',
        rarity: 'uncommon',
        apply(player) { player.dashMaxCooldown = Math.max(0.3, player.dashMaxCooldown - 0.3); },
    },
    {
        id: 'potionPower',
        name: 'Alchemy',
        description: '+2 Potions & Full Heal',
        icon: '+',
        color: '#66bb6a',
        rarity: 'uncommon',
        apply(player) { player.potions += 2; player.hp = player.maxHp; },
    },
    {
        id: 'comboMaster',
        name: 'Combo Master',
        description: 'Combo timer +2s & +3 Attack',
        icon: 'C',
        color: '#ff4081',
        rarity: 'rare',
        apply(player) { player.attack += 3; },
        // Combo timer increase would need to be tracked separately
    },
    {
        id: 'tankUp',
        name: 'Iron Will',
        description: '+40 Max HP, +2 Defense',
        icon: '■',
        color: '#546e7a',
        rarity: 'rare',
        apply(player) { player.maxHp += 40; player.hp += 40; player.defense += 2; },
    },
    {
        id: 'berserker',
        name: 'Berserker',
        description: '+10 Attack, -15 Max HP',
        icon: '✕',
        color: '#d50000',
        rarity: 'rare',
        apply(player) {
            player.attack += 10;
            player.maxHp = Math.max(20, player.maxHp - 15);
            player.hp = Math.min(player.hp, player.maxHp);
        },
    },
    {
        id: 'glass_cannon',
        name: 'Glass Cannon',
        description: '+15 Attack, +15% Crit, -30 Max HP',
        icon: '☆',
        color: '#ffd740',
        rarity: 'epic',
        apply(player) {
            player.attack += 15;
            player.critChance += 0.15;
            player.maxHp = Math.max(20, player.maxHp - 30);
            player.hp = Math.min(player.hp, player.maxHp);
        },
    },
];

class PerkSystem {
    constructor() {
        this.active = false;
        this.choices = [];
        this.selectedIndex = -1;
        this.animTimer = 0;
    }

    generateChoices(playerLevel) {
        // Weight by rarity
        const rarityWeights = {
            common: Math.max(50 - playerLevel * 2, 15),
            uncommon: 30 + playerLevel,
            rare: 15 + playerLevel * 2,
            epic: Math.min(5 + playerLevel, 20),
        };

        const available = [...PERK_POOL];
        const choices = [];

        for (let i = 0; i < 3 && available.length > 0; i++) {
            // Weight selection
            const weights = available.map(p => rarityWeights[p.rarity] || 10);
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            let idx = 0;
            for (let j = 0; j < weights.length; j++) {
                r -= weights[j];
                if (r <= 0) { idx = j; break; }
            }

            choices.push(available[idx]);
            available.splice(idx, 1);
        }

        return choices;
    }

    show(playerLevel) {
        this.active = true;
        this.choices = this.generateChoices(playerLevel);
        this.selectedIndex = -1;
        this.animTimer = 0;
    }

    select(index, player) {
        if (index < 0 || index >= this.choices.length) return false;
        const perk = this.choices[index];
        perk.apply(player);
        this.active = false;
        return perk;
    }

    update(dt) {
        if (this.active) {
            this.animTimer += dt;
        }
    }

    draw(ctx, w, h) {
        if (!this.active) return;

        // Background overlay
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64ffda';
        ctx.font = 'bold 28px monospace';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#64ffda';
        ctx.fillText('LEVEL UP!', w / 2, h * 0.18);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#78909c';
        ctx.font = '14px monospace';
        ctx.fillText('Choose a perk:', w / 2, h * 0.24);

        // Draw choices
        const cardW = 200;
        const cardH = 160;
        const gap = 30;
        const totalW = this.choices.length * cardW + (this.choices.length - 1) * gap;
        const startX = (w - totalW) / 2;
        const cardY = h * 0.32;

        for (let i = 0; i < this.choices.length; i++) {
            const perk = this.choices[i];
            const x = startX + i * (cardW + gap);

            // Card entrance animation
            const delay = i * 0.1;
            const animT = Math.max(0, this.animTimer - delay);
            const slide = Math.min(1, animT * 4);
            const eased = Utils.easeOutElastic(Math.min(slide, 1));
            const cardScale = eased;

            ctx.save();
            ctx.translate(x + cardW / 2, cardY + cardH / 2);
            ctx.scale(cardScale, cardScale);
            ctx.translate(-(x + cardW / 2), -(cardY + cardH / 2));

            const isHovered = this.selectedIndex === i;

            // Card background
            ctx.fillStyle = isHovered ? 'rgba(40,40,60,0.95)' : 'rgba(25,25,40,0.95)';
            ctx.fillRect(x, cardY, cardW, cardH);

            // Card border
            ctx.strokeStyle = isHovered ? perk.color : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.strokeRect(x, cardY, cardW, cardH);

            // Rarity bar
            const rarityColors = {
                common: '#9e9e9e', uncommon: '#4caf50',
                rare: '#2196f3', epic: '#9c27b0'
            };
            ctx.fillStyle = rarityColors[perk.rarity] || '#9e9e9e';
            ctx.fillRect(x, cardY, cardW, 3);

            // Icon
            ctx.fillStyle = perk.color;
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(perk.icon, x + cardW / 2, cardY + 45);

            // Name
            ctx.fillStyle = '#e0e0e0';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(perk.name, x + cardW / 2, cardY + 75);

            // Rarity
            ctx.fillStyle = rarityColors[perk.rarity] || '#9e9e9e';
            ctx.font = '10px monospace';
            ctx.fillText(`[${perk.rarity.toUpperCase()}]`, x + cardW / 2, cardY + 92);

            // Description
            ctx.fillStyle = '#b0bec5';
            ctx.font = '11px monospace';
            const lines = this.wrapText(perk.description, 22);
            lines.forEach((line, li) => {
                ctx.fillText(line, x + cardW / 2, cardY + 115 + li * 14);
            });

            // Key hint
            ctx.fillStyle = isHovered ? perk.color : '#455a64';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`[${i + 1}]`, x + cardW / 2, cardY + cardH - 10);

            ctx.restore();
        }

        // Instructions
        ctx.textAlign = 'center';
        ctx.fillStyle = '#546e7a';
        ctx.font = '12px monospace';
        ctx.fillText('Press 1, 2, or 3 to choose  |  Hover to preview', w / 2, h * 0.82);
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

    handleMouseMove(mouseX, mouseY, canvasW, canvasH) {
        if (!this.active) return;

        const cardW = 200;
        const cardH = 160;
        const gap = 30;
        const totalW = this.choices.length * cardW + (this.choices.length - 1) * gap;
        const startX = (canvasW - totalW) / 2;
        const cardY = canvasH * 0.32;

        this.selectedIndex = -1;
        for (let i = 0; i < this.choices.length; i++) {
            const x = startX + i * (cardW + gap);
            if (mouseX >= x && mouseX <= x + cardW &&
                mouseY >= cardY && mouseY <= cardY + cardH) {
                this.selectedIndex = i;
                break;
            }
        }
    }
}
