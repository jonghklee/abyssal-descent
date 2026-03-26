// ============================================
// ACHIEVEMENTS - Unlock system & dopamine triggers
// ============================================

const ACHIEVEMENT_DEFS = [
    { id: 'first_blood',    name: 'First Blood',        desc: 'Kill your first enemy',        icon: '🗡', check: (s) => s.kills >= 1, reward: { gold: 10 } },
    { id: 'slayer_10',      name: 'Monster Slayer',      desc: 'Kill 10 enemies',              icon: '⚔', check: (s) => s.kills >= 10, reward: { gold: 25 } },
    { id: 'slayer_50',      name: 'Dungeon Cleaner',     desc: 'Kill 50 enemies',              icon: '💀', check: (s) => s.kills >= 50, reward: { gold: 50, potion: 2 } },
    { id: 'slayer_100',     name: 'Death Incarnate',     desc: 'Kill 100 enemies',             icon: '☠', check: (s) => s.kills >= 100, reward: { gold: 100, gacha: true } },
    { id: 'slayer_500',     name: 'Genocide',            desc: 'Kill 500 enemies',             icon: '🔥', check: (s) => s.kills >= 500, reward: { gold: 500, gacha: true } },
    { id: 'floor_3',        name: 'Deeper',              desc: 'Reach floor 3',                icon: '⬇', check: (s) => s.floor >= 3, reward: { gold: 30 } },
    { id: 'floor_5',        name: 'Into the Abyss',      desc: 'Reach floor 5',                icon: '🕳', check: (s) => s.floor >= 5, reward: { gold: 50, gacha: true } },
    { id: 'floor_10',       name: 'Deep Diver',          desc: 'Reach floor 10',               icon: '🌑', check: (s) => s.floor >= 10, reward: { gold: 200, gacha: true } },
    { id: 'floor_20',       name: 'Abyss Walker',        desc: 'Reach floor 20',               icon: '👁', check: (s) => s.floor >= 20, reward: { gold: 500, gacha: true } },
    { id: 'combo_10',       name: 'Combo Starter',       desc: 'Reach 10 combo',               icon: '🔗', check: (s) => s.maxCombo >= 10, reward: { gold: 20 } },
    { id: 'combo_25',       name: 'Combo Master',        desc: 'Reach 25 combo',               icon: '⛓', check: (s) => s.maxCombo >= 25, reward: { gold: 50 } },
    { id: 'combo_50',       name: 'Combo God',           desc: 'Reach 50 combo',               icon: '💎', check: (s) => s.maxCombo >= 50, reward: { gold: 200, gacha: true } },
    { id: 'gold_100',       name: 'Coin Collector',      desc: 'Collect 100 gold',             icon: '🪙', check: (s) => s.totalGold >= 100, reward: { potion: 1 } },
    { id: 'gold_1000',      name: 'Treasure Hunter',     desc: 'Collect 1000 gold',            icon: '💰', check: (s) => s.totalGold >= 1000, reward: { gacha: true } },
    { id: 'streak_10',      name: 'Rampage',             desc: '10 kill streak',               icon: '🔥', check: (s) => s.bestStreak >= 10, reward: { gold: 40 } },
    { id: 'streak_25',      name: 'Godlike',             desc: '25 kill streak',               icon: '⚡', check: (s) => s.bestStreak >= 25, reward: { gold: 100, gacha: true } },
    { id: 'boss_kill',      name: 'Boss Slayer',         desc: 'Defeat a boss',                icon: '👑', check: (s) => s.bossKills >= 1, reward: { gold: 100, gacha: true } },
    { id: 'boss_5',         name: 'Boss Hunter',         desc: 'Defeat 5 bosses',              icon: '🏆', check: (s) => s.bossKills >= 5, reward: { gold: 300, gacha: true } },
    { id: 'crit_kill',      name: 'Critical Strike',     desc: 'Kill with a critical hit',     icon: '💥', check: (s) => s.critKills >= 1, reward: { gold: 15 } },
    { id: 'nodamage_room',  name: 'Untouchable',         desc: 'Clear a room without damage',  icon: '🛡', check: (s) => s.perfectRooms >= 1, reward: { gold: 50 } },
    { id: 'relic_5',        name: 'Collector',           desc: 'Collect 5 relics',             icon: '🎒', check: (s) => s.relicCount >= 5, reward: { gold: 75 } },
    { id: 'gacha_legend',   name: 'Lucky!',              desc: 'Pull a Legendary from gacha',  icon: '🌟', check: (s) => s.legendaryPulls >= 1, reward: { gold: 200 } },
    { id: 'gacha_mythic',   name: 'MYTHIC!!!',           desc: 'Pull a Mythic from gacha',     icon: '✨', check: (s) => s.mythicPulls >= 1, reward: { gold: 1000 } },
    { id: 'level_10',       name: 'Veteran',             desc: 'Reach level 10',               icon: '⭐', check: (s) => s.level >= 10, reward: { gold: 100, gacha: true } },
    { id: 'level_20',       name: 'Master',              desc: 'Reach level 20',               icon: '🌟', check: (s) => s.level >= 20, reward: { gold: 300, gacha: true } },
    { id: 'elite_kill',     name: 'Elite Hunter',        desc: 'Kill an elite enemy',          icon: '💎', check: (s) => s.eliteKills >= 1, reward: { gold: 30 } },
    { id: 'elite_10',       name: 'Elite Slayer',        desc: 'Kill 10 elite enemies',        icon: '👑', check: (s) => s.eliteKills >= 10, reward: { gold: 150, gacha: true } },
];

class AchievementSystem {
    constructor() {
        this.unlocked = new Set();
        this.queue = []; // Achievement display queue
        this.displayTimer = 0;
        this.current = null;
        this.stats = {
            kills: 0, floor: 1, maxCombo: 0, totalGold: 0,
            bestStreak: 0, bossKills: 0, critKills: 0,
            perfectRooms: 0, relicCount: 0, legendaryPulls: 0,
            mythicPulls: 0, level: 1, eliteKills: 0,
        };
    }

    updateStats(player, game) {
        this.stats.kills = player.kills;
        this.stats.floor = game.floor;
        this.stats.maxCombo = player.maxCombo;
        this.stats.totalGold = player.gold; // Simplified
        this.stats.bestStreak = game.killStreak ? game.killStreak.bestStreak : 0;
        this.stats.level = player.level;
        this.stats.relicCount = player.relics ? player.relics.length : 0;
    }

    addStat(stat, value = 1) {
        if (this.stats[stat] !== undefined) {
            this.stats[stat] += value;
        }
    }

    check(player, game) {
        this.updateStats(player, game);

        for (const def of ACHIEVEMENT_DEFS) {
            if (this.unlocked.has(def.id)) continue;
            if (def.check(this.stats)) {
                this.unlock(def, player, game);
            }
        }
    }

    unlock(def, player, game) {
        this.unlocked.add(def.id);
        this.queue.push(def);

        // Apply reward
        if (def.reward) {
            if (def.reward.gold) player.gold += def.reward.gold;
            if (def.reward.potion) player.potions += def.reward.potion;
            if (def.reward.gacha && game.gacha) {
                // Queue gacha after display
                setTimeout(() => {
                    game.gacha.pull(game.floor, (reward) => {
                        if (reward.type === 'weapon') game.weaponPickup = reward.item;
                    });
                }, 3000);
            }
        }

        GameAudio.play('levelUp');
    }

    update(dt) {
        if (this.current) {
            this.displayTimer -= dt;
            if (this.displayTimer <= 0) {
                this.current = null;
            }
        }

        if (!this.current && this.queue.length > 0) {
            this.current = this.queue.shift();
            this.displayTimer = 3.5;
            Utils.addFlash('#ffd740', 0.15);
        }
    }

    draw(ctx, w, h) {
        if (!this.current) return;

        const ach = this.current;
        const t = this.displayTimer / 3.5;

        // Slide in from top
        let yOff;
        if (t > 0.85) yOff = (1 - (t - 0.85) / 0.15) * 80; // slide in
        else if (t < 0.15) yOff = (0.15 - t) / 0.15 * 80; // slide out
        else yOff = 0;

        const bannerY = 10 - yOff;
        const bannerW = 320;
        const bannerH = 60;
        const bannerX = (w - bannerW) / 2;

        // Banner background
        ctx.fillStyle = 'rgba(10,10,20,0.9)';
        ctx.fillRect(bannerX, bannerY, bannerW, bannerH);

        // Gold border
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd740';
        ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);
        ctx.shadowBlur = 0;

        // Icon
        ctx.font = '28px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ach.icon, bannerX + 12, bannerY + 40);

        // Title
        ctx.fillStyle = '#ffd740';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('ACHIEVEMENT UNLOCKED', bannerX + 52, bannerY + 22);

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(ach.name, bannerX + 52, bannerY + 40);

        // Reward hint
        if (ach.reward) {
            ctx.fillStyle = '#78909c';
            ctx.font = '9px monospace';
            const rewards = [];
            if (ach.reward.gold) rewards.push(`+${ach.reward.gold}g`);
            if (ach.reward.potion) rewards.push(`+${ach.reward.potion} pot`);
            if (ach.reward.gacha) rewards.push('+Gacha!');
            ctx.fillText(rewards.join(' | '), bannerX + 52, bannerY + 54);
        }

        ctx.textAlign = 'center';
    }

    getProgress() {
        return `${this.unlocked.size}/${ACHIEVEMENT_DEFS.length}`;
    }
}
