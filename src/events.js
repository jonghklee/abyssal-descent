// ============================================
// EVENTS - Random dungeon events & encounters
// ============================================

const EVENT_TYPES = {
    // Shrine events - found in shrine rooms
    shrine_power: {
        name: 'Shrine of Power',
        description: 'A glowing crimson altar pulses with raw energy.',
        icon: '🔴',
        color: '#ff1744',
        choices: [
            { text: 'Pray (+8 ATK, -15 HP)', apply: (p) => { p.attack += 8; p.maxHp -= 15; p.hp = Math.min(p.hp, p.maxHp); } },
            { text: 'Offer Gold (50g → Random Relic)', cost: { gold: 50 }, giveRelic: true },
            { text: 'Leave', apply: () => {} },
        ],
    },
    shrine_life: {
        name: 'Fountain of Life',
        description: 'Crystal clear water glows with healing energy.',
        icon: '💚',
        color: '#4caf50',
        choices: [
            { text: 'Drink (Full Heal + 10 Max HP)', apply: (p) => { p.maxHp += 10; p.hp = p.maxHp; } },
            { text: 'Bottle it (+3 Potions)', apply: (p) => { p.potions += 3; } },
            { text: 'Leave', apply: () => {} },
        ],
    },
    shrine_fortune: {
        name: 'Shrine of Fortune',
        description: 'Golden coins orbit a mysterious statue.',
        icon: '🎰',
        color: '#ffd740',
        choices: [
            { text: 'Gamble (50% → Double Gold, 50% → Lose All)', apply: (p) => {
                if (Math.random() < 0.5) { p.gold *= 2; return '💰 Double Gold!'; }
                else { p.gold = 0; return '💀 Lost everything!'; }
            }},
            { text: 'Pray for Luck (+10% Crit)', apply: (p) => { p.critChance += 0.1; } },
            { text: 'Leave', apply: () => {} },
        ],
    },
    shrine_chaos: {
        name: 'Altar of Chaos',
        description: 'Reality warps around a pulsating void crystal.',
        icon: '🌀',
        color: '#7c4dff',
        choices: [
            { text: 'Embrace Chaos (Random +/- to ALL stats)', apply: (p) => {
                const stats = ['attack', 'defense', 'speed', 'maxHp'];
                const changes = [];
                for (const stat of stats) {
                    const change = Utils.randInt(-5, 10);
                    if (stat === 'maxHp') {
                        p.maxHp += change * 3;
                        p.hp = Math.min(p.hp, p.maxHp);
                        changes.push(`HP ${change * 3 >= 0 ? '+' : ''}${change * 3}`);
                    } else {
                        p[stat] += change;
                        changes.push(`${stat} ${change >= 0 ? '+' : ''}${change}`);
                    }
                }
                return changes.join(', ');
            }},
            { text: 'Touch the Void (Gacha Pull!)', triggerGacha: true },
            { text: 'Leave', apply: () => {} },
        ],
    },
    shrine_sacrifice: {
        name: 'Blood Altar',
        description: 'Dark runes glow around a sacrificial stone.',
        icon: '🩸',
        color: '#d50000',
        choices: [
            { text: 'Sacrifice HP (Lose 30% HP → +15 ATK)', apply: (p) => {
                p.hp = Math.max(1, Math.floor(p.hp * 0.7));
                p.attack += 15;
            }},
            { text: 'Sacrifice Weapon (Destroy current → Epic Weapon)', destroyWeapon: true },
            { text: 'Leave', apply: () => {} },
        ],
    },

    // Random encounters
    mysterious_merchant: {
        name: 'Mysterious Merchant',
        description: 'A hooded figure offers rare wares...',
        icon: '🧙',
        color: '#ff9800',
        choices: [
            { text: 'Buy Potion (15g)', cost: { gold: 15 }, apply: (p) => { p.potions++; } },
            { text: 'Buy Random Weapon (80g)', cost: { gold: 80 }, giveWeapon: true },
            { text: 'Buy Gacha Ticket (40g)', cost: { gold: 40 }, triggerGacha: true },
            { text: 'Leave', apply: () => {} },
        ],
    },
    trapped_soul: {
        name: 'Trapped Soul',
        description: 'A ghostly figure pleads for release...',
        icon: '👤',
        color: '#b3e5fc',
        choices: [
            { text: 'Free it (+30 XP, Blessing)', apply: (p) => {
                p.gainXP(30);
                p.defense += 2;
                return 'The soul blesses you. +2 DEF';
            }},
            { text: 'Absorb it (+20 HP, Curse: -2 DEF)', apply: (p) => {
                p.maxHp += 20; p.hp += 20;
                p.defense = Math.max(0, p.defense - 2);
            }},
            { text: 'Ignore', apply: () => {} },
        ],
    },
    treasure_goblin: {
        name: 'Treasure Goblin!',
        description: 'A gleeful goblin runs by carrying gold!',
        icon: '👺',
        color: '#ffd740',
        timed: true,
        timedDuration: 3,
        choices: [
            { text: 'CATCH IT! (+100g + Gacha)', apply: (p) => { p.gold += 100; }, triggerGacha: true },
        ],
        failText: 'The goblin escaped!',
    },
    cursed_chest: {
        name: 'Cursed Chest',
        description: 'Dark energy seeps from an ornate chest.',
        icon: '📦',
        color: '#8e24aa',
        choices: [
            { text: 'Open it (Risk curse, guaranteed Epic+ reward)', triggerGacha: true, guaranteedRarity: 'epic',
              apply: (p) => {
                  // 30% chance of curse
                  if (Math.random() < 0.3) {
                      const curses = [
                          () => { p.maxHp -= 20; p.hp = Math.min(p.hp, p.maxHp); return 'Cursed: -20 Max HP'; },
                          () => { p.defense = Math.max(0, p.defense - 3); return 'Cursed: -3 DEF'; },
                          () => { p.speed = Math.max(80, p.speed - 20); return 'Cursed: -20 Speed'; },
                      ];
                      return Utils.randChoice(curses)();
                  }
                  return 'No curse this time!';
              }
            },
            { text: 'Leave it alone', apply: () => {} },
        ],
    },
};

// Elite enemy modifiers
const ELITE_MODIFIERS = [
    { name: 'Blazing', color: '#ff6d00', icon: '🔥',
      apply: (e) => { e.baseAttack *= 1.3; e.name = '🔥 ' + e.name; },
      onHitPlayer: (p) => { /* burn damage over time handled in game */ } },
    { name: 'Frostborn', color: '#4fc3f7', icon: '❄',
      apply: (e) => { e.maxHp *= 1.5; e.hp = e.maxHp; e.name = '❄ ' + e.name; } },
    { name: 'Vampiric', color: '#e91e63', icon: '🦇',
      apply: (e) => { e.vampiric = true; e.name = '🦇 ' + e.name; } },
    { name: 'Swift', color: '#64ffda', icon: '⚡',
      apply: (e) => { e.speed *= 1.8; e.name = '⚡ ' + e.name; } },
    { name: 'Titan', color: '#ff9800', icon: '👑',
      apply: (e) => {
          e.maxHp *= 2.5; e.hp = e.maxHp;
          e.baseAttack *= 1.5;
          e.w *= 1.3; e.h *= 1.3;
          e.xpReward *= 3; e.goldReward *= 3;
          e.name = '👑 ' + e.name;
          e.isElite = true;
      }},
    { name: 'Ghostly', color: '#b3e5fc', icon: '👻',
      apply: (e) => { e.phasing = true; e.name = '👻 ' + e.name; } },
    { name: 'Explosive', color: '#ff1744', icon: '💥',
      apply: (e) => { e.explosive = true; e.name = '💥 ' + e.name; } },
];

class EventSystem {
    constructor() {
        this.activeEvent = null;
        this.selectedChoice = -1;
        this.eventResult = null;
        this.resultTimer = 0;
        this.timedEventTimer = 0;
        this.timedFailed = false;
    }

    triggerRandomEvent(room) {
        const eventPool = [];

        if (room.type === 'shrine') {
            eventPool.push('shrine_power', 'shrine_life', 'shrine_fortune', 'shrine_chaos', 'shrine_sacrifice');
        } else {
            eventPool.push('mysterious_merchant', 'trapped_soul', 'cursed_chest');
            if (Math.random() < 0.15) eventPool.push('treasure_goblin');
        }

        const eventId = Utils.randChoice(eventPool);
        this.showEvent(eventId);
    }

    showEvent(eventId) {
        const def = EVENT_TYPES[eventId];
        if (!def) return;

        this.activeEvent = { ...def, id: eventId };
        this.selectedChoice = -1;
        this.eventResult = null;
        this.resultTimer = 0;
        this.timedFailed = false;

        if (def.timed) {
            this.timedEventTimer = def.timedDuration;
        }
    }

    update(dt) {
        if (!this.activeEvent) return;

        if (this.eventResult) {
            this.resultTimer += dt;
            if (this.resultTimer > 2) {
                this.activeEvent = null;
                this.eventResult = null;
            }
            return;
        }

        // Timed events
        if (this.activeEvent.timed && !this.timedFailed) {
            this.timedEventTimer -= dt;
            if (this.timedEventTimer <= 0) {
                this.timedFailed = true;
                this.eventResult = this.activeEvent.failText || 'Too slow!';
                this.resultTimer = 0;
            }
        }
    }

    selectChoice(index, player, gameRef) {
        if (!this.activeEvent || this.eventResult) return null;
        if (this.timedFailed) return null;

        const choice = this.activeEvent.choices[index];
        if (!choice) return null;

        // Check cost
        if (choice.cost) {
            if (choice.cost.gold && player.gold < choice.cost.gold) {
                return 'Not enough gold!';
            }
            if (choice.cost.gold) player.gold -= choice.cost.gold;
        }

        // Apply effect
        let result = '';
        if (choice.apply) {
            const r = choice.apply(player);
            if (typeof r === 'string') result = r;
        }

        // Special actions
        if (choice.triggerGacha && gameRef.gacha) {
            gameRef.gacha.pull(gameRef.floor, (reward) => {
                if (reward.type === 'weapon') {
                    gameRef.weaponPickup = reward.item;
                }
            });
            this.activeEvent = null;
            return null;
        }

        if (choice.giveRelic) {
            const relic = Utils.randChoice(RELIC_POOL);
            relic.apply(player);
            if (!player.relics) player.relics = [];
            player.relics.push(relic);
            result = `Received: ${relic.name}!`;
        }

        if (choice.giveWeapon && gameRef) {
            const weapon = gameRef.items.generateWeapon(gameRef.floor);
            gameRef.weaponPickup = weapon;
        }

        if (choice.destroyWeapon && player.weapons.length > 0) {
            player.weapons.splice(player.currentWeapon, 1);
            if (player.currentWeapon >= player.weapons.length) {
                player.currentWeapon = Math.max(0, player.weapons.length - 1);
            }
            const weapon = new Weapon(Utils.randChoice(Object.keys(WEAPON_TYPES)), 'epic');
            player.weapons.push(weapon);
            player.currentWeapon = player.weapons.length - 1;
            result = `Received: ${weapon.getDisplayName()}!`;
        }

        this.eventResult = result || choice.text;
        this.resultTimer = 0;
        GameAudio.play('pickup');
        return result;
    }

    draw(ctx, w, h) {
        if (!this.activeEvent) return;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const event = this.activeEvent;
        const color = event.color;

        // Event card
        const cardW = 400;
        const cardH = 320;
        const cardX = cx - cardW / 2;
        const cardY = h * 0.2;

        ctx.fillStyle = 'rgba(15,15,25,0.95)';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = color;
        ctx.fillRect(cardX, cardY, cardW, 3);

        // Icon
        ctx.textAlign = 'center';
        ctx.font = '40px monospace';
        ctx.fillText(event.icon, cx, cardY + 50);

        // Name
        ctx.fillStyle = color;
        ctx.font = 'bold 18px monospace';
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillText(event.name, cx, cardY + 85);
        ctx.shadowBlur = 0;

        // Description
        ctx.fillStyle = '#b0bec5';
        ctx.font = '12px monospace';
        ctx.fillText(event.description, cx, cardY + 110);

        // Timed bar
        if (event.timed && !this.timedFailed) {
            const pct = this.timedEventTimer / event.timedDuration;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(cardX + 20, cardY + 120, cardW - 40, 6);
            ctx.fillStyle = pct > 0.3 ? '#ffd740' : '#ff1744';
            ctx.fillRect(cardX + 20, cardY + 120, (cardW - 40) * pct, 6);
            ctx.fillStyle = '#ffd740';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`⏰ ${this.timedEventTimer.toFixed(1)}s`, cx, cardY + 120);
        }

        // Result
        if (this.eventResult) {
            ctx.fillStyle = color;
            ctx.font = 'bold 16px monospace';
            ctx.fillText(this.eventResult, cx, cardY + 180);
            return;
        }

        // Choices
        const choiceY = cardY + 140;
        for (let i = 0; i < event.choices.length; i++) {
            const choice = event.choices[i];
            const cy = choiceY + i * 40;
            const isHovered = this.selectedChoice === i;

            ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
            ctx.fillRect(cardX + 15, cy, cardW - 30, 32);

            if (isHovered) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.strokeRect(cardX + 15, cy, cardW - 30, 32);
            }

            ctx.fillStyle = isHovered ? '#fff' : '#b0bec5';
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`[${i + 1}] ${choice.text}`, cardX + 30, cy + 20);

            if (choice.cost && choice.cost.gold) {
                ctx.fillStyle = '#ffd740';
                ctx.textAlign = 'right';
                ctx.fillText(`${choice.cost.gold}g`, cardX + cardW - 30, cy + 20);
            }
        }
        ctx.textAlign = 'center';
    }

    handleMouseMove(mouseX, mouseY, canvasW, canvasH) {
        if (!this.activeEvent || this.eventResult) return;

        const cx = canvasW / 2;
        const cardW = 400;
        const cardX = cx - cardW / 2;
        const choiceY = canvasH * 0.2 + 140;

        this.selectedChoice = -1;
        for (let i = 0; i < this.activeEvent.choices.length; i++) {
            const cy = choiceY + i * 40;
            if (mouseX >= cardX + 15 && mouseX <= cardX + cardW - 15 &&
                mouseY >= cy && mouseY <= cy + 32) {
                this.selectedChoice = i;
                break;
            }
        }
    }

    // Apply elite modifiers to enemies
    static makeElite(enemy, floor) {
        const modCount = floor >= 10 ? 2 : 1;
        const mods = [...ELITE_MODIFIERS].sort(() => Math.random() - 0.5).slice(0, modCount);
        for (const mod of mods) {
            mod.apply(enemy);
        }
        enemy.isElite = true;
        enemy.xpReward = Math.floor(enemy.xpReward * 2);
        enemy.goldReward = Math.floor(enemy.goldReward * 2);
        return enemy;
    }
}
