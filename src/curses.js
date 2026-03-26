// ============================================
// CURSES & BLESSINGS - Risk/reward modifier system
// ============================================

const BLESSINGS = [
    { id: 'swift_feet',   name: 'Swift Feet',       desc: '+40 Speed',              icon: '🏃', color: '#64ffda', apply: (p) => { p.speed += 40; } },
    { id: 'iron_skin',    name: 'Iron Skin',        desc: '+8 Defense',             icon: '🛡', color: '#78909c', apply: (p) => { p.defense += 8; } },
    { id: 'bloodlust',    name: 'Bloodlust',        desc: '+12 Attack',             icon: '🗡', color: '#ff5252', apply: (p) => { p.attack += 12; } },
    { id: 'fortune',      name: 'Fortune',          desc: '2x Gold drops',          icon: '💰', color: '#ffd740', apply: (p) => { p.goldMultiplier = (p.goldMultiplier || 1) * 2; } },
    { id: 'critical_eye', name: 'Critical Eye',     desc: '+20% Crit, +50% CritDMG', icon: '👁', color: '#ffeb3b', apply: (p) => { p.critChance += 0.2; p.critMultiplier += 0.5; } },
    { id: 'regeneration', name: 'Regeneration',     desc: 'Heal 1 HP/sec',         icon: '💚', color: '#4caf50', apply: (p) => { p.regen = (p.regen || 0) + 1; } },
    { id: 'dash_master',  name: 'Dash Master',      desc: 'Dash CD -60%',          icon: '⚡', color: '#00e5ff', apply: (p) => { p.dashMaxCooldown *= 0.4; } },
    { id: 'giant',        name: 'Giant\'s Might',    desc: '+80 HP, +10 ATK',       icon: '🏔', color: '#8d6e63', apply: (p) => { p.maxHp += 80; p.hp += 80; p.attack += 10; } },
];

const CURSES = [
    { id: 'fragile',     name: 'Fragile',       desc: '-30 Max HP',              icon: '💔', color: '#f44336', apply: (p) => { p.maxHp = Math.max(20, p.maxHp - 30); p.hp = Math.min(p.hp, p.maxHp); } },
    { id: 'slow',        name: 'Sluggish',      desc: '-30 Speed',               icon: '🐌', color: '#795548', apply: (p) => { p.speed = Math.max(60, p.speed - 30); } },
    { id: 'weak',        name: 'Weakness',       desc: '-5 Attack',               icon: '💤', color: '#9e9e9e', apply: (p) => { p.attack = Math.max(1, p.attack - 5); } },
    { id: 'blind',       name: 'Blind',          desc: 'Reduced vision',          icon: '🌑', color: '#37474f', apply: (p) => { p.visionReduced = true; } },
    { id: 'bleed',       name: 'Bleeding',       desc: 'Lose 1 HP/3sec',         icon: '🩸', color: '#d32f2f', apply: (p) => { p.bleed = (p.bleed || 0) + 1; } },
    { id: 'clumsy',      name: 'Clumsy',         desc: 'Dash CD +50%',           icon: '🤕', color: '#ff8f00', apply: (p) => { p.dashMaxCooldown *= 1.5; } },
    { id: 'glass',       name: 'Glass Body',     desc: '-5 Defense',             icon: '🔮', color: '#e1bee7', apply: (p) => { p.defense = Math.max(0, p.defense - 5); } },
    { id: 'greed',       name: 'Greed',          desc: 'Lose 50% gold on hit',   icon: '💸', color: '#ffd740', apply: (p) => { p.goldLossOnHit = true; } },
];

class CurseSystem {
    constructor() {
        this.activeBlessings = [];
        this.activeCurses = [];
        this.offerActive = false;
        this.offerBlessing = null;
        this.offerCurse = null;
        this.animTimer = 0;
        this.regenTimer = 0;
        this.bleedTimer = 0;
    }

    // Called at certain events (floor clear, boss kill, shrine)
    offerDeal() {
        const blessing = Utils.randChoice(BLESSINGS.filter(b =>
            !this.activeBlessings.find(ab => ab.id === b.id)
        ));
        const curse = Utils.randChoice(CURSES.filter(c =>
            !this.activeCurses.find(ac => ac.id === c.id)
        ));

        if (!blessing || !curse) return false;

        this.offerBlessing = blessing;
        this.offerCurse = curse;
        this.offerActive = true;
        this.animTimer = 0;
        return true;
    }

    acceptDeal(player) {
        if (!this.offerActive) return;
        this.offerBlessing.apply(player);
        this.offerCurse.apply(player);
        this.activeBlessings.push(this.offerBlessing);
        this.activeCurses.push(this.offerCurse);
        this.offerActive = false;

        Utils.addShake(8);
        Utils.addFlash('#7c4dff', 0.3);
        GameAudio.play('levelUp');
    }

    declineDeal() {
        this.offerActive = false;
    }

    update(dt, player) {
        if (this.offerActive) this.animTimer += dt;

        // Regen blessing
        if (player.regen && player.regen > 0) {
            this.regenTimer += dt;
            if (this.regenTimer >= 1) {
                this.regenTimer = 0;
                player.hp = Math.min(player.hp + player.regen, player.maxHp);
            }
        }

        // Bleed curse
        if (player.bleed && player.bleed > 0) {
            this.bleedTimer += dt;
            if (this.bleedTimer >= 3) {
                this.bleedTimer = 0;
                player.hp = Math.max(1, player.hp - player.bleed);
                particles.bloodSplatter(player.x, player.y, Math.random() * Math.PI * 2, 3);
            }
        }
    }

    draw(ctx, w, h) {
        if (!this.offerActive) return;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const t = Math.min(this.animTimer / 0.5, 1);
        const eased = Utils.easeOutElastic(t);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7c4dff';
        ctx.font = 'bold 28px monospace';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#7c4dff';
        ctx.fillText('DEVIL\'S BARGAIN', cx, h * 0.13);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#78909c';
        ctx.font = '12px monospace';
        ctx.fillText('Accept both the blessing AND the curse?', cx, h * 0.19);

        // Blessing card (left)
        const cardW = 220;
        const cardH = 180;
        const gap = 60;

        this.drawCard(ctx, cx - cardW - gap / 2, h * 0.25, cardW, cardH,
            this.offerBlessing, 'BLESSING', '#4caf50', eased);

        // VS
        ctx.fillStyle = '#78909c';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('&', cx, h * 0.25 + cardH / 2 + 10);

        // Curse card (right)
        this.drawCard(ctx, cx + gap / 2, h * 0.25, cardW, cardH,
            this.offerCurse, 'CURSE', '#f44336', eased);

        // Buttons
        const btnY = h * 0.75;
        ctx.font = 'bold 16px monospace';

        ctx.fillStyle = '#4caf50';
        ctx.fillText('[ 1 ] ACCEPT BOTH', cx - 120, btnY);

        ctx.fillStyle = '#f44336';
        ctx.fillText('[ 2 ] DECLINE', cx + 120, btnY);

        // Active modifiers display
        if (this.activeBlessings.length > 0 || this.activeCurses.length > 0) {
            ctx.fillStyle = '#455a64';
            ctx.font = '9px monospace';
            const mods = [
                ...this.activeBlessings.map(b => `${b.icon}${b.name}`),
                ...this.activeCurses.map(c => `${c.icon}${c.name}`),
            ];
            ctx.fillText(`Active: ${mods.join(' | ')}`, cx, h * 0.88);
        }
    }

    drawCard(ctx, x, y, w, h, item, label, borderColor, scale) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(x + w / 2), -(y + h / 2));

        ctx.fillStyle = 'rgba(15,15,25,0.95)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = borderColor;
        ctx.fillRect(x, y, w, 3);

        ctx.textAlign = 'center';

        // Label
        ctx.fillStyle = borderColor;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(label, x + w / 2, y + 20);

        // Icon
        ctx.font = '36px monospace';
        ctx.fillText(item.icon, x + w / 2, y + 65);

        // Name
        ctx.fillStyle = item.color;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(item.name, x + w / 2, y + 95);

        // Description
        ctx.fillStyle = '#b0bec5';
        ctx.font = '11px monospace';
        ctx.fillText(item.desc, x + w / 2, y + 120);

        ctx.restore();
    }

    drawHUD(ctx, x, y) {
        if (this.activeBlessings.length === 0 && this.activeCurses.length === 0) return;

        ctx.textAlign = 'left';
        let ox = x;

        for (const b of this.activeBlessings) {
            ctx.fillStyle = '#4caf50';
            ctx.font = '12px monospace';
            ctx.fillText(b.icon, ox, y);
            ox += 16;
        }
        for (const c of this.activeCurses) {
            ctx.fillStyle = '#f44336';
            ctx.font = '12px monospace';
            ctx.fillText(c.icon, ox, y);
            ox += 16;
        }
    }
}
