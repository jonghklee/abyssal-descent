// ============================================
// SKILLS - Active abilities with cooldowns
// ============================================

const SKILL_DEFS = {
    whirlwind: {
        name: 'Whirlwind',
        description: 'Spin attack hitting all enemies around you',
        icon: '🌀',
        cooldown: 5,
        manaCost: 0,
        unlockLevel: 2,
        key: 'Digit1',
        color: '#4fc3f7',
    },
    fireBlast: {
        name: 'Fire Blast',
        description: 'Launch an explosive fireball',
        icon: '🔥',
        cooldown: 8,
        manaCost: 0,
        unlockLevel: 4,
        key: 'Digit2',
        color: '#ff6d00',
    },
    shadowStep: {
        name: 'Shadow Step',
        description: 'Teleport behind the nearest enemy',
        icon: '👤',
        cooldown: 6,
        manaCost: 0,
        unlockLevel: 6,
        key: 'Digit3',
        color: '#7c4dff',
    },
    warCry: {
        name: 'War Cry',
        description: 'Boost attack and speed for 5 seconds',
        icon: '📢',
        cooldown: 15,
        manaCost: 0,
        unlockLevel: 8,
        key: 'Digit4',
        color: '#ff1744',
    },
};

class SkillSystem {
    constructor(player) {
        this.player = player;
        this.skills = {};
        this.cooldowns = {};
        this.buffs = [];
    }

    checkUnlocks() {
        for (const [id, def] of Object.entries(SKILL_DEFS)) {
            if (!this.skills[id] && this.player.level >= def.unlockLevel) {
                this.skills[id] = { ...def, id };
                this.cooldowns[id] = 0;
                return { id, def }; // Return newly unlocked skill
            }
        }
        return null;
    }

    update(dt) {
        // Mage passive: skill cooldowns -30%
        const cdMult = this.player.skillCdReduction || 1;

        // Update cooldowns
        for (const id of Object.keys(this.cooldowns)) {
            if (this.cooldowns[id] > 0) {
                this.cooldowns[id] -= dt * (1 / cdMult); // Faster recharge
            }
        }

        // Update buffs
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            this.buffs[i].duration -= dt;
            if (this.buffs[i].duration <= 0) {
                // Remove buff effects
                this.removeBuff(this.buffs[i]);
                this.buffs.splice(i, 1);
            }
        }
    }

    canUse(skillId) {
        return this.skills[skillId] && this.cooldowns[skillId] <= 0;
    }

    use(skillId, enemies, combat) {
        if (!this.canUse(skillId)) return false;

        const def = this.skills[skillId];
        this.cooldowns[skillId] = def.cooldown;

        switch (skillId) {
            case 'whirlwind':
                return this.useWhirlwind(enemies, combat);
            case 'fireBlast':
                return this.useFireBlast(enemies, combat);
            case 'shadowStep':
                return this.useShadowStep(enemies);
            case 'warCry':
                return this.useWarCry();
        }
        return false;
    }

    useWhirlwind(enemies, combat) {
        const p = this.player;
        const range = 60;

        // Visual: full circle swing
        combat.swingVisuals.push({
            x: p.x, y: p.y,
            angle: 0,
            range: range,
            arc: Math.PI * 2,
            color: '#4fc3f7',
            life: 0.3,
            maxLife: 0.3,
        });

        Utils.addShake(5);
        GameAudio.play('attack');

        // Damage all enemies in range
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const dist = Utils.dist(p.x, p.y, enemy.x, enemy.y);
            if (dist < range + enemy.w / 2) {
                const dmg = Math.floor((p.attack + 15) * p.getComboMultiplier());
                enemy.takeDamage(dmg, p.x, p.y);
                p.addCombo();
                combat.addDamageNumber(enemy.x, enemy.y - enemy.h / 2, dmg, false);
                particles.hitSpark(enemy.x, enemy.y, '#4fc3f7', 10);
                hitCount++;
            }
        }

        // Spin particles
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            particles.add(new Particle(
                p.x + Math.cos(angle) * range * 0.5,
                p.y + Math.sin(angle) * range * 0.5, {
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 0.3,
                size: 3,
                endSize: 0,
                color: '#4fc3f7',
                glow: true,
                glowSize: 8,
            }));
        }

        return hitCount > 0;
    }

    useFireBlast(enemies, combat) {
        const p = this.player;
        const angle = p.facing;
        const speed = 250;

        // Create fireball projectile
        combat.playerProjectiles.push({
            x: p.x + Math.cos(angle) * 20,
            y: p.y + Math.sin(angle) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: Math.floor((p.attack + 25) * 1.5),
            weapon: { effects: ['fire'], rarity: 'epic', getRarityColor: () => '#ff6d00' },
            player: p,
            size: 10,
            color: '#ff6d00',
            life: 2,
            piercing: false,
            isFireball: true,
        });

        Utils.addShake(4);
        Utils.addFlash('#ff6d00', 0.15);
        GameAudio.play('attack');

        // Muzzle flash
        particles.explosion(
            p.x + Math.cos(angle) * 20,
            p.y + Math.sin(angle) * 20,
            '#ff6d00', 10
        );

        return true;
    }

    useShadowStep(enemies) {
        const p = this.player;

        // Find nearest enemy
        let nearest = null;
        let nearestDist = 300;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const dist = Utils.dist(p.x, p.y, enemy.x, enemy.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        if (!nearest) return false;

        // Particles at old position
        particles.explosion(p.x, p.y, '#7c4dff', 15);

        // Teleport behind enemy
        const behindAngle = Utils.angle(nearest.x, nearest.y, p.x, p.y) + Math.PI;
        p.x = nearest.x + Math.cos(behindAngle) * 30;
        p.y = nearest.y + Math.sin(behindAngle) * 30;
        p.facing = Utils.angle(p.x, p.y, nearest.x, nearest.y);

        // Particles at new position
        particles.explosion(p.x, p.y, '#7c4dff', 15);
        Utils.addFlash('#7c4dff', 0.2);
        GameAudio.play('dash');

        // Brief invulnerability
        p.invulnerable = 0.5;

        return true;
    }

    useWarCry() {
        const p = this.player;

        // Buff: increase attack and speed
        this.buffs.push({
            type: 'warCry',
            duration: 5,
            attackBonus: 10,
            speedBonus: 50,
        });

        p.attack += 10;
        p.speed += 50;

        // Visual
        particles.levelUpEffect(p.x, p.y);
        Utils.addShake(6);
        Utils.addFlash('#ff1744', 0.3);
        GameAudio.play('levelUp');

        return true;
    }

    removeBuff(buff) {
        switch (buff.type) {
            case 'warCry':
                this.player.attack -= buff.attackBonus;
                this.player.speed -= buff.speedBonus;
                break;
        }
    }

    getActiveSkills() {
        return Object.values(this.skills);
    }

    drawHUD(ctx, canvasW, canvasH) {
        const skills = this.getActiveSkills();
        if (skills.length === 0) return;

        const slotSize = 40;
        const padding = 6;
        const totalW = skills.length * (slotSize + padding) - padding;
        const startX = canvasW / 2 - totalW / 2;
        const y = canvasH - 90;

        for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            const x = startX + i * (slotSize + padding);
            const cd = this.cooldowns[skill.id];
            const onCooldown = cd > 0;

            // Background
            ctx.fillStyle = onCooldown ? 'rgba(20,20,30,0.8)' : 'rgba(40,40,60,0.8)';
            ctx.fillRect(x, y, slotSize, slotSize);
            ctx.strokeStyle = onCooldown ? '#333' : skill.color;
            ctx.lineWidth = onCooldown ? 1 : 2;
            ctx.strokeRect(x, y, slotSize, slotSize);

            // Cooldown overlay
            if (onCooldown) {
                const cdPercent = cd / skill.cooldown;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(x, y, slotSize, slotSize * cdPercent);

                ctx.fillStyle = '#78909c';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(Math.ceil(cd).toString(), x + slotSize / 2, y + slotSize / 2 + 5);
            }

            // Icon
            if (!onCooldown) {
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(skill.icon, x + slotSize / 2, y + slotSize / 2 + 7);
            }

            // Key hint
            ctx.fillStyle = '#546e7a';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText((i + 1).toString(), x + slotSize / 2, y + slotSize + 10);
        }
    }
}
