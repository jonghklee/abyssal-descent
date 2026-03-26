// ============================================
// TUTORIAL - First-run guidance system
// ============================================

class Tutorial {
    constructor() {
        this.active = false;
        this.step = 0;
        this.timer = 0;
        this.completed = this.checkCompleted();

        this.steps = [
            { trigger: 'start',     msg: 'WASD to move around the dungeon',     icon: '🎮', duration: 5 },
            { trigger: 'move',      msg: 'Click to attack enemies with your weapon', icon: '⚔', duration: 5 },
            { trigger: 'firstKill', msg: 'Great! Collect XP orbs and gold drops',   icon: '✨', duration: 4 },
            { trigger: 'levelUp',   msg: 'Level up! Choose a perk to get stronger', icon: '⬆', duration: 4 },
            { trigger: 'perkDone',  msg: 'Press SPACE while moving to dash (invincible!)', icon: '💨', duration: 5 },
            { trigger: 'dash',      msg: 'Press Q to drink a potion when low HP',   icon: '🧪', duration: 4 },
            { trigger: 'explored',  msg: 'Find the stairs ⬇ to go deeper!',        icon: '⬇', duration: 5 },
            { trigger: 'floor2',    msg: 'Press T for slots, R for forge. Good luck!', icon: '🎰', duration: 5 },
        ];
    }

    checkCompleted() {
        try {
            return localStorage.getItem('abyssal_tutorial_done') === 'true';
        } catch(e) { return false; }
    }

    start() {
        if (this.completed) return;
        this.active = true;
        this.step = 0;
        this.timer = 0;
    }

    complete() {
        this.active = false;
        this.completed = true;
        try { localStorage.setItem('abyssal_tutorial_done', 'true'); } catch(e) {}
    }

    trigger(eventName) {
        if (!this.active || this.step >= this.steps.length) return;
        if (this.steps[this.step].trigger === eventName) {
            this.step++;
            this.timer = 0;
            if (this.step >= this.steps.length) {
                this.complete();
            }
        }
    }

    update(dt) {
        if (!this.active || this.step >= this.steps.length) return;
        this.timer += dt;

        const currentStep = this.steps[this.step];
        if (this.timer > currentStep.duration) {
            // Auto-advance if player hasn't triggered
            this.step++;
            this.timer = 0;
            if (this.step >= this.steps.length) {
                this.complete();
            }
        }
    }

    draw(ctx, w, h) {
        if (!this.active || this.step >= this.steps.length) return;

        const step = this.steps[this.step];
        const alpha = Math.min(this.timer / 0.5, 1) * Math.min((step.duration - this.timer) / 0.5, 1);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Tutorial bar at bottom-center (above weapon info)
        const barW = 380;
        const barH = 40;
        const barX = (w - barW) / 2;
        const barY = h - 120;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = '#64ffda';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Icon
        ctx.font = '18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(step.icon, barX + 10, barY + 28);

        // Message
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px monospace';
        ctx.fillText(step.msg, barX + 38, barY + 25);

        // "TUTORIAL" label
        ctx.fillStyle = '#64ffda';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('TUTORIAL', barX + 5, barY + 10);

        // Step indicator
        ctx.fillStyle = '#455a64';
        ctx.textAlign = 'right';
        ctx.font = '8px monospace';
        ctx.fillText(`${this.step + 1}/${this.steps.length}`, barX + barW - 5, barY + 10);

        ctx.restore();
    }
}
