// ============================================
// ENCHANT - Weapon enchantment & upgrade system
// ============================================

const ENCHANT_PREFIXES = [
    { name: 'Blazing',    color: '#ff6d00', stat: 'fire',    desc: 'Burns enemies', dmgBonus: 0.15 },
    { name: 'Frozen',     color: '#4fc3f7', stat: 'ice',     desc: 'Slows enemies', dmgBonus: 0.10 },
    { name: 'Venomous',   color: '#66bb6a', stat: 'poison',  desc: 'Poison damage', dmgBonus: 0.12 },
    { name: 'Vampiric',   color: '#e91e63', stat: 'lifesteal', desc: 'Steals life', dmgBonus: 0.08 },
    { name: 'Thunder',    color: '#ffeb3b', stat: 'chain',   desc: 'Chain lightning', dmgBonus: 0.20 },
    { name: 'Holy',       color: '#fff9c4', stat: 'holy',    desc: 'Bonus vs undead', dmgBonus: 0.25 },
    { name: 'Void',       color: '#7c4dff', stat: 'void',    desc: 'Armor piercing', dmgBonus: 0.18 },
    { name: 'Bloodthirst', color: '#d50000', stat: 'rage',   desc: 'DMG up on kill', dmgBonus: 0.10 },
];

const ENCHANT_SUFFIXES = [
    { name: 'of Fury',     stat: 'attackSpeed', val: 0.15, desc: '+15% Attack Speed' },
    { name: 'of Giants',   stat: 'knockback',   val: 1.5,  desc: '+50% Knockback' },
    { name: 'of the Wind',  stat: 'range',      val: 1.2,  desc: '+20% Range' },
    { name: 'of Precision', stat: 'crit',       val: 0.10, desc: '+10% Crit Chance' },
    { name: 'of Slaughter', stat: 'aoe',        val: 1.3,  desc: '+30% AoE' },
    { name: 'of Fortune',   stat: 'gold',       val: 2.0,  desc: '2x Gold from kills' },
    { name: 'of the Sage',  stat: 'xp',         val: 1.5,  desc: '+50% XP' },
    { name: 'of Eternity',  stat: 'duration',   val: 1.5,  desc: '+50% Effect Duration' },
];

class EnchantSystem {
    constructor() {
        this.active = false;
        this.selectedWeapon = null;
        this.enchantResult = null;
        this.animTimer = 0;
        this.enchantCost = 30; // gold cost
    }

    canEnchant(player) {
        return player.weapons.length > 0 && player.gold >= this.enchantCost;
    }

    startEnchant(weapon, player) {
        if (player.gold < this.enchantCost) return false;
        player.gold -= this.enchantCost;

        this.active = true;
        this.selectedWeapon = weapon;
        this.animTimer = 0;

        // Determine enchantment
        const addPrefix = Math.random() < 0.6;
        const addSuffix = Math.random() < 0.5;

        if (addPrefix) {
            const prefix = Utils.randChoice(ENCHANT_PREFIXES);
            if (!weapon.enchantPrefix) {
                weapon.enchantPrefix = prefix;
                weapon.damage = Math.floor(weapon.damage * (1 + prefix.dmgBonus));
                if (!weapon.effects.includes(prefix.stat)) {
                    weapon.effects.push(prefix.stat);
                }
            }
        }

        if (addSuffix) {
            const suffix = Utils.randChoice(ENCHANT_SUFFIXES);
            if (!weapon.enchantSuffix) {
                weapon.enchantSuffix = suffix;
                // Apply suffix effect
                switch (suffix.stat) {
                    case 'attackSpeed': weapon.cooldown *= (1 - suffix.val); break;
                    case 'knockback': weapon.knockback *= suffix.val; break;
                    case 'range': weapon.range = Math.floor(weapon.range * suffix.val); break;
                    case 'crit': break; // Applied in combat
                    case 'aoe': weapon.arc *= suffix.val; break;
                }
            }
        }

        // Update weapon name
        this.updateWeaponName(weapon);

        this.enchantResult = weapon;
        this.enchantCost = Math.floor(this.enchantCost * 1.3); // Increase cost

        GameAudio.play('levelUp');
        Utils.addShake(6);
        Utils.addFlash('#ffd740', 0.3);

        return true;
    }

    updateWeaponName(weapon) {
        let name = weapon.baseDamage ? weapon.name : weapon.name;
        if (weapon.enchantPrefix) {
            name = weapon.enchantPrefix.name + ' ' + name;
        }
        if (weapon.enchantSuffix) {
            name = name + ' ' + weapon.enchantSuffix.name;
        }
        weapon.name = name;
    }

    close() {
        this.active = false;
        this.enchantResult = null;
    }
}

// ============================================
// KILL STREAK - Reward system for consecutive kills
// ============================================

class KillStreakSystem {
    constructor() {
        this.streak = 0;
        this.streakTimer = 0;
        this.streakTimeout = 5; // seconds to maintain streak
        this.bestStreak = 0;
        this.milestones = [5, 10, 15, 25, 50, 100];
        this.lastMilestone = 0;
        this.displayTimer = 0;
        this.displayText = '';
        this.displayColor = '';
    }

    addKill() {
        this.streak++;
        this.streakTimer = this.streakTimeout;
        this.bestStreak = Math.max(this.bestStreak, this.streak);

        // Check milestones
        for (const ms of this.milestones) {
            if (this.streak === ms && this.streak > this.lastMilestone) {
                this.lastMilestone = ms;
                this.triggerMilestone(ms);
                break;
            }
        }
    }

    triggerMilestone(count) {
        switch (count) {
            case 5:
                this.showDisplay('KILLING SPREE!', '#ff9800');
                break;
            case 10:
                this.showDisplay('RAMPAGE!', '#ff5722');
                Utils.addShake(8);
                break;
            case 15:
                this.showDisplay('UNSTOPPABLE!', '#f44336');
                Utils.addShake(10);
                Utils.addFlash('#ff1744', 0.3);
                break;
            case 25:
                this.showDisplay('GODLIKE!', '#ff1744');
                Utils.addShake(15);
                Utils.addFlash('#ff1744', 0.5);
                Utils.addSlowMo(0.3, 0.5);
                break;
            case 50:
                this.showDisplay('☠ LEGENDARY ☠', '#ffd740');
                Utils.addShake(20);
                Utils.addFlash('#ffd740', 0.6);
                Utils.addSlowMo(0.2, 1.0);
                break;
            case 100:
                this.showDisplay('★ IMMORTAL ★', '#ff1744');
                Utils.addShake(25);
                Utils.addFlash('#ff1744', 0.8);
                Utils.addSlowMo(0.1, 1.5);
                break;
        }
        GameAudio.play('levelUp');
    }

    showDisplay(text, color) {
        this.displayText = text;
        this.displayColor = color;
        this.displayTimer = 3;
    }

    update(dt) {
        if (this.streakTimer > 0) {
            this.streakTimer -= dt;
            if (this.streakTimer <= 0) {
                this.streak = 0;
                this.lastMilestone = 0;
            }
        }

        if (this.displayTimer > 0) {
            this.displayTimer -= dt;
        }
    }

    getStreakMultiplier() {
        if (this.streak < 5) return 1;
        if (this.streak < 10) return 1.2;
        if (this.streak < 25) return 1.5;
        if (this.streak < 50) return 2.0;
        return 3.0;
    }

    draw(ctx, w, h) {
        // Streak counter (top center)
        if (this.streak >= 3) {
            ctx.textAlign = 'center';
            const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 0.85;

            // Streak number
            const color = this.streak >= 25 ? '#ff1744' :
                         this.streak >= 15 ? '#ff5722' :
                         this.streak >= 10 ? '#ff9800' :
                         this.streak >= 5 ? '#ffc107' : '#78909c';

            ctx.fillStyle = color;
            ctx.globalAlpha = pulse;
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`🔥 ${this.streak} Kill Streak (x${this.getStreakMultiplier().toFixed(1)})`, w / 2, 55);
            ctx.globalAlpha = 1;

            // Timer bar
            const barW = 100;
            const barH = 3;
            const pct = this.streakTimer / this.streakTimeout;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(w / 2 - barW / 2, 60, barW, barH);
            ctx.fillStyle = color;
            ctx.fillRect(w / 2 - barW / 2, 60, barW * pct, barH);
        }

        // Milestone display
        if (this.displayTimer > 0) {
            const alpha = Math.min(this.displayTimer, 1);
            const scale = 1 + (3 - this.displayTimer) * 0.05;

            ctx.save();
            ctx.translate(w / 2, h * 0.35);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px monospace';
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.displayColor;
            ctx.fillStyle = this.displayColor;
            ctx.fillText(this.displayText, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}
