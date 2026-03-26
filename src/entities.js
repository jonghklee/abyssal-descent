// ============================================
// ENTITIES - Player & Enemies
// ============================================

class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.w = 24;
        this.h = 24;
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 150;
        this.alive = true;
        this.invulnerable = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
        this.flashTimer = 0;
        this.facing = 0; // angle
        this.animTimer = 0;
        this.animFrame = 0;
    }

    update(dt, dungeon) {
        this.animTimer += dt;
        if (this.animTimer > 0.15) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }

        if (this.invulnerable > 0) this.invulnerable -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Apply knockback
        this.knockbackX *= 0.85;
        this.knockbackY *= 0.85;

        // Move with collision
        const moveX = (this.vx + this.knockbackX) * dt;
        const moveY = (this.vy + this.knockbackY) * dt;

        // Check X movement
        const newX = this.x + moveX;
        if (this.canMoveTo(newX, this.y, dungeon)) {
            this.x = newX;
        } else {
            this.knockbackX = 0;
        }

        // Check Y movement
        const newY = this.y + moveY;
        if (this.canMoveTo(this.x, newY, dungeon)) {
            this.y = newY;
        } else {
            this.knockbackY = 0;
        }
    }

    canMoveTo(x, y, dungeon) {
        const halfW = this.w / 2 - 2;
        const halfH = this.h / 2 - 2;

        // Check 4 corners
        const corners = [
            { x: x - halfW, y: y - halfH },
            { x: x + halfW, y: y - halfH },
            { x: x - halfW, y: y + halfH },
            { x: x + halfW, y: y + halfH },
        ];

        for (const c of corners) {
            const tx = Math.floor(c.x / TILE_SIZE);
            const ty = Math.floor(c.y / TILE_SIZE);
            if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height) return false;
            const tile = dungeon.tiles[ty][tx];
            if (tile === TILE.VOID || tile === TILE.WALL || tile === TILE.PILLAR) return false;
        }
        return true;
    }

    takeDamage(amount, fromX, fromY) {
        if (this.invulnerable > 0) return false;

        this.hp -= amount;
        this.flashTimer = 0.15;
        this.invulnerable = 0.2;

        // Knockback
        if (fromX !== undefined && fromY !== undefined) {
            const angle = Utils.angle(fromX, fromY, this.x, this.y);
            this.knockbackX = Math.cos(angle) * 400;
            this.knockbackY = Math.sin(angle) * 400;
        }

        if (this.hp <= 0) {
            // Last Stand: 10% chance to survive lethal hit (player only)
            if (this.className && !this._lastStandUsed && Math.random() < 0.10) {
                this._lastStandUsed = true;
                this.hp = 1;
                this.invulnerable = 2;
                if (typeof game !== 'undefined') {
                    game.ui.notify('💀 LAST STAND! Survived at 1 HP!', '#ff1744', 3);
                    if (game.achievements) game.achievements.addStat('lastStands');
                    Utils.addSlowMo(0.15, 1.0);
                    Utils.addShake(12);
                    Utils.addFlash('#ff1744', 0.4);
                    if (game.vfx) game.vfx.screenCrack();
                    GameAudio.play('bossDeath');
                }
            } else {
                this.hp = 0;
                this.alive = false;
            }
        }

        return true;
    }
}

// ============================================
// PLAYER
// ============================================

class Player extends Entity {
    constructor(x, y) {
        super(x, y);
        this.maxHp = 100;
        this.hp = 100;
        this.speed = 160;
        this.w = 20;
        this.h = 20;

        // Stats
        this.level = 1;
        this.xp = 0;
        this.xpToLevel = 50;
        this.attack = 10;
        this.defense = 2;
        this.critChance = 0.05;
        this.critMultiplier = 2.0;
        this.lifesteal = 0;

        // Dash
        this.dashCooldown = 0;
        this.dashMaxCooldown = 1.0;
        this.dashSpeed = 600;
        this.dashDuration = 0;
        this.dashMaxDuration = 0.15;
        this.isDashing = false;
        this.dashDir = { x: 0, y: 0 };

        // Weapons
        this.weapons = [];
        this.currentWeapon = 0;
        this.attackCooldown = 0;

        // Inventory
        this.gold = 0;
        this.keys = 0;
        this.potions = 3;

        // Trail
        this.trail = [];
        this.trailTimer = 0;

        // Combo system
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;

        // Kill count
        this.kills = 0;
    }

    update(dt, dungeon, input) {
        // Dash
        const wasCooling = this.dashCooldown > 0;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        // Dash ready notification (subtle sound)
        if (wasCooling && this.dashCooldown <= 0) {
            GameAudio.play('xp'); // Reuse quiet sound
        }
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        if (this.isDashing) {
            this.dashDuration -= dt;
            this.vx = this.dashDir.x * this.dashSpeed;
            this.vy = this.dashDir.y * this.dashSpeed;
            this.invulnerable = 0.1;

            // Class-specific dash trail
            this.trailTimer += dt;
            if (this.trailTimer > 0.02) {
                this.trailTimer = 0;
                const dashColor = this.classColor || '#64ffda';
                particles.trailEffect(this.x, this.y, dashColor);

                // Warrior: leave shockwave particles
                if (this.className === 'Warrior' && Math.random() < 0.4) {
                    particles.add(new Particle(this.x + Utils.rand(-8,8), this.y + Utils.rand(-8,8), {
                        life: 0.15, size: Utils.rand(4,8), endSize: 12,
                        color: 'rgba(244,67,54,0.2)',
                    }));
                }
                // Rogue: after-images
                if (this.className === 'Rogue' && Math.random() < 0.5) {
                    particles.add(new Particle(this.x, this.y, {
                        life: 0.2, size: 8, endSize: 0,
                        color: 'rgba(100,255,218,0.3)',
                        shape: 'square',
                    }));
                }
                // Mage: arcane sparkles
                if (this.className === 'Mage') {
                    particles.add(new Particle(this.x + Utils.rand(-6,6), this.y + Utils.rand(-6,6), {
                        life: 0.3, size: Utils.rand(1,3), endSize: 0,
                        color: Utils.randChoice(['#7c4dff','#b388ff','#ea80fc']),
                        glow: true, glowSize: 4,
                        vy: Utils.rand(-1, 0),
                    }));
                }
            }

            if (this.dashDuration <= 0) {
                this.isDashing = false;
                this.vx = 0;
                this.vy = 0;
            }
        } else {
            // Normal movement
            this.vx = 0;
            this.vy = 0;
            let moving = false;

            if (input.keys['KeyW'] || input.keys['ArrowUp']) { this.vy = -this.speed; moving = true; }
            if (input.keys['KeyS'] || input.keys['ArrowDown']) { this.vy = this.speed; moving = true; }
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) { this.vx = -this.speed; moving = true; }
            if (input.keys['KeyD'] || input.keys['ArrowRight']) { this.vx = this.speed; moving = true; }

            // Normalize diagonal
            if (this.vx && this.vy) {
                const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                this.vx = (this.vx / mag) * this.speed;
                this.vy = (this.vy / mag) * this.speed;
            }

            // Footstep particles
            if (moving) {
                this.trailTimer += dt;
                if (this.trailTimer > 0.15) {
                    this.trailTimer = 0;
                    particles.dustPuff(this.x, this.y + this.h / 2, 2);
                }
            }

            // Dash input
            if (input.keys['Space'] && this.dashCooldown <= 0 && moving) {
                this.isDashing = true;
                this.dashDuration = this.dashMaxDuration;
                this.dashCooldown = this.dashMaxCooldown;
                const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                this.dashDir = { x: this.vx / mag, y: this.vy / mag };
                GameAudio.play('dash');
            }
        }

        // Face mouse
        this.facing = Utils.angle(this.x, this.y, input.worldMouseX, input.worldMouseY);

        super.update(dt, dungeon);
    }

    gainXP(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToLevel) {
            this.xp -= this.xpToLevel;
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xpToLevel = Math.floor(this.xpToLevel * 1.5);
        this.maxHp += 10;
        this.hp = Math.min(this.hp + 20, this.maxHp);
        this.attack += 2;
        this.defense += 1;
        particles.levelUpEffect(this.x, this.y);
        GameAudio.play('levelUp');
        Utils.addShake(8);
        Utils.addFlash('#64ffda', 0.3);
    }

    addCombo() {
        this.combo++;
        this.comboTimer = 3;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
    }

    getComboMultiplier() {
        if (this.combo < 3) return 1;
        if (this.combo < 6) return 1.25;
        if (this.combo < 10) return 1.5;
        if (this.combo < 20) return 2;
        return 3;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Flash on damage
        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(this.flashTimer * 30) * 0.5;
        }

        // Dash ghost effect + invulnerability shimmer
        if (this.isDashing) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#64ffda';
        } else if (this.invulnerable > 0 && !this.flashTimer) {
            // Post-dash/revive invulnerability shimmer
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.02) * 0.3;
        }

        // Body
        const bobY = Math.sin(this.animTimer * 8) * (Math.abs(this.vx) + Math.abs(this.vy) > 0 ? 2 : 0.5);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.h / 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Character body
        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#4fc3f7';
        ctx.fillRect(-10, -12 + bobY, 20, 20);

        // Cape/cloak
        ctx.fillStyle = '#1565c0';
        ctx.fillRect(-8, -4 + bobY, 16, 14);

        // Head
        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#e0e0e0';
        ctx.fillRect(-7, -16 + bobY, 14, 12);

        // Eyes
        const eyeOffX = Math.cos(this.facing) * 2;
        const eyeOffY = Math.sin(this.facing) * 1;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-4 + eyeOffX, -12 + bobY + eyeOffY, 3, 3);
        ctx.fillRect(2 + eyeOffX, -12 + bobY + eyeOffY, 3, 3);

        // Helmet top
        ctx.fillStyle = '#78909c';
        ctx.fillRect(-8, -18 + bobY, 16, 4);

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    usePotion() {
        if (this.potions > 0 && this.hp < this.maxHp) {
            if (!this._potionsUsed) this._potionsUsed = 0;
            this._potionsUsed++;
            // No healing if no-heal floor modifier
            if (typeof game !== 'undefined' && game.noHeal) {
                return false;
            }
            this.potions--;
            const healPct = this.potionPower || 0.4;
            const heal = Math.floor(this.maxHp * healPct);
            this.hp = Math.min(this.hp + heal, this.maxHp);

            // Healing VFX burst
            particles.itemPickup(this.x, this.y, '#66bb6a');
            for (let i = 0; i < 15; i++) {
                const angle = (i / 15) * Math.PI * 2;
                particles.add(new Particle(this.x, this.y, {
                    vx: Math.cos(angle) * Utils.rand(1, 3),
                    vy: Math.sin(angle) * Utils.rand(1, 3) - 1,
                    life: Utils.rand(0.3, 0.8),
                    size: Utils.rand(2, 4),
                    endSize: 0,
                    color: Utils.randChoice(['#66bb6a', '#a5d6a7', '#c8e6c9', '#fff']),
                    glow: true,
                    glowSize: 6,
                }));
            }
            // Green flash + heal number
            Utils.addFlash('#4caf50', 0.15);
            GameAudio.play('heal');
            if (typeof game !== 'undefined' && game.combat) {
                game.combat.damageNumbers.push({
                    x: this.x, y: this.y - 20,
                    text: `+${heal}`, color: '#4caf50',
                    size: 14, life: 1.0, vy: -1.5, isCrit: false,
                });
            }
            return true;
        }
        return false;
    }
}

// ============================================
// ENEMIES
// ============================================

const ENEMY_TYPES = {
    skeleton: {
        name: 'Skeleton',
        hp: 30, speed: 60, attack: 8, xp: 15, gold: 5,
        color: '#e0e0e0', eyeColor: '#ff4444',
        w: 18, h: 18,
        behavior: 'chase',
        attackRange: 30, attackCooldown: 1.0,
    },
    slime: {
        name: 'Slime',
        hp: 20, speed: 40, attack: 5, xp: 10, gold: 3,
        color: '#66bb6a', eyeColor: '#1b5e20',
        w: 20, h: 16,
        behavior: 'wander_chase',
        attackRange: 25, attackCooldown: 1.5,
    },
    bat: {
        name: 'Bat',
        hp: 15, speed: 100, attack: 6, xp: 12, gold: 4,
        color: '#7e57c2', eyeColor: '#ff1744',
        w: 16, h: 14,
        behavior: 'flyby',
        attackRange: 20, attackCooldown: 0.8,
    },
    zombie: {
        name: 'Zombie',
        hp: 50, speed: 35, attack: 12, xp: 20, gold: 8,
        color: '#558b2f', eyeColor: '#ffeb3b',
        w: 20, h: 20,
        behavior: 'chase',
        attackRange: 28, attackCooldown: 1.5,
    },
    ghost: {
        name: 'Ghost',
        hp: 25, speed: 70, attack: 10, xp: 18, gold: 7,
        color: 'rgba(200,200,255,0.6)', eyeColor: '#00e5ff',
        w: 18, h: 20,
        behavior: 'circle',
        attackRange: 35, attackCooldown: 1.2,
        phasing: true,
    },
    mage: {
        name: 'Dark Mage',
        hp: 35, speed: 50, attack: 15, xp: 25, gold: 12,
        color: '#8e24aa', eyeColor: '#e040fb',
        w: 18, h: 20,
        behavior: 'ranged',
        attackRange: 200, attackCooldown: 2.0,
    },
    knight: {
        name: 'Fallen Knight',
        hp: 80, speed: 45, attack: 18, xp: 35, gold: 15,
        color: '#546e7a', eyeColor: '#ff3d00',
        w: 22, h: 22,
        behavior: 'charge',
        attackRange: 35, attackCooldown: 2.0,
    },
    // Late-game enemies
    assassin: {
        name: 'Shadow Assassin',
        hp: 40, speed: 140, attack: 20, xp: 30, gold: 15,
        color: '#263238', eyeColor: '#ff1744',
        w: 16, h: 18,
        behavior: 'flyby',
        attackRange: 22, attackCooldown: 0.6,
    },
    necromancer: {
        name: 'Necromancer',
        hp: 60, speed: 35, attack: 12, xp: 40, gold: 20,
        color: '#4a148c', eyeColor: '#ce93d8',
        w: 18, h: 20,
        behavior: 'ranged',
        attackRange: 220, attackCooldown: 1.8,
    },
    golem_enemy: {
        name: 'Stone Golem',
        hp: 120, speed: 25, attack: 22, xp: 45, gold: 25,
        color: '#795548', eyeColor: '#ff9800',
        w: 26, h: 26,
        behavior: 'charge',
        attackRange: 35, attackCooldown: 2.5,
    },
    boss_demon: {
        name: 'Abyssal Demon',
        hp: 500, speed: 40, attack: 25, xp: 200, gold: 100,
        color: '#b71c1c', eyeColor: '#ffeb3b',
        w: 40, h: 40,
        behavior: 'boss',
        attackRange: 50, attackCooldown: 1.5,
        isBoss: true,
    },
    boss_lich: {
        name: 'Lich King',
        hp: 400, speed: 50, attack: 20, xp: 250, gold: 120,
        color: '#4a148c', eyeColor: '#e040fb',
        w: 36, h: 36,
        behavior: 'boss',
        attackRange: 45, attackCooldown: 1.2,
        isBoss: true,
    },
    boss_dragon: {
        name: 'Ancient Dragon',
        hp: 800, speed: 30, attack: 35, xp: 400, gold: 200,
        color: '#bf360c', eyeColor: '#ffd740',
        w: 48, h: 48,
        behavior: 'boss',
        attackRange: 60, attackCooldown: 2.0,
        isBoss: true,
    },
};

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y);
        const def = ENEMY_TYPES[type];
        this.type = type;
        this.name = def.name;
        this.maxHp = def.hp;
        this.hp = def.hp;
        this.speed = def.speed;
        this.baseAttack = def.attack;
        this.xpReward = def.xp;
        this.goldReward = def.gold;
        this.color = def.color;
        this.eyeColor = def.eyeColor;
        this.w = def.w;
        this.h = def.h;
        this.behavior = def.behavior;
        this.attackRange = def.attackRange;
        this.attackCooldown = 0;
        this.attackMaxCooldown = def.attackCooldown;
        this.phasing = def.phasing || false;
        this.isBoss = def.isBoss || false;

        // Spawn animation
        this.spawnTimer = 0.5;
        this.spawning = true;

        // State machine
        this.state = 'idle';
        this.stateTimer = 0;
        this.targetX = x;
        this.targetY = y;
        this.detectionRange = 180;
        this.aggroRange = this.isBoss ? 400 : 250;

        // Boss specific
        this.phase = 1;
        this.bossAttackPattern = 0;

        // Ranged
        this.projectiles = [];
    }

    update(dt, dungeon, player) {
        if (!this.alive) return;

        // Spawn animation
        if (this.spawning) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawning = false;
            }
            return; // Don't move during spawn
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        this.stateTimer += dt;

        const distToPlayer = Utils.dist(this.x, this.y, player.x, player.y);
        this.facing = Utils.angle(this.x, this.y, player.x, player.y);

        switch (this.behavior) {
            case 'chase': this.updateChase(dt, dungeon, player, distToPlayer); break;
            case 'wander_chase': this.updateWanderChase(dt, dungeon, player, distToPlayer); break;
            case 'flyby': this.updateFlyby(dt, dungeon, player, distToPlayer); break;
            case 'circle': this.updateCircle(dt, dungeon, player, distToPlayer); break;
            case 'ranged': this.updateRanged(dt, dungeon, player, distToPlayer); break;
            case 'charge': this.updateCharge(dt, dungeon, player, distToPlayer); break;
            case 'boss': this.updateBoss(dt, dungeon, player, distToPlayer); break;
        }

        super.update(dt, dungeon);
    }

    updateChase(dt, dungeon, player, dist) {
        if (dist < this.aggroRange) {
            const angle = Utils.angle(this.x, this.y, player.x, player.y);
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        } else {
            this.vx *= 0.9;
            this.vy *= 0.9;
        }
    }

    updateWanderChase(dt, dungeon, player, dist) {
        if (dist < this.detectionRange) {
            this.updateChase(dt, dungeon, player, dist);
        } else {
            // Wander
            if (this.stateTimer > 2) {
                this.stateTimer = 0;
                const angle = Utils.rand(0, Math.PI * 2);
                this.targetX = this.x + Math.cos(angle) * 50;
                this.targetY = this.y + Math.sin(angle) * 50;
            }
            const angle = Utils.angle(this.x, this.y, this.targetX, this.targetY);
            this.vx = Math.cos(angle) * this.speed * 0.5;
            this.vy = Math.sin(angle) * this.speed * 0.5;
        }
    }

    updateFlyby(dt, dungeon, player, dist) {
        if (dist < this.aggroRange) {
            // Swooping pattern
            const angle = Utils.angle(this.x, this.y, player.x, player.y);
            const wobble = Math.sin(this.stateTimer * 4) * 1.5;
            this.vx = Math.cos(angle + wobble) * this.speed;
            this.vy = Math.sin(angle + wobble) * this.speed;
        } else {
            this.vx = Math.sin(this.stateTimer * 2) * this.speed * 0.5;
            this.vy = Math.cos(this.stateTimer * 1.5) * this.speed * 0.3;
        }
    }

    updateCircle(dt, dungeon, player, dist) {
        if (dist < this.aggroRange) {
            const desiredDist = 80;
            const angle = Utils.angle(this.x, this.y, player.x, player.y);
            const circleAngle = angle + Math.PI / 2;

            if (dist > desiredDist + 20) {
                this.vx = Math.cos(angle) * this.speed;
                this.vy = Math.sin(angle) * this.speed;
            } else if (dist < desiredDist - 20) {
                this.vx = -Math.cos(angle) * this.speed;
                this.vy = -Math.sin(angle) * this.speed;
            } else {
                this.vx = Math.cos(circleAngle) * this.speed;
                this.vy = Math.sin(circleAngle) * this.speed;
            }
        }
    }

    updateRanged(dt, dungeon, player, dist) {
        const preferredDist = 150;
        const angle = Utils.angle(this.x, this.y, player.x, player.y);

        if (dist < preferredDist - 30) {
            // Back away
            this.vx = -Math.cos(angle) * this.speed;
            this.vy = -Math.sin(angle) * this.speed;
        } else if (dist > preferredDist + 30 && dist < this.aggroRange) {
            // Get closer
            this.vx = Math.cos(angle) * this.speed * 0.5;
            this.vy = Math.sin(angle) * this.speed * 0.5;
        } else {
            this.vx *= 0.9;
            this.vy *= 0.9;
        }

        // Shoot
        if (dist < this.attackRange && this.attackCooldown <= 0) {
            this.attackCooldown = this.attackMaxCooldown;
            this.shootProjectile(player);
        }
    }

    updateCharge(dt, dungeon, player, dist) {
        if (this.state === 'idle' && dist < this.aggroRange) {
            this.state = 'preparing';
            this.stateTimer = 0;
        }

        if (this.state === 'preparing') {
            this.vx *= 0.8;
            this.vy *= 0.8;
            // Telegraph: warning indicator
            this._telegraphing = true;
            this._telegraphAngle = Utils.angle(this.x, this.y, player.x, player.y);
            if (this.stateTimer > 0.8) {
                this.state = 'charging';
                this.stateTimer = 0;
                this._telegraphing = false;
                const angle = Utils.angle(this.x, this.y, player.x, player.y);
                this.vx = Math.cos(angle) * this.speed * 5;
                this.vy = Math.sin(angle) * this.speed * 5;
                Utils.addShake(3);
            }
        }

        if (this.state === 'charging') {
            this.vx *= 0.97;
            this.vy *= 0.97;
            if (this.stateTimer > 0.5) {
                this.state = 'recovering';
                this.stateTimer = 0;
            }
        }

        if (this.state === 'recovering') {
            this.vx *= 0.9;
            this.vy *= 0.9;
            if (this.stateTimer > 1) {
                this.state = 'idle';
                this.stateTimer = 0;
            }
        }
    }

    updateBoss(dt, dungeon, player, dist) {
        // Phase transitions
        if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
            this.phase = 2;
            this.speed *= 1.3;
            this.attackMaxCooldown *= 0.7;
            Utils.addShake(15);
            Utils.addFlash('#ff1744', 0.5);
            particles.explosion(this.x, this.y, '#ff1744', 50);

            // Boss-specific phase 2 effects
            if (this.type === 'boss_lich') {
                // Lich summons minions
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const sx = this.x + Math.cos(angle) * 60;
                    const sy = this.y + Math.sin(angle) * 60;
                    if (typeof game !== 'undefined') {
                        const minion = new Enemy(sx, sy, 'skeleton');
                        minion.maxHp = 20; minion.hp = 20;
                        minion.baseAttack = 5;
                        game.enemies.push(minion);
                        particles.explosion(sx, sy, '#e040fb', 10);
                    }
                }
            } else if (this.type === 'boss_dragon') {
                // Dragon flame aura - continuous damage zone
                this.flameAura = true;
            }
        }

        // Phase 3 at 25% HP for dragon
        if (this.type === 'boss_dragon' && this.hp < this.maxHp * 0.25 && this.phase === 2) {
            this.phase = 3;
            this.speed *= 1.5;
            Utils.addShake(20);
            Utils.addFlash('#ff6d00', 0.6);
        }

        // Dragon flame aura
        if (this.flameAura && dist < 80) {
            if (Math.random() < 0.1) {
                player.takeDamage(2, this.x, this.y);
                particles.add(new Particle(player.x + Utils.rand(-10,10), player.y + Utils.rand(-10,10), {
                    life: 0.3, size: 3, endSize: 0,
                    color: Utils.randChoice(['#ff6d00','#ff3d00']),
                    glow: true, glowSize: 6,
                }));
            }
        }

        // Attack patterns rotate
        const patternCount = this.type === 'boss_dragon' ? 4 : (this.type === 'boss_lich' ? 4 : 3);
        if (this.attackCooldown <= 0 && dist < this.aggroRange) {
            this.attackCooldown = this.attackMaxCooldown;
            this.bossAttackPattern = (this.bossAttackPattern + 1) % patternCount;

            switch (this.bossAttackPattern) {
                case 0: // Charge
                    const angle = Utils.angle(this.x, this.y, player.x, player.y);
                    this.knockbackX = Math.cos(angle) * 800;
                    this.knockbackY = Math.sin(angle) * 800;
                    Utils.addShake(5);
                    break;
                case 1: // Projectile burst
                    for (let i = 0; i < (this.phase === 2 ? 12 : 8); i++) {
                        const a = (i / (this.phase === 2 ? 12 : 8)) * Math.PI * 2;
                        this.projectiles.push({
                            x: this.x, y: this.y,
                            vx: Math.cos(a) * 200,
                            vy: Math.sin(a) * 200,
                            damage: this.baseAttack * 0.6,
                            life: 3,
                            size: 6,
                            color: '#ff4444',
                        });
                    }
                    break;
                case 2: // Slam
                    Utils.addShake(10);
                    particles.explosion(this.x, this.y, '#ff6600', 40);
                    // Slam damages nearby player
                    if (dist < 80) {
                        player.takeDamage(Math.floor(this.baseAttack * 0.8), this.x, this.y);
                    }
                    break;
                case 3: // Boss-specific special attack
                    if (this.type === 'boss_lich') {
                        // Lich: teleport behind player + dark blast
                        const behindAngle = Utils.angle(this.x, this.y, player.x, player.y);
                        particles.explosion(this.x, this.y, '#e040fb', 15);
                        this.x = player.x - Math.cos(behindAngle) * 80;
                        this.y = player.y - Math.sin(behindAngle) * 80;
                        particles.explosion(this.x, this.y, '#e040fb', 15);
                        // Dark blast in cone
                        for (let i = 0; i < 8; i++) {
                            const a = behindAngle + Utils.rand(-0.4, 0.4);
                            this.projectiles.push({
                                x: this.x, y: this.y,
                                vx: Math.cos(a) * 250,
                                vy: Math.sin(a) * 250,
                                damage: this.baseAttack * 0.4,
                                life: 2, size: 5,
                                color: '#e040fb',
                            });
                        }
                        Utils.addShake(8);
                    } else if (this.type === 'boss_dragon') {
                        // Dragon: fire breath line
                        const breathAngle = Utils.angle(this.x, this.y, player.x, player.y);
                        for (let i = 0; i < 15; i++) {
                            const spread = Utils.rand(-0.2, 0.2);
                            const spd = 150 + i * 20;
                            this.projectiles.push({
                                x: this.x, y: this.y,
                                vx: Math.cos(breathAngle + spread) * spd,
                                vy: Math.sin(breathAngle + spread) * spd,
                                damage: this.baseAttack * 0.3,
                                life: 1.5, size: 4 + i * 0.3,
                                color: Utils.randChoice(['#ff6d00', '#ff3d00', '#ffab00']),
                            });
                        }
                        Utils.addShake(6);
                        GameAudio.play('attack');
                    }
                    break;
            }
        }

        // Movement
        const angle = Utils.angle(this.x, this.y, player.x, player.y);
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }

    shootProjectile(player) {
        const angle = Utils.angle(this.x, this.y, player.x, player.y);
        this.projectiles.push({
            x: this.x, y: this.y,
            vx: Math.cos(angle) * 180,
            vy: Math.sin(angle) * 180,
            damage: this.baseAttack,
            life: 3,
            size: 4,
            color: '#e040fb',
        });
    }

    canMoveTo(x, y, dungeon) {
        if (this.phasing) return true;
        return super.canMoveTo(x, y, dungeon);
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Spawn fade-in
        if (this.spawning) {
            const spawnPct = 1 - (this.spawnTimer / 0.5);
            ctx.globalAlpha = spawnPct;
            // Spawn particles
            if (Math.random() < 0.3) {
                particles.add(new Particle(this.x + Utils.rand(-10, 10), this.y + Utils.rand(-10, 10), {
                    life: 0.3, size: Utils.rand(1, 3), endSize: 0,
                    color: this.isBoss ? '#ff1744' : '#7c4dff',
                    vy: -1, glow: true, glowSize: 4,
                }));
            }
            ctx.scale(spawnPct, spawnPct);
        }

        if (this.flashTimer > 0) {
            ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.5 + Math.sin(this.flashTimer * 30) * 0.5);
        }

        const bobY = Math.sin(this.animTimer * 6) * 2;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.h / 2, this.w / 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body based on type
        switch (this.type) {
            case 'slime':
                this.drawSlime(ctx, bobY);
                break;
            case 'bat':
                this.drawBat(ctx, bobY);
                break;
            case 'ghost':
                this.drawGhost(ctx, bobY);
                break;
            case 'boss_demon':
                this.drawBoss(ctx, bobY);
                break;
            default:
                this.drawHumanoid(ctx, bobY);
                break;
        }

        ctx.restore();

        // HP bar (only when damaged)
        if (this.hp < this.maxHp) {
            this.drawHPBar(ctx);
        }

        // Boss name
        if (this.isBoss) {
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y - this.h - 10);
        }

        // Attack telegraph indicator (red line showing charge direction)
        if (this._telegraphing) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,23,68,0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(
                this.x + Math.cos(this._telegraphAngle) * 80,
                this.y + Math.sin(this._telegraphAngle) * 80
            );
            ctx.stroke();
            ctx.setLineDash([]);

            // Warning "!" icon
            const blink = Math.sin(Date.now() * 0.015) > 0;
            if (blink) {
                ctx.fillStyle = '#ff1744';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('!', this.x, this.y - this.h - 5);
            }
            ctx.restore();
        }
    }

    drawSlime(ctx, bobY) {
        const squash = 1 + Math.sin(this.animTimer * 4) * 0.15;
        ctx.save();
        ctx.scale(1 / squash, squash);

        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : this.color;
        ctx.beginPath();
        ctx.ellipse(0, bobY * 0.5, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(-3, -4 + bobY * 0.5, 3, 2, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = this.eyeColor;
        ctx.fillRect(-4, -2 + bobY * 0.5, 3, 3);
        ctx.fillRect(2, -2 + bobY * 0.5, 3, 3);

        ctx.restore();
    }

    drawBat(ctx, bobY) {
        const wingAngle = Math.sin(this.animTimer * 12) * 0.6;

        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : this.color;

        // Wings
        ctx.save();
        ctx.rotate(wingAngle);
        ctx.fillRect(-14, -4 + bobY, 10, 6);
        ctx.restore();
        ctx.save();
        ctx.rotate(-wingAngle);
        ctx.fillRect(4, -4 + bobY, 10, 6);
        ctx.restore();

        // Body
        ctx.beginPath();
        ctx.ellipse(0, bobY, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = this.eyeColor;
        ctx.fillRect(-3, -3 + bobY, 2, 2);
        ctx.fillRect(1, -3 + bobY, 2, 2);
    }

    drawGhost(ctx, bobY) {
        const floatY = Math.sin(this.animTimer * 3) * 5;

        ctx.globalAlpha = 0.6;
        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#c5cae9';

        // Body
        ctx.beginPath();
        ctx.ellipse(0, floatY - 4, 10, 12, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillRect(-10, floatY - 4, 20, 12);

        // Wavy bottom
        for (let i = 0; i < 4; i++) {
            const wx = -8 + i * 5;
            const wy = floatY + 8 + Math.sin(this.animTimer * 4 + i) * 3;
            ctx.beginPath();
            ctx.ellipse(wx, wy, 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyes
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.eyeColor;
        ctx.beginPath();
        ctx.arc(-4, floatY - 4, 3, 0, Math.PI * 2);
        ctx.arc(4, floatY - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#bbdefb';
    }

    drawBoss(ctx, bobY) {
        const pulse = Math.sin(this.animTimer * 3) * 3;

        // Aura
        ctx.shadowBlur = 20 + pulse;
        ctx.shadowColor = '#ff1744';

        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : this.color;

        // Body
        ctx.fillRect(-18, -16 + bobY, 36, 32);

        // Horns
        ctx.fillStyle = '#4a148c';
        ctx.beginPath();
        ctx.moveTo(-14, -16 + bobY);
        ctx.lineTo(-20, -30 + bobY);
        ctx.lineTo(-8, -16 + bobY);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(14, -16 + bobY);
        ctx.lineTo(20, -30 + bobY);
        ctx.lineTo(8, -16 + bobY);
        ctx.fill();

        // Eyes
        ctx.fillStyle = this.eyeColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.eyeColor;
        ctx.fillRect(-10, -8 + bobY, 6, 4);
        ctx.fillRect(4, -8 + bobY, 6, 4);

        // Mouth
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(-8, 2 + bobY, 16, 4);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-6 + i * 4, 0 + bobY, 2, 4);
        }

        ctx.shadowBlur = 0;

        // Phase 2 flame aura
        if (this.phase >= 2) {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + this.animTimer * 2;
                const fx = Math.cos(angle) * (25 + pulse);
                const fy = Math.sin(angle) * (25 + pulse);
                particles.add(new Particle(this.x + fx, this.y + fy, {
                    life: 0.2,
                    size: Utils.rand(2, 5),
                    endSize: 0,
                    color: Utils.randChoice(['#ff1744', '#ff6600', '#ffeb3b']),
                    glow: true,
                    glowSize: 8,
                }));
            }
        }
    }

    drawHumanoid(ctx, bobY) {
        ctx.fillStyle = this.flashTimer > 0 ? '#fff' : this.color;

        // Body
        ctx.fillRect(-8, -8 + bobY, 16, 16);

        // Head
        ctx.fillRect(-6, -16 + bobY, 12, 10);

        // Eyes
        const eyeOffX = Math.cos(this.facing) * 1.5;
        ctx.fillStyle = this.eyeColor;
        ctx.fillRect(-4 + eyeOffX, -13 + bobY, 2, 2);
        ctx.fillRect(2 + eyeOffX, -13 + bobY, 2, 2);

        // Weapon indicator for knight
        if (this.type === 'knight') {
            ctx.fillStyle = '#90a4ae';
            ctx.fillRect(10, -10 + bobY, 4, 20);
            ctx.fillRect(6, -10 + bobY, 12, 3);
        }

        // Mage staff
        if (this.type === 'mage') {
            ctx.fillStyle = '#4a148c';
            ctx.fillRect(10, -18 + bobY, 3, 26);
            ctx.fillStyle = '#e040fb';
            ctx.beginPath();
            ctx.arc(11.5, -18 + bobY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawHPBar(ctx) {
        const isSpecial = this.isElite || this.isBoss;
        const barWidth = isSpecial ? 40 : 30;
        const barHeight = isSpecial ? 4 : 3;
        const x = this.x - barWidth / 2;
        const y = this.y - this.h / 2 - (isSpecial ? 14 : 8);

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

        const hpPercent = this.hp / this.maxHp;
        const color = hpPercent > 0.5 ? '#4caf50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth * hpPercent, barHeight);

        // Name for elites
        if (isSpecial && !this.isBoss) {
            ctx.fillStyle = this.isElite ? '#ff9800' : '#ff1744';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name.substring(0, 20), this.x, y - 3);
            ctx.textAlign = 'left';
        }
    }

    drawProjectiles(ctx) {
        for (const p of this.projectiles) {
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Inner glow
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    updateProjectiles(dt, player, dungeon) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // Trail
            particles.trailEffect(p.x, p.y, p.color);

            // Hit player
            if (circleCollide(p.x, p.y, p.size, player.x, player.y, player.w / 2)) {
                player.takeDamage(p.damage, p.x, p.y);
                particles.hitSpark(p.x, p.y, p.color);
                Utils.addShake(3);
                GameAudio.play('playerHit');
                this.projectiles.splice(i, 1);
                continue;
            }

            // Hit wall
            const tx = Math.floor(p.x / TILE_SIZE);
            const ty = Math.floor(p.y / TILE_SIZE);
            if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height ||
                dungeon.tiles[ty][tx] === TILE.WALL || dungeon.tiles[ty][tx] === TILE.VOID) {
                particles.hitSpark(p.x, p.y, p.color, 5);
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }
}
