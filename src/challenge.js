// ============================================
// CHALLENGE - Wave survival rooms & special encounters
// ============================================

class ChallengeRoom {
    constructor() {
        this.active = false;
        this.wave = 0;
        this.maxWaves = 0;
        this.waveTimer = 0;
        this.waveCooldown = 2;
        this.enemiesThisWave = 0;
        this.enemiesKilled = 0;
        this.totalKilled = 0;
        this.room = null;
        this.rewards = [];
        this.completed = false;
        this.displayText = '';
        this.displayTimer = 0;
        this.difficulty = 'normal'; // normal, hard, nightmare
    }

    start(room, floor, difficulty = 'normal') {
        this.active = true;
        this.wave = 0;
        this.difficulty = difficulty;
        this.room = room;
        this.completed = false;
        this.totalKilled = 0;

        switch (difficulty) {
            case 'normal':    this.maxWaves = 3; break;
            case 'hard':      this.maxWaves = 5; break;
            case 'nightmare': this.maxWaves = 8; break;
        }

        this.showText('CHALLENGE ROOM!', '#ff1744');
        Utils.addShake(10);
        Utils.addFlash('#ff1744', 0.3);
        GameAudio.play('trap');

        // Start first wave after delay
        this.waveTimer = 2;
    }

    update(dt, game) {
        if (!this.active) return;

        if (this.displayTimer > 0) this.displayTimer -= dt;

        if (this.waveTimer > 0) {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0 && !this.completed) {
                this.spawnWave(game);
            }
            return;
        }

        // Check if wave is clear
        if (this.enemiesThisWave > 0) {
            const aliveInRoom = game.enemies.filter(e =>
                e.alive && e.challengeWave === this.wave
            );
            if (aliveInRoom.length === 0) {
                this.enemiesKilled += this.enemiesThisWave;
                this.totalKilled += this.enemiesThisWave;
                this.enemiesThisWave = 0;

                if (this.wave >= this.maxWaves) {
                    this.complete(game);
                } else {
                    this.showText(`Wave ${this.wave} Clear!`, '#4caf50');
                    this.waveTimer = this.waveCooldown;
                }
            }
        }
    }

    spawnWave(game) {
        this.wave++;
        const floor = game.floor;

        this.showText(`Wave ${this.wave}/${this.maxWaves}`, '#ff9800');
        Utils.addShake(5);
        GameAudio.play('trap');

        // Number of enemies scales with wave and difficulty
        const diffMult = { normal: 1, hard: 1.5, nightmare: 2 };
        const baseCount = 3 + this.wave * 2;
        const count = Math.floor(baseCount * (diffMult[this.difficulty] || 1));

        const types = game.getFloorEnemyTypes();
        this.enemiesThisWave = count;

        for (let i = 0; i < count; i++) {
            // Spawn at room edges
            const side = Utils.randInt(0, 3);
            let x, y;
            switch (side) {
                case 0: x = this.room.x + 1; y = Utils.randInt(this.room.y + 1, this.room.y + this.room.h - 2); break;
                case 1: x = this.room.x + this.room.w - 2; y = Utils.randInt(this.room.y + 1, this.room.y + this.room.h - 2); break;
                case 2: x = Utils.randInt(this.room.x + 1, this.room.x + this.room.w - 2); y = this.room.y + 1; break;
                case 3: x = Utils.randInt(this.room.x + 1, this.room.x + this.room.w - 2); y = this.room.y + this.room.h - 2; break;
            }

            const wx = x * TILE_SIZE + TILE_SIZE / 2;
            const wy = y * TILE_SIZE + TILE_SIZE / 2;

            const type = Utils.randChoice(types);
            const enemy = new Enemy(wx, wy, type);

            // Scale
            const scale = 1 + (floor - 1) * 0.12 + this.wave * 0.1;
            enemy.maxHp = Math.floor(enemy.maxHp * scale);
            enemy.hp = enemy.maxHp;
            enemy.baseAttack = Math.floor(enemy.baseAttack * (1 + (floor - 1) * 0.08));
            enemy.xpReward = Math.floor(enemy.xpReward * scale * 1.5); // Bonus XP
            enemy.goldReward = Math.floor(enemy.goldReward * scale * 1.5);
            enemy.challengeWave = this.wave;

            // Later waves have elite chance
            if (this.wave >= 3 && Math.random() < 0.2 * this.wave) {
                EventSystem.makeElite(enemy, floor);
            }

            // Spawn effect
            particles.explosion(wx, wy, '#ff1744', 10);

            game.enemies.push(enemy);
        }
    }

    complete(game) {
        this.completed = true;
        this.active = false;

        this.showText('CHALLENGE COMPLETE!', '#4caf50');
        Utils.addShake(12);
        Utils.addFlash('#4caf50', 0.4);
        Utils.addSlowMo(0.3, 1.0);
        GameAudio.play('levelUp');

        // Rewards based on difficulty
        const rewardMult = { normal: 1, hard: 2, nightmare: 4 };
        const mult = rewardMult[this.difficulty] || 1;

        game.player.gold += Math.floor(50 * mult * game.floor);
        game.player.gainXP(Math.floor(100 * mult));

        game.ui.notify(`+${Math.floor(50 * mult * game.floor)}g, +${Math.floor(100 * mult)} XP`, '#4caf50', 3);

        // Guaranteed gacha pull for hard+
        if (this.difficulty !== 'normal') {
            setTimeout(() => {
                game.gacha.pull(game.floor, (reward) => {
                    if (reward.type === 'weapon') game.weaponPickup = reward.item;
                });
            }, 1500);
        }

        // Potion reward
        game.player.potions += mult;
    }

    showText(text, color) {
        this.displayText = text;
        this.displayTimer = 2;
        this.displayColor = color;
    }

    draw(ctx, w, h) {
        if (!this.active && this.displayTimer <= 0) return;

        // Wave display
        if (this.displayTimer > 0) {
            const alpha = Math.min(this.displayTimer, 1);
            const scale = 1 + (2 - Math.min(this.displayTimer, 2)) * 0.02;

            ctx.save();
            ctx.translate(w / 2, h * 0.25);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = 'bold 32px monospace';
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.displayColor || '#ff1744';
            ctx.fillStyle = this.displayColor || '#ff1744';
            ctx.fillText(this.displayText, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        if (!this.active) return;

        // Challenge HUD (top center)
        const hudY = 100;
        ctx.textAlign = 'center';

        // Background bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(w / 2 - 120, hudY - 5, 240, 35);

        // Wave progress
        ctx.fillStyle = '#ff9800';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`CHALLENGE: Wave ${this.wave}/${this.maxWaves}`, w / 2, hudY + 10);

        // Difficulty
        const diffColors = { normal: '#4caf50', hard: '#ff9800', nightmare: '#ff1744' };
        ctx.fillStyle = diffColors[this.difficulty] || '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`[${this.difficulty.toUpperCase()}]`, w / 2, hudY + 24);
    }
}
