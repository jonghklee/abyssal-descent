// ============================================
// COMBAT - Weapons & Attack system
// ============================================

const WEAPON_TYPES = {
    sword: {
        name: 'Iron Sword',
        damage: 10,        // Balanced: good DPS, medium range
        range: 42,
        arc: Math.PI * 0.6,
        cooldown: 0.32,    // DPS: ~31
        knockback: 300,
        type: 'melee',
        color: '#b0bec5',
        swingSpeed: 8,
    },
    axe: {
        name: 'Battle Axe',
        damage: 20,         // Heavy hitter: high dmg, wide arc, slow
        range: 38,
        arc: Math.PI * 0.9,
        cooldown: 0.55,     // DPS: ~36
        knockback: 600,
        type: 'melee',
        color: '#8d6e63',
        swingSpeed: 6,
    },
    dagger: {
        name: 'Shadow Dagger',
        damage: 7,          // Speed demon: fast, crit bonus
        range: 28,
        arc: Math.PI * 0.35,
        cooldown: 0.12,     // DPS: ~58 (highest raw DPS!)
        knockback: 120,
        type: 'melee',
        color: '#78909c',
        swingSpeed: 18,
        critBonus: 0.15,    // +15% crit chance with dagger
    },
    spear: {
        name: 'Long Spear',
        damage: 13,          // Long range poke: safe play
        range: 65,
        arc: Math.PI * 0.22,
        cooldown: 0.40,      // DPS: ~33
        knockback: 350,
        type: 'melee',
        color: '#a1887f',
        swingSpeed: 10,
    },
    staff: {
        name: 'Fire Staff',
        damage: 14,
        range: 250,
        arc: 0,
        cooldown: 0.5,
        knockback: 100,
        type: 'ranged',
        color: '#ff6d00',
        projectileSpeed: 350,
        projectileSize: 5,
        projectileColor: '#ff6d00',
    },
    bow: {
        name: 'Hunter\'s Bow',
        damage: 11,
        range: 300,
        arc: 0,
        cooldown: 0.4,
        knockback: 200,
        type: 'ranged',
        color: '#795548',
        projectileSpeed: 450,
        projectileSize: 3,
        projectileColor: '#ffd740',
    },
};

class Weapon {
    constructor(type, rarity = 'common') {
        const def = WEAPON_TYPES[type];
        this.type = type;
        this.weaponType = def.type;
        this.name = def.name;
        this.baseDamage = def.damage;
        this.range = def.range;
        this.arc = def.arc;
        this.cooldown = def.cooldown;
        this.knockback = def.knockback;
        this.color = def.color;
        this.swingSpeed = def.swingSpeed || 8;
        this.projectileSpeed = def.projectileSpeed;
        this.projectileSize = def.projectileSize;
        this.projectileColor = def.projectileColor;

        // Rarity multipliers
        this.rarity = rarity;
        const rarityMult = { common: 1, uncommon: 1.3, rare: 1.6, epic: 2.0, legendary: 2.8 };
        this.damageMultiplier = rarityMult[rarity] || 1;
        this.damage = Math.floor(this.baseDamage * this.damageMultiplier);

        // Visual
        this.swingAngle = 0;
        this.isSwinging = false;
        this.swingTimer = 0;
        this.swingDirection = 1;

        // Special effects
        this.effects = [];
        this.applyRarityEffects();
    }

    applyRarityEffects() {
        if (this.rarity === 'rare') {
            this.effects.push(Utils.randChoice(['fire', 'ice', 'poison']));
        } else if (this.rarity === 'epic') {
            this.effects.push(Utils.randChoice(['fire', 'ice', 'poison']));
            this.effects.push(Utils.randChoice(['lifesteal', 'critBoost']));
        } else if (this.rarity === 'legendary') {
            this.effects.push('fire');
            this.effects.push('lifesteal');
            this.effects.push('critBoost');
            // Unique legendary names
            const legendaryNames = {
                sword: Utils.randChoice(['Excalibur', 'Dawnbreaker', 'Void Cleaver', 'Soul Reaper']),
                axe: Utils.randChoice(['Ragnarok', 'World Splitter', 'Doom Axe', 'Titan Cleaver']),
                dagger: Utils.randChoice(['Whisper', 'Shadowfang', 'Death Kiss', 'Phantom Blade']),
                spear: Utils.randChoice(['Gungnir', 'Dragon Lance', 'Heaven Piercer', 'Fate\'s Point']),
                staff: Utils.randChoice(['Arcane Infinity', 'Nova Staff', 'Void Scepter', 'Star Weaver']),
                bow: Utils.randChoice(['Artemis', 'Storm Bow', 'Soul Hunter', 'Eclipse Arc']),
            };
            if (legendaryNames[this.type]) {
                this.name = legendaryNames[this.type];
                this.uniqueName = true;
            }
        }
    }

    getDamage(playerAttack, isCrit) {
        let dmg = this.damage + playerAttack;
        if (isCrit) dmg *= 2;
        return Math.floor(dmg);
    }

    getRarityColor() {
        const colors = {
            common: '#9e9e9e',
            uncommon: '#4caf50',
            rare: '#2196f3',
            epic: '#9c27b0',
            legendary: '#ff9800',
        };
        return colors[this.rarity] || '#9e9e9e';
    }

    getDisplayName() {
        // Unique legendary names don't get generic prefix
        if (this.uniqueName) return this.name;

        const prefixes = {
            uncommon: 'Fine',
            rare: 'Superior',
            epic: 'Mythic',
            legendary: 'Legendary',
        };
        const prefix = prefixes[this.rarity];
        return prefix ? `${prefix} ${this.name}` : this.name;
    }
}

class CombatSystem {
    constructor() {
        this.playerProjectiles = [];
        this.damageNumbers = [];
        this.swingVisuals = [];
    }

    attack(player, enemies, input, dungeon) {
        if (player.attackCooldown > 0) return;
        if (player.weapons.length === 0) return;

        const weapon = player.weapons[player.currentWeapon];
        player.attackCooldown = weapon.cooldown;

        if (weapon.weaponType === 'melee') {
            this.meleeAttack(player, weapon, enemies, input);
        } else {
            this.rangedAttack(player, weapon, input, dungeon);
        }

        GameAudio.play('attack');
    }

    meleeAttack(player, weapon, enemies, input) {
        const angle = player.facing;

        // Swing visual
        weapon.isSwinging = true;
        weapon.swingTimer = 0;
        weapon.swingDirection *= -1;

        // Check hits
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;

            const dist = Utils.dist(player.x, player.y, enemy.x, enemy.y);
            if (dist > weapon.range + enemy.w / 2) continue;

            const angleToEnemy = Utils.angle(player.x, player.y, enemy.x, enemy.y);
            let angleDiff = angleToEnemy - angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            if (Math.abs(angleDiff) < weapon.arc / 2) {
                const critBonus = weapon.critBonus || 0;
                const isCrit = Math.random() < (player.critChance + critBonus);
                let dmg = weapon.getDamage(player.attack, isCrit);
                dmg = Math.max(1, dmg);

                // Weapon set bonus: +15% if 2+ same type weapons
                const sameType = player.weapons.filter(w => w.type === weapon.type).length;
                if (sameType >= 2) dmg = Math.floor(dmg * 1.15);

                // Rogue passive: first hit on fresh enemy = 2x
                if (player.assassinFirstHit && !enemy._hitOnce) {
                    dmg *= 2;
                    enemy._hitOnce = true;
                }

                // Berserker fury (synergy): below 30% HP = 2x
                if (player.berserkerFury && player.hp < player.maxHp * 0.3) {
                    dmg *= 2;
                }

                // Combo multiplier
                dmg = Math.floor(dmg * player.getComboMultiplier());

                const didDamage = enemy.takeDamage(dmg, player.x, player.y);
                if (didDamage) {
                    hitCount++;
                    player.addCombo();

                    // Damage number
                    this.addDamageNumber(enemy.x, enemy.y - enemy.h / 2, dmg, isCrit);

                    // Effects
                    const hitAngle = Utils.angle(player.x, player.y, enemy.x, enemy.y);
                    particles.bloodSplatter(enemy.x, enemy.y, hitAngle, 10);
                    particles.hitSpark(enemy.x, enemy.y,
                        isCrit ? '#ffeb3b' : weapon.color, isCrit ? 15 : 8);

                    Utils.addShake(isCrit ? 6 : 3);
                    if (isCrit) {
                        Utils.addFreeze(3);
                        Utils.addFlash('#ffeb3b', 0.15);
                        // Screen slash VFX on high-damage crits
                        if (typeof game !== 'undefined' && game.vfx && dmg > 30) {
                            game.vfx.critSlash(Utils.angle(player.x, player.y, enemy.x, enemy.y));
                        }
                    }

                    // Weapon elemental effects with visuals
                    if (weapon.effects.includes('fire')) {
                        particles.explosion(enemy.x, enemy.y, '#ff6600', 8);
                        enemy.takeDamage(Math.floor(dmg * 0.2), player.x, player.y);
                    }
                    if (weapon.effects.includes('ice')) {
                        enemy.speed *= 0.5;
                        setTimeout(() => { if (enemy.alive) enemy.speed *= 2; }, 2000);
                        // Ice crystals
                        for (let k = 0; k < 5; k++) {
                            particles.add(new Particle(enemy.x + Utils.rand(-8,8), enemy.y + Utils.rand(-8,8), {
                                life: 0.5, size: Utils.rand(2,4), endSize: 0,
                                color: Utils.randChoice(['#4fc3f7','#b3e5fc','#e1f5fe']),
                                vy: Utils.rand(-1, 0), shape: 'square', rotSpeed: 3,
                            }));
                        }
                    }
                    if (weapon.effects.includes('poison')) {
                        // Poison DoT
                        if (!enemy._poisoned) {
                            enemy._poisoned = true;
                            const poisonDmg = Math.floor(dmg * 0.05);
                            const poisonInterval = setInterval(() => {
                                if (!enemy.alive) { clearInterval(poisonInterval); return; }
                                enemy.takeDamage(poisonDmg, enemy.x, enemy.y);
                                particles.add(new Particle(enemy.x, enemy.y - 5, {
                                    life: 0.3, size: 2, endSize: 0, color: '#66bb6a', vy: -1,
                                }));
                            }, 500);
                            setTimeout(() => { clearInterval(poisonInterval); enemy._poisoned = false; }, 3000);
                        }
                    }
                    if (weapon.effects.includes('chain')) {
                        // Chain lightning to nearby enemy
                        for (const other of enemies) {
                            if (other === enemy || !other.alive) continue;
                            const d = Utils.dist(enemy.x, enemy.y, other.x, other.y);
                            if (d < 80) {
                                other.takeDamage(Math.floor(dmg * 0.3), enemy.x, enemy.y);
                                particles.hitSpark(other.x, other.y, '#ffeb3b', 5);
                                break; // Only chain to 1
                            }
                        }
                    }
                    if (weapon.effects.includes('lifesteal') || player.lifesteal > 0) {
                        const stealPct = (weapon.effects.includes('lifesteal') ? 0.1 : 0) + player.lifesteal;
                        const heal = Math.floor(dmg * stealPct);
                        if (heal > 0) {
                            player.hp = Math.min(player.hp + heal, player.maxHp);
                            particles.trailEffect(player.x, player.y, '#66bb6a');
                        }
                    }

                    // Check death
                    if (!enemy.alive) {
                        this.onEnemyDeath(enemy, player);
                    }

                    GameAudio.play('hit');
                }
            }
        }

        // Hit goblins too
        if (typeof game !== 'undefined' && game.goblinManager) {
            const dmg = weapon.getDamage(player.attack, false);
            game.goblinManager.checkHits(player.x, player.y, weapon.range, dmg);
        }

        // Swing arc visual
        this.swingVisuals.push({
            x: player.x, y: player.y,
            angle: angle,
            range: weapon.range,
            arc: weapon.arc,
            color: weapon.getRarityColor(),
            life: 0.15,
            maxLife: 0.15,
        });
    }

    rangedAttack(player, weapon, input, dungeon) {
        const angle = player.facing;

        this.playerProjectiles.push({
            x: player.x + Math.cos(angle) * 15,
            y: player.y + Math.sin(angle) * 15,
            vx: Math.cos(angle) * weapon.projectileSpeed,
            vy: Math.sin(angle) * weapon.projectileSpeed,
            damage: weapon.getDamage(player.attack, false),
            weapon: weapon,
            player: player,
            size: weapon.projectileSize,
            color: weapon.projectileColor,
            life: 2,
            piercing: weapon.rarity === 'legendary',
        });
    }

    update(dt, player, enemies, dungeon) {
        // Update player projectiles
        for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
            const p = this.playerProjectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            particles.trailEffect(p.x, p.y, p.color);

            // Check enemy collision
            let hitEnemy = false;
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                if (circleCollide(p.x, p.y, p.size, enemy.x, enemy.y, enemy.w / 2)) {
                    const isCrit = Math.random() < p.player.critChance;
                    let dmg = p.damage;
                    if (isCrit) dmg *= p.player.critMultiplier;
                    dmg = Math.floor(dmg * p.player.getComboMultiplier());

                    enemy.takeDamage(dmg, p.x, p.y);
                    p.player.addCombo();
                    this.addDamageNumber(enemy.x, enemy.y - enemy.h / 2, dmg, isCrit);
                    particles.hitSpark(p.x, p.y, p.color);
                    Utils.addShake(2);

                    if (!enemy.alive) {
                        this.onEnemyDeath(enemy, p.player);
                    }

                    GameAudio.play('hit');
                    if (!p.piercing) {
                        hitEnemy = true;
                        break;
                    }
                }
            }

            if (hitEnemy) {
                this.playerProjectiles.splice(i, 1);
                continue;
            }

            // Wall collision
            const tx = Math.floor(p.x / TILE_SIZE);
            const ty = Math.floor(p.y / TILE_SIZE);
            if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height ||
                dungeon.tiles[ty][tx] === TILE.WALL || dungeon.tiles[ty][tx] === TILE.VOID) {
                particles.hitSpark(p.x, p.y, p.color, 5);
                this.playerProjectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.playerProjectiles.splice(i, 1);
            }
        }

        // Update swing visuals
        for (let i = this.swingVisuals.length - 1; i >= 0; i--) {
            this.swingVisuals[i].life -= dt;
            if (this.swingVisuals[i].life <= 0) {
                this.swingVisuals.splice(i, 1);
            }
        }

        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.y += dn.vy * dt * 60;
            dn.vy -= 0.05;
            dn.life -= dt;
            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // Update weapon swing animation
        if (player.weapons.length > 0) {
            const weapon = player.weapons[player.currentWeapon];
            if (weapon.isSwinging) {
                weapon.swingTimer += dt;
                weapon.swingAngle = Math.sin(weapon.swingTimer * weapon.swingSpeed * Math.PI) *
                    weapon.arc / 2 * weapon.swingDirection;
                if (weapon.swingTimer > 1 / weapon.swingSpeed) {
                    weapon.isSwinging = false;
                    weapon.swingAngle = 0;
                }
            }
        }
    }

    onEnemyDeath(enemy, player) {
        player.gainXP(enemy.xpReward);

        // Daily challenge score
        if (typeof game !== 'undefined' && game.dailyChallenge && game.dailyChallenge.active) {
            const points = enemy.isBoss ? 500 : enemy.isElite ? 100 : 10;
            game.dailyChallenge.addScore(points);
        }
        player.gold += enemy.goldReward;
        player.kills++;

        // First kill celebration
        if (typeof game !== 'undefined' && !game.firstKillDone && player.kills === 1) {
            game.firstKillDone = true;
            Utils.addSlowMo(0.2, 0.8);
            Utils.addFreeze(6);
            if (game.vfx) game.vfx.critSlash(Utils.angle(player.x, player.y, enemy.x, enemy.y));
        }

        // Golden enemy death celebration
        if (enemy.isGolden) {
            Utils.addSlowMo(0.2, 0.5);
            Utils.addFreeze(5);
            Utils.addFlash('#ffd740', 0.4);
            Utils.addShake(10);
            particles.explosion(enemy.x, enemy.y, '#ffd740', 40);
            for (let i = 0; i < 20; i++) {
                particles.add(new Particle(enemy.x + Utils.rand(-15,15), enemy.y + Utils.rand(-15,15), {
                    life: Utils.rand(0.5, 1.2), size: Utils.rand(2, 5), endSize: 0,
                    color: Utils.randChoice(['#ffd740', '#ffab00', '#fff176']),
                    vx: Utils.rand(-4, 4), vy: Utils.rand(-5, -1),
                    glow: true, glowSize: 8, gravity: 0.1,
                }));
            }
            if (typeof game !== 'undefined') {
                game.ui.notify(`✦ GOLDEN KILL! +${enemy.goldReward}g +${enemy.xpReward}xp!`, '#ffd740', 3);
                if (game.vfx) game.vfx.legendaryBeam(
                    enemy.x - game.camera.x + game.camera.halfW,
                    enemy.y - game.camera.y + game.camera.halfH
                );
            }
            GameAudio.play('bossDeath');
        }

        // Type-specific death effects
        const deathColors = {
            slime: '#66bb6a', skeleton: '#e0e0e0', bat: '#ce93d8',
            zombie: '#558b2f', ghost: '#b3e5fc', mage: '#e040fb',
            knight: '#90a4ae', assassin: '#263238', necromancer: '#7c4dff',
            golem_enemy: '#8d6e63',
            boss_demon: '#ff1744', boss_lich: '#e040fb', boss_dragon: '#ff6d00',
        };
        const deathColor = deathColors[enemy.type] || '#ff6600';
        const deathCount = enemy.isBoss ? 60 : enemy.isElite ? 35 : 25;
        particles.explosion(enemy.x, enemy.y, deathColor, deathCount);

        // Slime splits into small particles
        if (enemy.type === 'slime') {
            for (let i = 0; i < 6; i++) {
                particles.add(new Particle(enemy.x + Utils.rand(-8,8), enemy.y + Utils.rand(-8,8), {
                    life: 0.5, size: Utils.rand(3,6), endSize: 0,
                    color: '#66bb6a', gravity: 0.2, friction: 0.95,
                    vx: Utils.rand(-3,3), vy: Utils.rand(-4,-1),
                }));
            }
        }
        // Ghost fades with ethereal wisps
        if (enemy.type === 'ghost') {
            for (let i = 0; i < 8; i++) {
                particles.add(new Particle(enemy.x, enemy.y, {
                    life: 1.0, size: Utils.rand(2,4), endSize: 8,
                    color: 'rgba(179,229,252,0.3)',
                    vy: Utils.rand(-2,-0.5), vx: Utils.rand(-1,1),
                }));
            }
        }

        Utils.addShake(enemy.isBoss ? 15 : 5);
        Utils.addFreeze(enemy.isBoss ? 10 : 2);

        if (enemy.isBoss) {
            Utils.addSlowMo(0.2, 1.0);
            Utils.addFlash('#ff1744', 0.5);
            // Boss kill screen crack
            if (typeof game !== 'undefined' && game.vfx) {
                game.vfx.screenCrack();
            }
        } else if (enemy.isElite) {
            // Elite kill = satisfying
            Utils.addSlowMo(0.3, 0.3);
            Utils.addFlash('#ffd740', 0.2);
            if (typeof game !== 'undefined' && game.vfx) {
                game.vfx.critSlash(Utils.angle(player.x, player.y, enemy.x, enemy.y));
            }
        } else {
            Utils.addSlowMo(0.6, 0.1);
        }

        // Multi-kill bonus feel
        if (player.combo >= 10) {
            Utils.addFlash('#ffeb3b', 0.15);
            if (typeof game !== 'undefined' && game.vfx && player.combo % 10 === 0) {
                game.vfx.comboExplosion();
            }
        } else if (player.combo >= 5) {
            Utils.addFlash('#ffeb3b', 0.08);
        }

        // Warrior passive: +1 ATK per 10 kills
        if (player.killAttackBonus && player.kills % 10 === 0 && player.kills > 0) {
            player.attack += 1;
            if (typeof game !== 'undefined' && game.ui) {
                game.ui.notify('Berserker: +1 ATK!', '#f44336', 2);
            }
        }

        // Necromancer passive: summon skeleton on kill
        if (player.necroSummon && typeof game !== 'undefined') {
            if (!player._necroAllies) player._necroAllies = [];
            // Remove dead allies
            player._necroAllies = player._necroAllies.filter(a => a.alive);

            if (player._necroAllies.length < (player.necroMax || 3) && Math.random() < 0.3) {
                const ally = new Enemy(enemy.x, enemy.y, 'skeleton');
                ally.isAlly = true;
                ally.name = '💀 Skeleton Ally';
                ally.maxHp = 30 + player.level * 5;
                ally.hp = ally.maxHp;
                ally.baseAttack = Math.floor(player.attack * 0.3);
                ally.speed = 100;
                ally.xpReward = 0;
                ally.goldReward = 0;
                // Allies don't attack player — handled by checking isAlly in combat
                player._necroAllies.push(ally);
                game.enemies.push(ally); // Add to enemy list for rendering
                particles.explosion(enemy.x, enemy.y, '#e040fb', 15);
                game.ui.notify('💀 Skeleton summoned!', '#e040fb', 1.5);
            }
        }

        GameAudio.play(enemy.isBoss ? 'bossDeath' : 'enemyDeath');
    }

    addDamageNumber(x, y, damage, isCrit) {
        const dmgNum = typeof damage === 'number' ? damage : 0;
        // Scale size with damage (bigger hits = bigger numbers)
        let baseSize = isCrit ? 18 : 14;
        if (dmgNum > 100) baseSize = 24;
        else if (dmgNum > 50) baseSize = 20;
        else if (dmgNum > 25) baseSize = 17;

        this.damageNumbers.push({
            x: x + Utils.rand(-10, 10),
            y: y,
            text: damage.toString(),
            color: isCrit ? '#ffeb3b' : dmgNum > 50 ? '#ff9800' : '#ff5252',
            size: baseSize,
            life: dmgNum > 50 ? 1.3 : 1.0,
            vy: -2,
            isCrit,
        });
    }

    draw(ctx) {
        // Swing visuals
        for (const sv of this.swingVisuals) {
            const alpha = sv.life / sv.maxLife;
            ctx.save();
            ctx.translate(sv.x, sv.y);
            ctx.rotate(sv.angle - sv.arc / 2);
            ctx.fillStyle = sv.color;
            ctx.globalAlpha = alpha * 0.3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, sv.range, 0, sv.arc);
            ctx.closePath();
            ctx.fill();

            // Arc outline
            ctx.strokeStyle = sv.color;
            ctx.globalAlpha = alpha * 0.8;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, sv.range, 0, sv.arc);
            ctx.stroke();
            ctx.restore();
        }

        // Player projectiles
        for (const p of this.playerProjectiles) {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Damage numbers
        for (const dn of this.damageNumbers) {
            const alpha = dn.life;
            const scale = dn.isCrit ? 1.2 + (1 - dn.life) * 0.3 : 1;
            ctx.save();
            ctx.translate(dn.x, dn.y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${dn.size}px monospace`;
            ctx.textAlign = 'center';

            // Shadow
            ctx.fillStyle = '#000';
            ctx.fillText(dn.text, 1, 1);

            // Text
            ctx.fillStyle = dn.color;
            ctx.fillText(dn.text, 0, 0);

            if (dn.isCrit) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold 8px monospace`;
                ctx.fillText('CRIT!', 0, -12);
            }
            ctx.restore();
        }
    }

    drawWeapon(ctx, player) {
        if (player.weapons.length === 0) return;
        const weapon = player.weapons[player.currentWeapon];

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.facing + weapon.swingAngle);

        if (weapon.weaponType === 'melee') {
            // Weapon handle
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(8, -2, 8, 4);

            // Weapon blade with rarity glow
            const rarityIdx = ['common','uncommon','rare','epic','legendary'].indexOf(weapon.rarity);
            ctx.fillStyle = weapon.getRarityColor();
            ctx.shadowBlur = rarityIdx >= 3 ? 12 : (weapon.isSwinging ? 8 : 0); // Epic+ always glows
            ctx.shadowColor = weapon.getRarityColor();

            switch (weapon.type) {
                case 'sword':
                    ctx.fillRect(16, -3, 22, 6);
                    ctx.fillRect(36, -2, 4, 4);
                    break;
                case 'axe':
                    ctx.fillRect(14, -2, 10, 4);
                    ctx.beginPath();
                    ctx.moveTo(24, -10);
                    ctx.lineTo(34, 0);
                    ctx.lineTo(24, 10);
                    ctx.fill();
                    break;
                case 'dagger':
                    ctx.fillRect(14, -2, 14, 4);
                    ctx.fillRect(26, -1, 4, 2);
                    break;
                case 'spear':
                    ctx.fillRect(12, -1.5, 35, 3);
                    ctx.beginPath();
                    ctx.moveTo(47, -5);
                    ctx.lineTo(55, 0);
                    ctx.lineTo(47, 5);
                    ctx.fill();
                    break;
            }
        } else {
            // Ranged weapon
            ctx.fillStyle = weapon.color;
            if (weapon.type === 'staff') {
                ctx.fillRect(8, -2, 30, 4);
                ctx.fillStyle = weapon.projectileColor;
                ctx.shadowBlur = 10;
                ctx.shadowColor = weapon.projectileColor;
                ctx.beginPath();
                ctx.arc(40, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            } else if (weapon.type === 'bow') {
                ctx.strokeStyle = weapon.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(20, 0, 15, -Math.PI / 3, Math.PI / 3);
                ctx.stroke();
                ctx.strokeStyle = '#bcaaa4';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20 + Math.cos(-Math.PI / 3) * 15, Math.sin(-Math.PI / 3) * 15);
                ctx.lineTo(20 + Math.cos(Math.PI / 3) * 15, Math.sin(Math.PI / 3) * 15);
                ctx.stroke();
            }
        }

        ctx.restore();

        // Weapon enchant particles (trail effect on weapon tip)
        if (weapon.isSwinging && weapon.enchantPrefix) {
            const tipDist = weapon.weaponType === 'melee' ? weapon.range * 0.8 : 30;
            const tipX = player.x + Math.cos(player.facing + weapon.swingAngle) * tipDist;
            const tipY = player.y + Math.sin(player.facing + weapon.swingAngle) * tipDist;

            const effectColors = {
                'Blazing': ['#ff6d00', '#ff3d00', '#ffab00'],
                'Frozen': ['#4fc3f7', '#81d4fa', '#b3e5fc'],
                'Venomous': ['#66bb6a', '#43a047', '#a5d6a7'],
                'Vampiric': ['#e91e63', '#f48fb1', '#ff1744'],
                'Thunder': ['#ffeb3b', '#fff176', '#fff9c4'],
                'Holy': ['#fff9c4', '#fff176', '#ffffff'],
                'Void': ['#7c4dff', '#b388ff', '#ea80fc'],
                'Bloodthirst': ['#d50000', '#ff1744', '#ff5252'],
            };
            const colors = effectColors[weapon.enchantPrefix.name] || ['#fff'];
            particles.add(new Particle(tipX + Utils.rand(-3, 3), tipY + Utils.rand(-3, 3), {
                life: Utils.rand(0.1, 0.3),
                size: Utils.rand(1, 3),
                endSize: 0,
                color: Utils.randChoice(colors),
                glow: true,
                glowSize: 6,
                vx: Utils.rand(-1, 1),
                vy: Utils.rand(-1, 1),
            }));
        }
    }
}
