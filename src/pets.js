// ============================================
// PETS - Collectible companion system
// ============================================

const PET_DEFS = [
    // Common pets
    { id: 'wisp', name: 'Wisp', rarity: 'common', color: '#b3e5fc', icon: '✦',
      desc: 'A tiny light orb', behavior: 'orbit',
      stats: { dmg: 3, rate: 1.5, range: 80 } },
    { id: 'bat_pet', name: 'Baby Bat', rarity: 'common', color: '#ce93d8', icon: '🦇',
      desc: 'Swoops at enemies', behavior: 'chase',
      stats: { dmg: 4, rate: 2.0, range: 120 } },
    { id: 'slimeling', name: 'Slimeling', rarity: 'common', color: '#a5d6a7', icon: '●',
      desc: 'Bouncy friend', behavior: 'bounce',
      stats: { dmg: 2, rate: 1.0, range: 60 } },

    // Uncommon pets
    { id: 'skull', name: 'Floating Skull', rarity: 'uncommon', color: '#fff9c4', icon: '💀',
      desc: 'Fires bone shards', behavior: 'ranged',
      stats: { dmg: 6, rate: 1.8, range: 150, projSpeed: 200, projColor: '#fff9c4' } },
    { id: 'fairy', name: 'Healing Fairy', rarity: 'uncommon', color: '#f48fb1', icon: '✿',
      desc: 'Heals you slowly', behavior: 'heal',
      stats: { healRate: 2, healAmount: 1 } },
    { id: 'imp', name: 'Fire Imp', rarity: 'uncommon', color: '#ff8a65', icon: '👿',
      desc: 'Shoots fireballs', behavior: 'ranged',
      stats: { dmg: 8, rate: 2.5, range: 130, projSpeed: 180, projColor: '#ff6d00' } },

    // Rare pets
    { id: 'dragon', name: 'Baby Dragon', rarity: 'rare', color: '#ef5350', icon: '🐲',
      desc: 'Breathes fire in a cone', behavior: 'aoe',
      stats: { dmg: 12, rate: 3.0, range: 100, aoeAngle: 0.6 } },
    { id: 'golem', name: 'Stone Golem', rarity: 'rare', color: '#8d6e63', icon: '🗿',
      desc: 'Tanks hits for you', behavior: 'tank',
      stats: { hp: 50, dmg: 8, rate: 2.0, range: 40, defense: 5 } },
    { id: 'ghost_pet', name: 'Spectral Wolf', rarity: 'rare', color: '#90caf9', icon: '🐺',
      desc: 'Fast melee attacker', behavior: 'chase',
      stats: { dmg: 10, rate: 0.8, range: 100, speed: 250 } },

    // Epic pets
    { id: 'phoenix_pet', name: 'Phoenix Chick', rarity: 'epic', color: '#ff6d00', icon: '🔥',
      desc: 'Fire aura + revive', behavior: 'aura',
      stats: { dmg: 5, rate: 0.5, range: 60, auraDmg: 2, auraRange: 50 } },
    { id: 'mimic', name: 'Friendly Mimic', rarity: 'epic', color: '#ffd740', icon: '📦',
      desc: 'Duplicates gold drops', behavior: 'loot',
      stats: { goldMult: 2.0, itemChance: 0.1 } },

    // Legendary pets
    { id: 'angel', name: 'Fallen Angel', rarity: 'legendary', color: '#fff', icon: '👼',
      desc: 'Massive holy damage', behavior: 'ranged',
      stats: { dmg: 25, rate: 2.0, range: 200, projSpeed: 300, projColor: '#fff9c4' } },
    { id: 'void_pet', name: 'Void Entity', rarity: 'legendary', color: '#7c4dff', icon: '🌀',
      desc: 'Black hole pulls enemies', behavior: 'pull',
      stats: { dmg: 15, rate: 4.0, range: 150, pullForce: 200 } },
];

class Pet {
    constructor(def) {
        this.def = def;
        this.id = def.id;
        this.name = def.name;
        this.rarity = def.rarity;
        this.color = def.color;
        this.icon = def.icon;
        this.behavior = def.behavior;
        this.stats = { ...def.stats };

        // Position (relative to player)
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.attackTimer = 0;
        this.animTimer = 0;
        this.projectiles = [];

        // Level system for pets
        this.level = 1;
        this.xp = 0;
        this.xpToLevel = 30;
    }

    update(dt, player, enemies, dungeon) {
        this.animTimer += dt;
        this.attackTimer -= dt;

        // Movement based on behavior
        switch (this.behavior) {
            case 'orbit':
                this.orbitAngle += dt * 2;
                this.targetX = player.x + Math.cos(this.orbitAngle) * 35;
                this.targetY = player.y + Math.sin(this.orbitAngle) * 35;
                break;
            case 'chase':
            case 'ranged':
            case 'aoe':
                this.updateChase(dt, player, enemies);
                break;
            case 'heal':
            case 'loot':
            case 'aura':
                this.orbitAngle += dt * 1.5;
                this.targetX = player.x + Math.cos(this.orbitAngle) * 25;
                this.targetY = player.y + Math.sin(this.orbitAngle) * 25;
                break;
            case 'bounce':
                this.targetX = player.x + Math.sin(this.animTimer * 3) * 30;
                this.targetY = player.y + Math.cos(this.animTimer * 2) * 25 - 10;
                break;
            case 'tank':
                this.updateTank(dt, player, enemies);
                break;
            case 'pull':
                this.orbitAngle += dt * 1;
                this.targetX = player.x + Math.cos(this.orbitAngle) * 40;
                this.targetY = player.y + Math.sin(this.orbitAngle) * 40;
                break;
        }

        // Smooth movement
        this.x += (this.targetX - this.x) * 0.1;
        this.y += (this.targetY - this.y) * 0.1;

        // Attack
        this.performAttack(dt, player, enemies);

        // Update projectiles
        this.updateProjectiles(dt, enemies, dungeon);
    }

    updateChase(dt, player, enemies) {
        // Find nearest enemy
        let nearest = null;
        let nearestDist = this.stats.range || 120;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(player.x, player.y, e.x, e.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = e;
            }
        }

        if (nearest && this.behavior === 'chase') {
            const angle = Utils.angle(this.x, this.y, nearest.x, nearest.y);
            this.targetX = nearest.x - Math.cos(angle) * 20;
            this.targetY = nearest.y - Math.sin(angle) * 20;
        } else {
            this.orbitAngle += dt * 2;
            this.targetX = player.x + Math.cos(this.orbitAngle) * 30;
            this.targetY = player.y + Math.sin(this.orbitAngle) * 30;
        }
    }

    updateTank(dt, player, enemies) {
        // Position between player and nearest enemy
        let nearest = null;
        let nearestDist = 150;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(player.x, player.y, e.x, e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }

        if (nearest) {
            const mx = (player.x + nearest.x) / 2;
            const my = (player.y + nearest.y) / 2;
            this.targetX = mx;
            this.targetY = my;
        } else {
            this.targetX = player.x + 20;
            this.targetY = player.y;
        }
    }

    performAttack(dt, player, enemies) {
        if (this.attackTimer > 0) return;

        switch (this.behavior) {
            case 'orbit':
            case 'chase':
            case 'bounce':
                this.meleeAttack(enemies);
                break;
            case 'ranged':
                this.rangedAttack(enemies, player);
                break;
            case 'aoe':
                this.aoeAttack(enemies);
                break;
            case 'heal':
                this.healPlayer(player);
                break;
            case 'aura':
                this.auraAttack(enemies);
                break;
            case 'pull':
                this.pullAttack(enemies);
                break;
        }
    }

    meleeAttack(enemies) {
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(this.x, this.y, e.x, e.y);
            if (d < (this.stats.range || 30)) {
                const dmg = this.getDamage();
                e.takeDamage(dmg, this.x, this.y);
                particles.hitSpark(e.x, e.y, this.color, 4);
                this.attackTimer = this.stats.rate || 1.0;
                this.gainXP(1);
                break;
            }
        }
    }

    rangedAttack(enemies, player) {
        let nearest = null;
        let nearestDist = this.stats.range || 150;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(this.x, this.y, e.x, e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        if (nearest) {
            const angle = Utils.angle(this.x, this.y, nearest.x, nearest.y);
            this.projectiles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * (this.stats.projSpeed || 200),
                vy: Math.sin(angle) * (this.stats.projSpeed || 200),
                dmg: this.getDamage(),
                life: 2,
                size: 3,
                color: this.stats.projColor || this.color,
            });
            this.attackTimer = this.stats.rate || 1.5;
        }
    }

    aoeAttack(enemies) {
        let hit = false;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(this.x, this.y, e.x, e.y);
            if (d < (this.stats.range || 60)) {
                e.takeDamage(this.getDamage(), this.x, this.y);
                particles.hitSpark(e.x, e.y, this.color, 3);
                hit = true;
            }
        }
        if (hit) {
            this.attackTimer = this.stats.rate || 2.0;
            this.gainXP(2);
        }
    }

    healPlayer(player) {
        if (player.hp < player.maxHp) {
            player.hp = Math.min(player.hp + (this.stats.healAmount || 1), player.maxHp);
            this.attackTimer = this.stats.healRate || 2.0;
            particles.trailEffect(player.x, player.y, '#f48fb1');
        }
    }

    auraAttack(enemies) {
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(this.x, this.y, e.x, e.y);
            if (d < (this.stats.auraRange || 50)) {
                e.takeDamage(this.stats.auraDmg || 1, this.x, this.y);
            }
        }
        this.attackTimer = this.stats.rate || 0.5;
    }

    pullAttack(enemies) {
        let pulled = false;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.dist(this.x, this.y, e.x, e.y);
            if (d < (this.stats.range || 150) && d > 30) {
                const angle = Utils.angle(e.x, e.y, this.x, this.y);
                e.knockbackX += Math.cos(angle) * (this.stats.pullForce || 100) * 0.02;
                e.knockbackY += Math.sin(angle) * (this.stats.pullForce || 100) * 0.02;
                pulled = true;
            }
        }
        if (pulled) {
            this.attackTimer = this.stats.rate || 3.0;
            particles.explosion(this.x, this.y, this.color, 8);
        }
    }

    updateProjectiles(dt, enemies, dungeon) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            particles.trailEffect(p.x, p.y, p.color);

            // Hit enemy
            for (const e of enemies) {
                if (!e.alive) continue;
                if (circleCollide(p.x, p.y, p.size, e.x, e.y, e.w / 2)) {
                    e.takeDamage(p.dmg, p.x, p.y);
                    particles.hitSpark(p.x, p.y, p.color, 5);
                    this.projectiles.splice(i, 1);
                    this.gainXP(1);
                    break;
                }
            }

            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    getDamage() {
        return Math.floor((this.stats.dmg || 3) * (1 + (this.level - 1) * 0.15));
    }

    gainXP(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToLevel) {
            this.xp -= this.xpToLevel;
            this.level++;
            this.xpToLevel = Math.floor(this.xpToLevel * 1.4);
            // Boost stats
            if (this.stats.dmg) this.stats.dmg = Math.floor(this.stats.dmg * 1.1);
            if (this.stats.healAmount) this.stats.healAmount++;

            // Pet evolution at level 10!
            if (this.level === 10 && !this.evolved) {
                this.evolved = true;
                this.name = '★ ' + this.name;
                if (this.stats.dmg) this.stats.dmg = Math.floor(this.stats.dmg * 2);
                if (this.stats.healAmount) this.stats.healAmount *= 2;
                if (this.stats.range) this.stats.range = Math.floor(this.stats.range * 1.5);
                if (typeof game !== 'undefined') {
                    game.ui.notify(`🌟 ${this.name} EVOLVED! 2x power!`, this.getRarityColor(), 4);
                    Utils.addShake(10);
                    Utils.addFlash(this.color, 0.4);
                    particles.levelUpEffect(this.x, this.y);
                    GameAudio.play('levelUp');
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const bob = Math.sin(this.animTimer * 4) * 3;

        // Glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;

        // Body
        ctx.fillStyle = this.color;
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.icon, 0, bob + 5);

        // Level badge
        if (this.level > 1) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffd740';
            ctx.font = 'bold 7px monospace';
            ctx.fillText(`Lv${this.level}`, 0, bob - 8);
        }

        ctx.shadowBlur = 0;
        ctx.restore();

        // Draw projectiles
        for (const p of this.projectiles) {
            ctx.save();
            ctx.shadowBlur = 6;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    getRarityColor() {
        return GACHA_RARITIES[this.rarity]?.color || '#9e9e9e';
    }
}

class PetSystem {
    constructor() {
        this.activePet = null;
        this.collection = []; // All collected pets
    }

    addPet(petDef) {
        const pet = new Pet(petDef);
        this.collection.push(pet);
        if (!this.activePet) this.activePet = pet;
        return pet;
    }

    setActive(index) {
        if (index >= 0 && index < this.collection.length) {
            this.activePet = this.collection[index];
        }
    }

    update(dt, player, enemies, dungeon) {
        if (this.activePet) {
            this.activePet.update(dt, player, enemies, dungeon);
        }
    }

    draw(ctx) {
        if (this.activePet) {
            this.activePet.draw(ctx);
        }
    }

    getRandomPet(rarity) {
        const pool = PET_DEFS.filter(p => p.rarity === rarity);
        if (pool.length === 0) {
            // Fallback
            return PET_DEFS[Math.floor(Math.random() * PET_DEFS.length)];
        }
        return Utils.randChoice(pool);
    }

    drawCollectionHUD(ctx, x, y) {
        if (this.collection.length === 0) return;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#546e7a';
        ctx.font = '9px monospace';
        ctx.fillText('PET:', x, y);

        if (this.activePet) {
            ctx.fillStyle = this.activePet.getRarityColor();
            ctx.font = '11px monospace';
            ctx.fillText(
                `${this.activePet.icon} ${this.activePet.name} Lv${this.activePet.level}`,
                x + 28, y
            );
        }
    }
}
