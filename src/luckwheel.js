// ============================================
// LUCK WHEEL - Spin-to-win between floors
// ============================================

class LuckWheel {
    constructor() {
        this.active = false;
        this.spinning = false;
        this.angle = 0;
        this.spinSpeed = 0;
        this.result = null;
        this.timer = 0;

        this.segments = [
            { label: '+50 Gold',      color: '#ffd740', weight: 25, reward: { type: 'gold', amount: 50 } },
            { label: '+2 Potions',    color: '#66bb6a', weight: 15, reward: { type: 'potion', amount: 2 } },
            { label: 'Gacha Pull!',   color: '#7c4dff', weight: 10, reward: { type: 'gacha' } },
            { label: '+100 Gold',     color: '#ff9800', weight: 12, reward: { type: 'gold', amount: 100 } },
            { label: 'Free Pet!',     color: '#e91e63', weight: 5,  reward: { type: 'pet' } },
            { label: '+5 ATK',        color: '#f44336', weight: 8,  reward: { type: 'stat', stat: 'attack', val: 5 } },
            { label: '+20 Max HP',    color: '#4caf50', weight: 10, reward: { type: 'stat', stat: 'maxHp', val: 20 } },
            { label: 'JACKPOT 500g!', color: '#ff1744', weight: 3,  reward: { type: 'gold', amount: 500 } },
            { label: '+10% Crit',     color: '#ffeb3b', weight: 7,  reward: { type: 'stat', stat: 'critChance', val: 0.1 } },
            { label: 'Curse!',        color: '#37474f', weight: 5,  reward: { type: 'curse' } },
        ];
    }

    open() {
        this.active = true;
        this.spinning = false;
        this.result = null;
        this.angle = Math.random() * Math.PI * 2;
        this.timer = 0;
    }

    spin() {
        if (this.spinning || this.result) return;
        this.spinning = true;
        this.spinSpeed = Utils.rand(15, 25);
        this.timer = 0;

        // Determine result
        const totalWeight = this.segments.reduce((a, s) => a + s.weight, 0);
        let r = Math.random() * totalWeight;
        for (let i = 0; i < this.segments.length; i++) {
            r -= this.segments[i].weight;
            if (r <= 0) {
                // Target angle to land on this segment
                const segAngle = (i / this.segments.length) * Math.PI * 2;
                this.targetAngle = segAngle + Math.PI * 2 * Utils.randInt(3, 5); // Multiple full spins
                this.resultIndex = i;
                break;
            }
        }
        GameAudio.play('coin');
    }

    update(dt) {
        if (!this.active) return;
        this.timer += dt;

        if (this.spinning) {
            // Easing spin
            const progress = Math.min(this.timer / 3.5, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            this.angle = eased * this.targetAngle;
            this.spinSpeed *= 0.995;

            if (progress >= 1) {
                this.spinning = false;
                this.result = this.segments[this.resultIndex];
                Utils.addShake(this.result.reward.type === 'curse' ? 3 : 8);
                if (this.result.reward.amount >= 500 || this.result.reward.type === 'pet') {
                    Utils.addFlash(this.result.color, 0.4);
                }
                GameAudio.play(this.result.reward.type === 'curse' ? 'trap' : 'levelUp');
            }
        }
    }

    applyReward(player, gameRef) {
        if (!this.result) return;
        const r = this.result.reward;

        switch (r.type) {
            case 'gold':
                player.gold += r.amount;
                break;
            case 'potion':
                player.potions += r.amount;
                break;
            case 'stat':
                player[r.stat] += r.val;
                if (r.stat === 'maxHp') player.hp += r.val;
                break;
            case 'gacha':
                if (gameRef.gacha) {
                    setTimeout(() => {
                        gameRef.gacha.pull(gameRef.floor, (reward) => {
                            if (reward.type === 'weapon') gameRef.weaponPickup = reward.item;
                        });
                    }, 500);
                }
                break;
            case 'pet':
                if (gameRef.petSystem) {
                    const rarities = ['uncommon', 'rare', 'epic'];
                    const petDef = gameRef.petSystem.getRandomPet(Utils.randChoice(rarities));
                    const pet = gameRef.petSystem.addPet(petDef);
                    gameRef.ui.notify(`🐾 New Pet: ${pet.name}!`, pet.getRarityColor(), 3);
                }
                break;
            case 'curse':
                if (gameRef.curseSystem) {
                    const curse = Utils.randChoice(CURSES.filter(c =>
                        !gameRef.curseSystem.activeCurses.find(ac => ac.id === c.id)));
                    if (curse) {
                        curse.apply(player);
                        gameRef.curseSystem.activeCurses.push(curse);
                        gameRef.ui.notify(`Cursed: ${curse.name}!`, '#f44336', 3);
                    }
                }
                break;
        }

        this.active = false;
    }

    draw(ctx, w, h) {
        if (!this.active) return;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2 - 20;
        const radius = Math.min(w, h) * 0.22;

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd740';
        ctx.font = 'bold 24px monospace';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd740';
        ctx.fillText('🎡 LUCKY WHEEL 🎡', cx, cy - radius - 30);
        ctx.shadowBlur = 0;

        // Draw wheel
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-this.angle);

        const segCount = this.segments.length;
        const segAngle = (Math.PI * 2) / segCount;

        for (let i = 0; i < segCount; i++) {
            const seg = this.segments[i];
            const startA = i * segAngle;
            const endA = startA + segAngle;

            ctx.fillStyle = seg.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startA, endA);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Label
            ctx.save();
            ctx.rotate(startA + segAngle / 2);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(seg.label, radius * 0.6, 3);
            ctx.restore();
        }
        ctx.restore();

        // Pointer (top)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 8);
        ctx.lineTo(cx - 10, cy - radius - 22);
        ctx.lineTo(cx + 10, cy - radius - 22);
        ctx.closePath();
        ctx.fill();

        // Center circle
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Result or spin button
        if (this.result) {
            ctx.fillStyle = this.result.color;
            ctx.font = 'bold 20px monospace';
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.result.color;
            ctx.fillText(this.result.label, cx, cy + radius + 50);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#78909c';
            ctx.font = '14px monospace';
            ctx.fillText('[ SPACE to Claim ]', cx, cy + radius + 80);
        } else if (!this.spinning) {
            ctx.fillStyle = '#ffd740';
            ctx.font = 'bold 16px monospace';
            ctx.fillText('[ SPACE to Spin! ]', cx, cy + radius + 50);
        } else {
            ctx.fillStyle = '#78909c';
            ctx.font = '14px monospace';
            ctx.fillText('Spinning...', cx, cy + radius + 50);
        }
    }
}
