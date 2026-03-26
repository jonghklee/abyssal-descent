// ============================================
// AUDIO - Web Audio API sound effects
// ============================================

const GameAudio = {
    ctx: null,
    initialized: false,
    masterVolume: 0.3,

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio not supported');
        }
    },

    play(sound) {
        if (!this.initialized || !this.ctx) return;

        try {
            switch (sound) {
                case 'attack': this.playAttack(); break;
                case 'hit': this.playHit(); break;
                case 'playerHit': this.playPlayerHit(); break;
                case 'enemyDeath': this.playEnemyDeath(); break;
                case 'bossDeath': this.playBossDeath(); break;
                case 'dash': this.playDash(); break;
                case 'coin': this.playCoin(); break;
                case 'xp': this.playXP(); break;
                case 'pickup': this.playPickup(); break;
                case 'heal': this.playHeal(); break;
                case 'levelUp': this.playLevelUp(); break;
                case 'stairs': this.playStairs(); break;
                case 'chest': this.playChest(); break;
                case 'trap': this.playTrap(); break;
            }
        } catch (e) {
            // Silently fail audio
        }
    },

    createOsc(type, freq, duration, volume = this.masterVolume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
        return { osc, gain };
    },

    createNoise(duration, volume = this.masterVolume * 0.5) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
        return { source, gain };
    },

    playAttack() {
        this.createOsc('sawtooth', 200, 0.08, 0.1);
        this.createNoise(0.06, 0.08);
    },

    playHit() {
        this.createOsc('square', 300, 0.05, 0.1);
        this.createOsc('sawtooth', 150, 0.08, 0.08);
        this.createNoise(0.04, 0.1);
    },

    playPlayerHit() {
        this.createOsc('square', 100, 0.15, 0.15);
        this.createOsc('sawtooth', 80, 0.2, 0.1);
    },

    playEnemyDeath() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        // Pitch increases with kill streak for satisfying rapid kills
        const streakBonus = (typeof game !== 'undefined' && game.killStreak) ?
            Math.min(game.killStreak.streak * 30, 400) : 0;
        osc.frequency.setValueAtTime(400 + streakBonus, t);
        osc.frequency.exponentialRampToValueAtTime(50 + streakBonus * 0.3, t + 0.3);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
        this.createNoise(0.15, 0.1);
    },

    playBossDeath() {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.createOsc('sawtooth', 200 - i * 30, 0.2, 0.15);
                this.createNoise(0.1, 0.1);
            }, i * 100);
        }
    },

    playDash() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    },

    playCoin() {
        this.createOsc('sine', 800 + Math.random() * 400, 0.08, 0.08);
        this.createOsc('sine', 1200 + Math.random() * 200, 0.06, 0.05);
    },

    playXP() {
        this.createOsc('sine', 600, 0.05, 0.05);
        this.createOsc('sine', 900, 0.05, 0.04);
    },

    playPickup() {
        this.createOsc('sine', 500, 0.1, 0.1);
        setTimeout(() => this.createOsc('sine', 700, 0.08, 0.08), 50);
    },

    playHeal() {
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            setTimeout(() => this.createOsc('sine', freq, 0.15, 0.1), i * 80);
        });
    },

    playLevelUp() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.createOsc('sine', freq, 0.2, 0.12), i * 100);
        });
    },

    playStairs() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    },

    playChest() {
        this.createOsc('sine', 400, 0.1, 0.1);
        setTimeout(() => this.createOsc('sine', 600, 0.15, 0.12), 80);
        setTimeout(() => this.createOsc('sine', 800, 0.2, 0.1), 160);
    },

    playTrap() {
        this.createNoise(0.2, 0.15);
        this.createOsc('sawtooth', 100, 0.15, 0.12);
    },

    // ---- Ambient Music System ----
    ambience: null,
    ambienceGain: null,
    ambiencePlaying: false,

    startAmbience() {
        if (!this.initialized || this.ambiencePlaying) return;
        this.ambiencePlaying = true;

        this.ambienceGain = this.ctx.createGain();
        this.ambienceGain.gain.value = 0.04;
        this.ambienceGain.connect(this.ctx.destination);

        // Low drone
        this.playDrone(55, 'sine', 0.03);
        this.playDrone(82.5, 'sine', 0.015);

        // Periodic eerie notes
        this.ambienceLoop();
    },

    playDrone(freq, type, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        // Store for cleanup if needed
        return osc;
    },

    ambienceLoop() {
        if (!this.ambiencePlaying) return;

        // Biome-aware note selection
        let notes = [110, 130.81, 146.83, 164.81, 196, 220, 246.94]; // Default: crypt (minor)
        let waveType = 'sine';
        if (typeof game !== 'undefined' && game.biomeSystem && game.biomeSystem.current) {
            const biome = game.biomeSystem.current.id;
            switch (biome) {
                case 'inferno':
                    notes = [82.41, 98, 110, 130.81, 146.83, 164.81]; // Low, ominous
                    waveType = 'triangle';
                    break;
                case 'void':
                    notes = [196, 233.08, 261.63, 293.66, 349.23, 392]; // High, ethereal
                    waveType = 'sine';
                    break;
                case 'abyss':
                    notes = [55, 65.41, 73.42, 82.41, 98, 110]; // Very low, dread
                    waveType = 'sawtooth';
                    break;
                case 'heaven':
                    notes = [261.63, 329.63, 392, 440, 523.25, 659.25]; // Bright, major
                    waveType = 'sine';
                    break;
            }
        }
        const note = notes[Math.floor(Math.random() * notes.length)];
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = waveType;
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.02, t + 1);
        gain.gain.linearRampToValueAtTime(0, t + 3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 3);

        // Schedule next note — faster during boss fights
        const inBossRoom = typeof game !== 'undefined' && game.lastRoom && game.lastRoom.type === 'boss';
        const interval = inBossRoom ? Utils.rand(500, 1500) : Utils.rand(2000, 5000);
        setTimeout(() => this.ambienceLoop(), interval);
    },

    stopAmbience() {
        this.ambiencePlaying = false;
    },
};
