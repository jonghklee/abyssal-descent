// ============================================
// ITEMS - Loot & Pickup system
// ============================================

class ItemDrop {
    constructor(x, y, type, data = {}) {
        this.x = x;
        this.y = y;
        this.type = type; // 'weapon', 'gold', 'potion', 'key', 'xpOrb'
        this.data = data;
        this.alive = true;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.magnetRange = 80;
        this.pickupRange = 20;

        // For auto-pickup items
        this.autoPickup = type === 'gold' || type === 'xpOrb';

        // Visual
        this.spawnVx = Utils.rand(-3, 3);
        this.spawnVy = Utils.rand(-5, -2);
        this.spawning = true;
        this.spawnTimer = 0;
    }

    update(dt, player) {
        this.bobTimer += dt * 3;

        if (this.spawning) {
            this.spawnTimer += dt;
            this.x += this.spawnVx;
            this.y += this.spawnVy;
            this.spawnVy += 15 * dt;
            if (this.spawnTimer > 0.3) {
                this.spawning = false;
            }
            return;
        }

        const dist = Utils.dist(this.x, this.y, player.x, player.y);

        // Magnet effect for auto-pickup items
        if (this.autoPickup && dist < this.magnetRange) {
            const angle = Utils.angle(this.x, this.y, player.x, player.y);
            const speed = (1 - dist / this.magnetRange) * 400;
            this.x += Math.cos(angle) * speed * dt;
            this.y += Math.sin(angle) * speed * dt;
        }

        // Pickup
        if (dist < this.pickupRange) {
            this.pickup(player);
        }
    }

    pickup(player) {
        if (!this.alive) return;
        this.alive = false;

        switch (this.type) {
            case 'gold':
                player.gold += this.data.amount || 1;
                particles.itemPickup(this.x, this.y, '#ffd740');
                GameAudio.play('coin');
                break;
            case 'xpOrb':
                player.gainXP(this.data.amount || 5);
                particles.itemPickup(this.x, this.y, '#64ffda');
                GameAudio.play('xp');
                break;
            case 'potion':
                player.potions++;
                particles.itemPickup(this.x, this.y, '#66bb6a');
                GameAudio.play('pickup');
                break;
            case 'key':
                player.keys++;
                particles.itemPickup(this.x, this.y, '#ffd740');
                GameAudio.play('pickup');
                break;
            case 'weapon':
                // Show weapon pickup UI
                return false; // Don't auto-pickup
        }
        return true;
    }

    draw(ctx) {
        if (!this.alive) return;

        const bobY = Math.sin(this.bobTimer) * 3;

        ctx.save();
        ctx.translate(this.x, this.y + bobY);

        // Glow
        ctx.shadowBlur = 10;

        switch (this.type) {
            case 'gold':
                ctx.shadowColor = '#ffd740';
                ctx.fillStyle = '#ffd740';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffab00';
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'xpOrb':
                ctx.shadowColor = '#64ffda';
                ctx.fillStyle = '#64ffda';
                ctx.globalAlpha = 0.6 + Math.sin(this.bobTimer * 2) * 0.3;
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'potion':
                ctx.shadowColor = '#66bb6a';
                // Bottle
                ctx.fillStyle = '#4a4a5a';
                ctx.fillRect(-3, -6, 6, 3);
                ctx.fillStyle = '#66bb6a';
                ctx.fillRect(-4, -3, 8, 8);
                ctx.fillRect(-3, 5, 6, 2);
                // Liquid shine
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(-2, -1, 2, 4);
                break;

            case 'key':
                ctx.shadowColor = '#ffd740';
                ctx.fillStyle = '#ffd740';
                // Key head
                ctx.beginPath();
                ctx.arc(-3, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1a2e';
                ctx.beginPath();
                ctx.arc(-3, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                // Key shaft
                ctx.fillStyle = '#ffd740';
                ctx.fillRect(1, -1.5, 10, 3);
                ctx.fillRect(8, -1.5, 3, 5);
                ctx.fillRect(5, -1.5, 3, 4);
                break;

            case 'weapon':
                const weapon = this.data.weapon;
                const rColor = weapon.getRarityColor();
                ctx.shadowColor = rColor;
                ctx.fillStyle = rColor;
                // Weapon icon
                ctx.fillRect(-8, -2, 16, 4);
                // Glow ring
                ctx.strokeStyle = rColor;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3 + Math.sin(this.bobTimer * 2) * 0.2;
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }
}

class ItemManager {
    constructor() {
        this.items = [];
        this.weaponDropChance = 0.15;
    }

    update(dt, player) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            this.items[i].update(dt, player);
            if (!this.items[i].alive) {
                this.items.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const item of this.items) {
            item.draw(ctx);
        }
    }

    spawnEnemyDrops(x, y, enemy, floor) {
        // Gold
        const goldCount = Utils.randInt(1, 3);
        for (let i = 0; i < goldCount; i++) {
            this.items.push(new ItemDrop(x, y, 'gold', {
                amount: Utils.randInt(enemy.goldReward / 2, enemy.goldReward)
            }));
        }

        // XP orbs
        const orbCount = Utils.randInt(2, 5);
        const xpPerOrb = Math.floor(enemy.xpReward / orbCount);
        for (let i = 0; i < orbCount; i++) {
            this.items.push(new ItemDrop(x, y, 'xpOrb', { amount: xpPerOrb }));
        }

        // Potion chance
        if (Math.random() < 0.1) {
            this.items.push(new ItemDrop(x, y, 'potion'));
        }

        // Weapon drop
        if (Math.random() < this.weaponDropChance || enemy.isBoss) {
            const weapon = this.generateWeapon(floor, enemy.isBoss);
            this.items.push(new ItemDrop(x, y, 'weapon', { weapon }));

            // Epic+ drops get VFX
            const rarityIdx = ['common','uncommon','rare','epic','legendary'].indexOf(weapon.rarity);
            if (rarityIdx >= 3 && typeof game !== 'undefined') {
                if (game.vfx) {
                    // Screen-space coords from world coords
                    const sx = x - game.camera.x + game.camera.halfW;
                    const sy = y - game.camera.y + game.camera.halfH;
                    game.vfx.legendaryBeam(sx, sy);
                }
                Utils.addShake(rarityIdx >= 4 ? 8 : 4);
                Utils.addFlash(weapon.getRarityColor(), rarityIdx >= 4 ? 0.4 : 0.2);
                if (game.ui) {
                    const emoji = rarityIdx >= 4 ? '🌟' : '✨';
                    game.ui.notify(`${emoji} ${weapon.rarity.toUpperCase()} weapon dropped!`, weapon.getRarityColor(), 3);
                }
                GameAudio.play('levelUp');
            }
        }
    }

    generateWeapon(floor, isBoss = false) {
        const types = Object.keys(WEAPON_TYPES);
        const type = Utils.randChoice(types);

        // Rarity based on floor and boss
        let rarity;
        if (isBoss) {
            rarity = Utils.weightedChoice(
                ['rare', 'epic', 'legendary'],
                [30, 50, 20]
            );
        } else {
            const rarityChances = {
                common: Math.max(60 - floor * 3, 20),
                uncommon: 25 + floor,
                rare: 10 + floor * 2,
                epic: Math.min(3 + floor, 15),
                legendary: Math.min(1 + floor * 0.5, 5),
            };
            rarity = Utils.weightedChoice(
                Object.keys(rarityChances),
                Object.values(rarityChances)
            );
        }

        const weapon = new Weapon(type, rarity);

        // Auto-enchant higher rarity weapons (uses enchant system if available)
        if (typeof ENCHANT_PREFIXES !== 'undefined') {
            const enchantChance = { common: 0, uncommon: 0.1, rare: 0.3, epic: 0.6, legendary: 0.9 };
            if (Math.random() < (enchantChance[rarity] || 0)) {
                weapon.enchantPrefix = Utils.randChoice(ENCHANT_PREFIXES);
                weapon.damage = Math.floor(weapon.damage * (1 + weapon.enchantPrefix.dmgBonus));
                if (!weapon.effects.includes(weapon.enchantPrefix.stat)) {
                    weapon.effects.push(weapon.enchantPrefix.stat);
                }
            }
            if (Math.random() < (enchantChance[rarity] || 0) * 0.5) {
                weapon.enchantSuffix = Utils.randChoice(ENCHANT_SUFFIXES);
            }
            // Update name with enchants
            let name = weapon.name;
            if (weapon.enchantPrefix) name = weapon.enchantPrefix.name + ' ' + name;
            if (weapon.enchantSuffix) name = name + ' ' + weapon.enchantSuffix.name;
            weapon.name = name;
        }

        return weapon;
    }

    spawnChestLoot(x, y, floor) {
        // Guaranteed gold
        for (let i = 0; i < 5; i++) {
            this.items.push(new ItemDrop(x, y, 'gold', {
                amount: Utils.randInt(5, 15) + floor * 2
            }));
        }

        // High chance of weapon
        if (Math.random() < 0.6) {
            const weapon = this.generateWeapon(floor);
            this.items.push(new ItemDrop(x, y, 'weapon', { weapon }));
        }

        // Potion
        if (Math.random() < 0.5) {
            this.items.push(new ItemDrop(x, y, 'potion'));
        }
    }

    clear() {
        this.items = [];
    }
}
