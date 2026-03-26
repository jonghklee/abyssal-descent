// ============================================
// FLOOR MODIFIERS - Random rules each floor
// ============================================

const FLOOR_MODIFIERS = [
    // Positive modifiers (fun/reward)
    { id: 'gold_rush',     name: '💰 Gold Rush',        desc: '3x Gold drops!',          color: '#ffd740', positive: true,
      apply: (g) => { g.goldMult = 3; } },
    { id: 'crit_floor',    name: '💥 Critical Floor',    desc: 'Everyone crits 50%!',     color: '#ffeb3b', positive: true,
      apply: (g) => { g.player.critChance += 0.45; }, remove: (g) => { g.player.critChance -= 0.45; } },
    { id: 'speed_floor',   name: '⚡ Hyperactive',       desc: 'Everything 50% faster!',  color: '#00e5ff', positive: true,
      apply: (g) => { g.player.speed *= 1.5; }, remove: (g) => { g.player.speed /= 1.5; } },
    { id: 'xp_feast',      name: '📚 XP Feast',          desc: '3x XP gains!',            color: '#64ffda', positive: true,
      apply: (g) => { g.xpMult = 3; } },
    { id: 'giant_player',  name: '🏔 Giant Mode',        desc: 'You are huge! +50% DMG',  color: '#8d6e63', positive: true,
      apply: (g) => { g.player.attack = Math.floor(g.player.attack * 1.5); g.player.w *= 1.3; g.player.h *= 1.3; },
      remove: (g) => { g.player.attack = Math.floor(g.player.attack / 1.5); g.player.w /= 1.3; g.player.h /= 1.3; } },
    { id: 'loot_piñata',   name: '🎉 Loot Piñata',      desc: 'Enemies drop 5x items!',  color: '#e91e63', positive: true,
      apply: (g) => { g.lootMult = 5; } },
    { id: 'vampire_floor', name: '🩸 Vampire Floor',     desc: '+15% Lifesteal this floor', color: '#d50000', positive: true,
      apply: (g) => { g.player.lifesteal += 0.15; }, remove: (g) => { g.player.lifesteal -= 0.15; } },

    // Negative modifiers (challenging)
    { id: 'darkness',      name: '🌑 Darkness',          desc: 'Reduced visibility!',      color: '#263238', positive: false,
      apply: (g) => { g.darkFloor = true; } },
    { id: 'swarm',         name: '🐜 Swarm',             desc: '2x enemies!',              color: '#795548', positive: false,
      apply: (g) => { g.enemyCountMult = 2; } },
    { id: 'berserkers',    name: '😡 Berserkers',        desc: 'Enemies deal 2x damage!',  color: '#f44336', positive: false,
      apply: (g) => { g.enemyDmgMult = (g.enemyDmgMult || 1) * 2; } },
    { id: 'no_heal',       name: '🚫 No Healing',        desc: 'Potions disabled!',        color: '#9e9e9e', positive: false,
      apply: (g) => { g.noHeal = true; } },
    { id: 'explosive_all', name: '💥 Explosive Enemies',  desc: 'All enemies explode!',     color: '#ff6d00', positive: false,
      apply: (g) => { g.allExplosive = true; } },

    // Chaotic (both good and bad)
    { id: 'chaos',         name: '🌀 Chaos',             desc: 'Random events every room!', color: '#7c4dff', positive: null,
      apply: (g) => { g.chaosMode = true; } },
    { id: 'mirror',        name: '🪞 Mirror Floor',      desc: 'Enemies copy your stats!',  color: '#b3e5fc', positive: null,
      apply: (g) => { g.mirrorFloor = true; } },
    { id: 'gambler',       name: '🎰 Gambler\'s Floor',  desc: 'All damage is random!',     color: '#ffd740', positive: null,
      apply: (g) => { g.randomDmg = true; } },
];

class FloorModSystem {
    constructor() {
        this.currentMod = null;
        this.displayTimer = 0;
    }

    rollModifier(floor) {
        // Remove previous modifier
        if (this.currentMod && this.currentMod.remove) {
            this.currentMod.remove(game);
        }

        // 60% chance of modifier per floor, increasing with floor
        if (Math.random() > 0.4 + floor * 0.02) {
            this.currentMod = null;
            return null;
        }

        // Roll random modifier
        const mod = Utils.randChoice(FLOOR_MODIFIERS);
        this.currentMod = mod;
        this.displayTimer = 4;

        // Apply
        mod.apply(game);

        return mod;
    }

    cleanup() {
        if (this.currentMod && this.currentMod.remove) {
            this.currentMod.remove(game);
        }
        // Reset game flags
        if (typeof game !== 'undefined') {
            game.goldMult = 1;
            game.xpMult = 1;
            game.lootMult = 1;
            game.darkFloor = false;
            game.enemyCountMult = 1;
            game.noHeal = false;
            game.allExplosive = false;
            game.chaosMode = false;
            game.mirrorFloor = false;
            game.randomDmg = false;
        }
    }

    update(dt) {
        if (this.displayTimer > 0) this.displayTimer -= dt;
    }

    draw(ctx, w, h) {
        // Current modifier display (top center)
        if (!this.currentMod) return;

        // Persistent badge
        ctx.textAlign = 'center';
        ctx.fillStyle = this.currentMod.color;
        ctx.globalAlpha = 0.7;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(this.currentMod.name, w / 2, 24);
        ctx.globalAlpha = 1;

        // Announcement (fading)
        if (this.displayTimer > 0) {
            const alpha = Math.min(this.displayTimer / 1, 1);
            ctx.globalAlpha = alpha;

            // Background bar
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(w / 2 - 180, h * 0.12, 360, 50);
            ctx.strokeStyle = this.currentMod.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(w / 2 - 180, h * 0.12, 360, 50);

            // Modifier name
            ctx.fillStyle = this.currentMod.color;
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`FLOOR MODIFIER: ${this.currentMod.name}`, w / 2, h * 0.12 + 22);

            // Description
            ctx.fillStyle = '#b0bec5';
            ctx.font = '12px monospace';
            ctx.fillText(this.currentMod.desc, w / 2, h * 0.12 + 42);

            ctx.globalAlpha = 1;
        }
    }
}

// ============================================
// TREASURE GOBLIN - Chase event
// ============================================

class TreasureGoblin extends Entity {
    constructor(x, y, floor) {
        super(x, y);
        this.w = 16;
        this.h = 16;
        this.speed = 180;
        this.hp = 30 + floor * 10;
        this.maxHp = this.hp;
        this.goldReward = 100 + floor * 20;
        this.xpReward = 50;
        this.fleeTimer = 15; // Seconds before escape
        this.laughTimer = 0;
        this.isGoblin = true;
        this.escaped = false;
        this.active = true;

        // Movement - runs away from player
        this.fleeAngle = Math.random() * Math.PI * 2;
        this.changeTimer = 0;
    }

    update(dt, dungeon, player) {
        if (!this.alive || this.escaped) return;

        this.fleeTimer -= dt;
        this.laughTimer += dt;
        this.changeTimer += dt;

        // Escape after time
        if (this.fleeTimer <= 0) {
            this.escaped = true;
            this.alive = false;
            particles.explosion(this.x, this.y, '#ffd740', 20);
            if (typeof game !== 'undefined') {
                game.ui.notify('The Treasure Goblin escaped!', '#ff9800', 3);
            }
            return;
        }

        // Run away from player
        const dist = Utils.dist(this.x, this.y, player.x, player.y);
        const angleFromPlayer = Utils.angle(player.x, player.y, this.x, this.y);

        if (dist < 150) {
            // Flee directly away
            this.vx = Math.cos(angleFromPlayer) * this.speed;
            this.vy = Math.sin(angleFromPlayer) * this.speed;
        } else {
            // Random wandering
            if (this.changeTimer > 1) {
                this.changeTimer = 0;
                this.fleeAngle = Utils.rand(0, Math.PI * 2);
            }
            this.vx = Math.cos(this.fleeAngle) * this.speed * 0.5;
            this.vy = Math.sin(this.fleeAngle) * this.speed * 0.5;
        }

        // Drop gold trail
        if (this.laughTimer > 0.5) {
            this.laughTimer = 0;
            particles.itemPickup(this.x, this.y, '#ffd740');
        }

        super.update(dt, dungeon);
    }

    draw(ctx) {
        if (!this.alive || this.escaped) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const bob = Math.sin(this.animTimer * 8) * 3;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (gold)
        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#ffd740';
        ctx.fillRect(-7, -6 + bob, 14, 12);

        // Head
        ctx.fillStyle = '#ffab00';
        ctx.fillRect(-6, -12 + bob, 12, 8);

        // Eyes (mischievous)
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-4, -10 + bob, 3, 3);
        ctx.fillRect(2, -10 + bob, 3, 3);

        // Money bag
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(6, -4 + bob, 6, 8);
        ctx.fillStyle = '#ffd740';
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', 9, 3 + bob);

        // Timer bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-12, -18, 24, 3);
        ctx.fillStyle = this.fleeTimer > 5 ? '#ffd740' : '#ff1744';
        ctx.fillRect(-12, -18, 24 * (this.fleeTimer / 15), 3);

        // "!" indicator
        const blink = Math.sin(this.animTimer * 6) > 0;
        if (blink) {
            ctx.fillStyle = '#ffd740';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('💰', 0, -22 + bob);
        }

        ctx.restore();

        // HP bar
        if (this.hp < this.maxHp) {
            const barW = 24;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - barW / 2, this.y - 24, barW, 3);
            ctx.fillStyle = '#ffd740';
            ctx.fillRect(this.x - barW / 2, this.y - 24, barW * (this.hp / this.maxHp), 3);
        }
    }
}

class GoblinManager {
    constructor() {
        this.goblins = [];
        this.spawnTimer = 0;
        this.spawnInterval = 45; // Seconds between goblin spawns
    }

    update(dt, dungeon, player, combat) {
        this.spawnTimer += dt;

        // Spawn goblin periodically
        if (this.spawnTimer >= this.spawnInterval && this.goblins.length === 0) {
            this.spawnTimer = 0;
            this.spawnGoblin(dungeon, player);
        }

        // Update goblins
        for (let i = this.goblins.length - 1; i >= 0; i--) {
            const g = this.goblins[i];
            g.update(dt, dungeon, player);

            if (!g.alive) {
                if (!g.escaped) {
                    // Killed! Big reward
                    player.gold += g.goldReward;
                    player.gainXP(g.xpReward);
                    particles.explosion(g.x, g.y, '#ffd740', 40);
                    Utils.addShake(10);
                    Utils.addFlash('#ffd740', 0.4);
                    Utils.addSlowMo(0.2, 0.5);

                    // Drop lots of gold
                    if (typeof game !== 'undefined') {
                        for (let j = 0; j < 15; j++) {
                            game.items.items.push(new ItemDrop(g.x, g.y, 'gold', {
                                amount: Utils.randInt(10, 30)
                            }));
                        }
                        // Bonus gacha
                        game.gacha.pull(game.floor, (reward) => {
                            if (reward.type === 'weapon') game.weaponPickup = reward.item;
                        });
                        game.ui.notify('💰 Treasure Goblin slain! MASSIVE LOOT!', '#ffd740', 4);
                        GameAudio.play('bossDeath');
                    }
                }
                this.goblins.splice(i, 1);
            }
        }
    }

    spawnGoblin(dungeon, player) {
        // Spawn in a random room near-ish the player
        const rooms = dungeon.rooms.filter(r => {
            const dist = Utils.dist(
                r.centerX * TILE_SIZE, r.centerY * TILE_SIZE,
                player.x, player.y
            );
            return dist > 200 && dist < 600;
        });

        if (rooms.length === 0) return;

        const room = Utils.randChoice(rooms);
        const x = room.centerX * TILE_SIZE + TILE_SIZE / 2;
        const y = room.centerY * TILE_SIZE + TILE_SIZE / 2;
        const floor = typeof game !== 'undefined' ? game.floor : 1;

        const goblin = new TreasureGoblin(x, y, floor);
        this.goblins.push(goblin);

        if (typeof game !== 'undefined') {
            game.ui.notify('👺 A Treasure Goblin has appeared nearby!', '#ffd740', 4);
            GameAudio.play('chest');
        }
    }

    draw(ctx) {
        for (const g of this.goblins) {
            g.draw(ctx);
        }
    }

    // Check if player attacks hit goblins
    checkHits(x, y, range, damage) {
        for (const g of this.goblins) {
            if (!g.alive) continue;
            const dist = Utils.dist(x, y, g.x, g.y);
            if (dist < range + g.w / 2) {
                g.takeDamage(damage, x, y);
                particles.hitSpark(g.x, g.y, '#ffd740', 10);
                particles.itemPickup(g.x, g.y, '#ffd740');
                return true;
            }
        }
        return false;
    }
}
