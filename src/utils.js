// ============================================
// UTILS - Core utility functions
// ============================================

const Utils = {
    rand(min, max) {
        return Math.random() * (max - min) + min;
    },

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    weightedChoice(items, weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r <= 0) return items[i];
        }
        return items[items.length - 1];
    },

    dist(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    easeOutQuad(t) {
        return t * (2 - t);
    },

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },

    // Color utilities
    hsl(h, s, l, a = 1) {
        return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    },

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    },

    // Screen shake
    shake: { x: 0, y: 0, intensity: 0, decay: 0.9 },

    addShake(intensity) {
        this.shake.intensity = Math.min(this.shake.intensity + intensity, 20);
    },

    updateShake() {
        if (this.shake.intensity > 0.1) {
            this.shake.x = Utils.rand(-1, 1) * this.shake.intensity;
            this.shake.y = Utils.rand(-1, 1) * this.shake.intensity;
            this.shake.intensity *= this.shake.decay;
        } else {
            this.shake.x = 0;
            this.shake.y = 0;
            this.shake.intensity = 0;
        }
    },

    // Hitstop / freeze frame
    freezeFrames: 0,
    addFreeze(frames) {
        this.freezeFrames = Math.max(this.freezeFrames, frames);
    },

    // Slow motion
    slowMo: 1,
    slowMoTimer: 0,
    addSlowMo(factor, duration) {
        this.slowMo = factor;
        this.slowMoTimer = duration;
    },
    updateSlowMo(dt) {
        if (this.slowMoTimer > 0) {
            this.slowMoTimer -= dt;
            if (this.slowMoTimer <= 0) {
                this.slowMo = 1;
            }
        }
    },

    // Flash effect
    flashAlpha: 0,
    flashColor: '#fff',
    addFlash(color = '#fff', alpha = 0.3) {
        this.flashColor = color;
        this.flashAlpha = alpha;
    },
    updateFlash() {
        if (this.flashAlpha > 0) {
            this.flashAlpha *= 0.85;
            if (this.flashAlpha < 0.01) this.flashAlpha = 0;
        }
    }
};

// Simple AABB collision
function rectCollide(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

function circleCollide(x1, y1, r1, x2, y2, r2) {
    return Utils.dist(x1, y1, x2, y2) < r1 + r2;
}
