// ============================================
// GAMBLING - Slot machine & gambling mini-games
// ============================================

class SlotMachine {
    constructor() {
        this.active = false;
        this.spinning = false;
        this.cost = 20;
        this.reels = [0, 0, 0];
        this.targetReels = [0, 0, 0];
        this.spinTimers = [0, 0, 0];
        this.spinSpeeds = [15, 18, 21]; // Different speeds for visual variety
        this.result = null;
        this.animTimer = 0;

        this.symbols = [
            { icon: '🍒', name: 'Cherry',  weight: 30 },
            { icon: '🍋', name: 'Lemon',   weight: 25 },
            { icon: '🍇', name: 'Grape',   weight: 20 },
            { icon: '🔔', name: 'Bell',    weight: 15 },
            { icon: '💎', name: 'Diamond', weight: 8 },
            { icon: '7️⃣', name: 'Seven',   weight: 2 },
        ];

        // Payouts for 3 matching
        this.payouts = {
            'Cherry':  { gold: 30,  text: '🍒 x3 = 30g' },
            'Lemon':   { gold: 50,  text: '🍋 x3 = 50g' },
            'Grape':   { gold: 80,  text: '🍇 x3 = 80g' },
            'Bell':    { gold: 150, text: '🔔 x3 = 150g!', potion: 1 },
            'Diamond': { gold: 300, text: '💎 x3 = 300g!!', gacha: true },
            'Seven':   { gold: 777, text: '7️⃣ JACKPOT!! 777g!!!', gacha: true, relic: true },
        };

        // Two matching payout
        this.partialPayout = 5;
    }

    open() {
        this.active = true;
        this.spinning = false;
        this.result = null;
        this.animTimer = 0;
    }

    close() {
        this.active = false;
    }

    canSpin(player) {
        return !this.spinning && player.gold >= this.cost;
    }

    spin(player) {
        if (!this.canSpin(player)) return;

        player.gold -= this.cost;
        this.spinning = true;
        this.result = null;
        this.animTimer = 0;

        // Determine results
        for (let i = 0; i < 3; i++) {
            const weights = this.symbols.map(s => s.weight);
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            let idx = 0;
            for (let j = 0; j < weights.length; j++) {
                r -= weights[j];
                if (r <= 0) { idx = j; break; }
            }
            this.targetReels[i] = idx;
            this.spinTimers[i] = 1.0 + i * 0.6; // Staggered stops
        }

        GameAudio.play('coin');
    }

    update(dt, player) {
        if (!this.active) return;
        this.animTimer += dt;

        if (this.spinning) {
            let allStopped = true;
            for (let i = 0; i < 3; i++) {
                if (this.spinTimers[i] > 0) {
                    this.spinTimers[i] -= dt;
                    this.reels[i] = (this.reels[i] + this.spinSpeeds[i] * dt) % this.symbols.length;
                    allStopped = false;

                    if (this.spinTimers[i] <= 0) {
                        this.reels[i] = this.targetReels[i];
                        Utils.addShake(2);
                        GameAudio.play('hit');
                    }
                }
            }

            if (allStopped) {
                this.spinning = false;
                this.evaluateResult(player);
            }
        }
    }

    evaluateResult(player) {
        const s0 = this.symbols[this.targetReels[0]].name;
        const s1 = this.symbols[this.targetReels[1]].name;
        const s2 = this.symbols[this.targetReels[2]].name;

        if (s0 === s1 && s1 === s2) {
            // Triple match!
            const payout = this.payouts[s0];
            player.gold += payout.gold;
            this.result = { text: payout.text, color: '#ffd740', win: true, payout };

            Utils.addShake(payout.gold >= 300 ? 15 : 8);
            Utils.addFlash('#ffd740', payout.gold >= 300 ? 0.5 : 0.3);
            GameAudio.play('levelUp');

            if (payout.gold >= 300) {
                Utils.addSlowMo(0.3, 0.5);
            }
        } else if (s0 === s1 || s1 === s2 || s0 === s2) {
            // Partial match
            player.gold += this.partialPayout;
            this.result = { text: `Pair! +${this.partialPayout}g`, color: '#78909c', win: false };
        } else {
            this.result = { text: 'No match...', color: '#546e7a', win: false };
        }
    }

    draw(ctx, w, h) {
        if (!this.active) return;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // Machine frame
        const frameW = 350;
        const frameH = 320;
        const fx = cx - frameW / 2;
        const fy = cy - frameH / 2 - 20;

        // Frame
        ctx.fillStyle = 'rgba(20,10,30,0.95)';
        ctx.fillRect(fx, fy, frameW, frameH);
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 3;
        ctx.strokeRect(fx, fy, frameW, frameH);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd740';
        ctx.font = 'bold 20px monospace';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd740';
        ctx.fillText('🎰 SLOT MACHINE 🎰', cx, fy + 30);
        ctx.shadowBlur = 0;

        // Reels
        const reelW = 80;
        const reelH = 80;
        const reelGap = 15;
        const reelsStartX = cx - (reelW * 3 + reelGap * 2) / 2;
        const reelsY = fy + 55;

        for (let i = 0; i < 3; i++) {
            const rx = reelsStartX + i * (reelW + reelGap);

            // Reel background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(rx, reelsY, reelW, reelH);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(rx, reelsY, reelW, reelH);

            // Symbol
            const symIdx = Math.floor(this.reels[i]) % this.symbols.length;
            ctx.font = '42px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.symbols[symIdx].icon, rx + reelW / 2, reelsY + reelH / 2 + 14);
        }

        // Line indicator
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(reelsStartX - 10, reelsY + reelH / 2);
        ctx.lineTo(reelsStartX + 3 * reelW + 2 * reelGap + 10, reelsY + reelH / 2);
        ctx.stroke();

        // Result
        if (this.result) {
            ctx.textAlign = 'center';
            ctx.fillStyle = this.result.color;
            ctx.font = 'bold 18px monospace';
            if (this.result.win) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.result.color;
            }
            ctx.fillText(this.result.text, cx, reelsY + reelH + 35);
            ctx.shadowBlur = 0;
        }

        // Spin button
        const btnY = reelsY + reelH + 55;
        const canSpin = !this.spinning;
        ctx.fillStyle = canSpin ? '#ffd740' : '#546e7a';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.spinning ? '⏳ Spinning...' : `[ SPIN - ${this.cost}g ]`, cx, btnY);

        // Gold display
        ctx.fillStyle = '#ffd740';
        ctx.font = '12px monospace';
        ctx.fillText(`Your Gold: ${this.playerGold || 0}g`, cx, btnY + 25);

        // Close hint
        ctx.fillStyle = '#455a64';
        ctx.font = '10px monospace';
        ctx.fillText('[ESC] Close  |  [SPACE] Spin', cx, fy + frameH - 10);

        // Payout table (right side)
        const tableX = cx + frameW / 2 + 20;
        const tableY = fy + 10;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#546e7a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('PAYOUTS:', tableX, tableY);
        let ty = tableY + 18;
        for (const sym of this.symbols) {
            const payout = this.payouts[sym.name];
            ctx.fillStyle = payout.gold >= 300 ? '#ffd740' : '#78909c';
            ctx.font = '10px monospace';
            ctx.fillText(`${sym.icon}x3 = ${payout.gold}g`, tableX, ty);
            ty += 14;
        }
        ctx.fillText(`Pair = ${this.partialPayout}g`, tableX, ty + 5);
    }
}

// ============================================
// WEAPON FORGE - Combine weapons for upgrades
// ============================================

class WeaponForge {
    constructor() {
        this.active = false;
        this.selectedWeapons = [null, null];
        this.result = null;
        this.forging = false;
        this.forgeTimer = 0;
    }

    open(player) {
        if (player.weapons.length < 2) return false;
        this.active = true;
        this.selectedWeapons = [null, null];
        this.result = null;
        this.forging = false;
        return true;
    }

    close() {
        this.active = false;
    }

    selectWeapon(index, weapon) {
        this.selectedWeapons[index] = weapon;
    }

    canForge() {
        return this.selectedWeapons[0] && this.selectedWeapons[1] && !this.forging;
    }

    forge(player) {
        if (!this.canForge()) return null;

        this.forging = true;
        this.forgeTimer = 0;

        const w1 = this.selectedWeapons[0];
        const w2 = this.selectedWeapons[1];

        // Upgrade rarity
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const maxRarIdx = Math.max(rarities.indexOf(w1.rarity), rarities.indexOf(w2.rarity));
        const newRarity = rarities[Math.min(maxRarIdx + 1, rarities.length - 1)];

        // Pick random type from the two
        const type = Math.random() < 0.5 ? w1.type : w2.type;

        // Create new weapon
        const newWeapon = new Weapon(type, newRarity);

        // Inherit enchantments
        if (w1.enchantPrefix) newWeapon.enchantPrefix = w1.enchantPrefix;
        else if (w2.enchantPrefix) newWeapon.enchantPrefix = w2.enchantPrefix;
        if (w1.enchantSuffix) newWeapon.enchantSuffix = w1.enchantSuffix;
        else if (w2.enchantSuffix) newWeapon.enchantSuffix = w2.enchantSuffix;

        // Bonus damage from combining
        newWeapon.damage += Math.floor((w1.damage + w2.damage) * 0.1);

        // Remove old weapons
        player.weapons = player.weapons.filter(w => w !== w1 && w !== w2);
        player.weapons.push(newWeapon);
        player.currentWeapon = player.weapons.length - 1;

        this.result = newWeapon;

        Utils.addShake(10);
        Utils.addFlash(GACHA_RARITIES[newRarity]?.color || '#ffd740', 0.4);
        GameAudio.play('levelUp');

        return newWeapon;
    }

    update(dt) {
        if (this.forging) {
            this.forgeTimer += dt;
        }
    }

    draw(ctx, w, h, player) {
        if (!this.active) return;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#ff6d00';
        ctx.font = 'bold 24px monospace';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff6d00';
        ctx.fillText('⚒ WEAPON FORGE ⚒', cx, h * 0.12);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#78909c';
        ctx.font = '12px monospace';
        ctx.fillText('Combine 2 weapons → Higher rarity weapon!', cx, h * 0.17);

        if (this.result) {
            // Show result
            const rColor = this.result.getRarityColor();
            ctx.fillStyle = rColor;
            ctx.font = 'bold 18px monospace';
            ctx.shadowBlur = 10;
            ctx.shadowColor = rColor;
            ctx.fillText(this.result.getDisplayName(), cx, h * 0.45);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '14px monospace';
            ctx.fillText(`DMG: ${this.result.damage} | Type: ${this.result.weaponType}`, cx, h * 0.50);

            ctx.fillStyle = '#4caf50';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('Forging Complete!', cx, h * 0.58);

            ctx.fillStyle = '#546e7a';
            ctx.font = '12px monospace';
            ctx.fillText('[SPACE] Accept', cx, h * 0.65);
            return;
        }

        // Weapon selection
        const slotY = h * 0.3;
        const slotW = 160;
        const slotH = 120;

        for (let slot = 0; slot < 2; slot++) {
            const sx = cx + (slot === 0 ? -slotW - 30 : 30);
            const weapon = this.selectedWeapons[slot];

            ctx.fillStyle = 'rgba(20,20,35,0.9)';
            ctx.fillRect(sx, slotY, slotW, slotH);
            ctx.strokeStyle = weapon ? weapon.getRarityColor() : '#333';
            ctx.lineWidth = weapon ? 2 : 1;
            ctx.strokeRect(sx, slotY, slotW, slotH);

            if (weapon) {
                ctx.fillStyle = weapon.getRarityColor();
                ctx.font = 'bold 11px monospace';
                ctx.fillText(weapon.getDisplayName(), sx + slotW / 2, slotY + 40);
                ctx.fillStyle = '#b0bec5';
                ctx.font = '10px monospace';
                ctx.fillText(`DMG: ${weapon.damage}`, sx + slotW / 2, slotY + 60);
                ctx.fillText(`[${weapon.rarity}]`, sx + slotW / 2, slotY + 75);
            } else {
                ctx.fillStyle = '#455a64';
                ctx.font = '11px monospace';
                ctx.fillText(`Slot ${slot + 1}`, sx + slotW / 2, slotY + 50);
                ctx.fillText('(empty)', sx + slotW / 2, slotY + 65);
            }
        }

        // Plus sign
        ctx.fillStyle = '#ff6d00';
        ctx.font = 'bold 30px monospace';
        ctx.fillText('+', cx, slotY + slotH / 2 + 10);

        // Arrow and forge button
        ctx.fillStyle = '#ff6d00';
        ctx.font = '24px monospace';
        ctx.fillText('⬇', cx, slotY + slotH + 25);

        if (this.canForge()) {
            ctx.fillStyle = '#ff6d00';
            ctx.font = 'bold 16px monospace';
            ctx.fillText('[ SPACE to FORGE! ]', cx, slotY + slotH + 55);
        }

        // Available weapons list
        const listY = slotY + slotH + 75;
        ctx.fillStyle = '#78909c';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('Your Weapons (press number to select):', cx, listY);

        for (let i = 0; i < player.weapons.length; i++) {
            const wp = player.weapons[i];
            const isSelected = this.selectedWeapons.includes(wp);
            ctx.fillStyle = isSelected ? '#455a64' : wp.getRarityColor();
            ctx.font = '11px monospace';
            ctx.fillText(
                `[${i + 1}] ${wp.getDisplayName()} (DMG:${wp.damage})${isSelected ? ' ✓' : ''}`,
                cx, listY + 18 + i * 16
            );
        }

        // Close
        ctx.fillStyle = '#455a64';
        ctx.font = '10px monospace';
        ctx.fillText('[ESC] Close', cx, h * 0.92);
    }
}
