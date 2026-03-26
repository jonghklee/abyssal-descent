// ============================================
// SAVE SYSTEM - Mid-run save/load with localStorage
// ============================================

class SaveSystem {
    constructor() {
        this.saveKey = 'abyssal_descent_save';
        this.autoSaveInterval = 30; // seconds
        this.autoSaveTimer = 0;
        this.hasSave = this.checkSave();
    }

    checkSave() {
        try {
            return !!localStorage.getItem(this.saveKey);
        } catch(e) { return false; }
    }

    save(game) {
        if (!game.player || game.state !== 'playing') return false;

        const data = {
            version: 2,
            timestamp: Date.now(),
            floor: game.floor,
            player: this.serializePlayer(game.player),
            // Don't save dungeon layout - regenerate on load
            // Save seed info instead
            ascensionLevel: game.ascension ? game.ascension.level : 0,
            killStreakBest: game.killStreak ? game.killStreak.bestStreak : 0,
            achievementsUnlocked: game.achievements ? [...game.achievements.unlocked] : [],
            achievementStats: game.achievements ? game.achievements.stats : {},
            curses: game.curseSystem ? game.curseSystem.activeCurses.map(c => c.id) : [],
            blessings: game.curseSystem ? game.curseSystem.activeBlessings.map(b => b.id) : [],
            pets: game.petSystem ? game.petSystem.collection.map(p => ({
                id: p.id, level: p.level, xp: p.xp
            })) : [],
            activePetIndex: game.petSystem ? game.petSystem.collection.indexOf(game.petSystem.activePet) : 0,
            gachaPullCount: game.gacha ? game.gacha.pullCount : 0,
        };

        try {
            localStorage.setItem(this.saveKey, JSON.stringify(data));
            this.hasSave = true;
            return true;
        } catch(e) {
            console.warn('Save failed:', e);
            return false;
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch(e) {
            return null;
        }
    }

    deleteSave() {
        try {
            localStorage.removeItem(this.saveKey);
            this.hasSave = false;
        } catch(e) {}
    }

    serializePlayer(player) {
        return {
            level: player.level,
            xp: player.xp,
            xpToLevel: player.xpToLevel,
            maxHp: player.maxHp,
            hp: player.hp,
            attack: player.attack,
            defense: player.defense,
            speed: player.speed,
            critChance: player.critChance,
            critMultiplier: player.critMultiplier,
            lifesteal: player.lifesteal,
            gold: Math.floor(player.gold),
            potions: player.potions,
            kills: player.kills,
            maxCombo: player.maxCombo,
            keys: player.keys,
            hasRevive: player.hasRevive || false,
            regen: player.regen || 0,
            bleed: player.bleed || 0,
            dashMaxCooldown: player.dashMaxCooldown,
            weapons: player.weapons.map(w => ({
                type: w.type,
                rarity: w.rarity,
                damage: w.damage,
                name: w.name,
                effects: w.effects,
                enchantPrefix: w.enchantPrefix ? w.enchantPrefix.name : null,
                enchantSuffix: w.enchantSuffix ? w.enchantSuffix.name : null,
            })),
            currentWeapon: player.currentWeapon,
            relics: (player.relics || []).map(r => r.id),
        };
    }

    restorePlayer(player, data) {
        player.level = data.level;
        player.xp = data.xp;
        player.xpToLevel = data.xpToLevel;
        player.maxHp = data.maxHp;
        player.hp = data.hp;
        player.attack = data.attack;
        player.defense = data.defense;
        player.speed = data.speed;
        player.critChance = data.critChance;
        player.critMultiplier = data.critMultiplier;
        player.lifesteal = data.lifesteal;
        player.gold = data.gold;
        player.potions = data.potions;
        player.kills = data.kills;
        player.maxCombo = data.maxCombo;
        player.keys = data.keys || 0;
        player.hasRevive = data.hasRevive || false;
        player.regen = data.regen || 0;
        player.bleed = data.bleed || 0;
        player.dashMaxCooldown = data.dashMaxCooldown || 1.0;

        // Restore weapons
        player.weapons = [];
        for (const wd of data.weapons) {
            const weapon = new Weapon(wd.type, wd.rarity);
            weapon.damage = wd.damage;
            weapon.name = wd.name;
            weapon.effects = wd.effects || [];
            if (wd.enchantPrefix) {
                weapon.enchantPrefix = ENCHANT_PREFIXES.find(p => p.name === wd.enchantPrefix) || null;
            }
            if (wd.enchantSuffix) {
                weapon.enchantSuffix = ENCHANT_SUFFIXES.find(s => s.name === wd.enchantSuffix) || null;
            }
            player.weapons.push(weapon);
        }
        player.currentWeapon = Math.min(data.currentWeapon || 0, player.weapons.length - 1);

        // Restore relics
        player.relics = [];
        for (const relicId of (data.relics || [])) {
            const relic = RELIC_POOL.find(r => r.id === relicId);
            if (relic) {
                player.relics.push(relic);
                // Note: relic.apply() was already called during the original run
                // Stats are restored directly, so we don't re-apply
            }
        }
    }

    restoreGame(game, saveData) {
        // Restore floor
        game.floor = saveData.floor;

        // Restore player
        this.restorePlayer(game.player, saveData.player);

        // Restore ascension
        if (game.ascension && saveData.ascensionLevel) {
            game.ascension.level = saveData.ascensionLevel;
        }

        // Restore achievements
        if (game.achievements && saveData.achievementsUnlocked) {
            game.achievements.unlocked = new Set(saveData.achievementsUnlocked);
            if (saveData.achievementStats) {
                Object.assign(game.achievements.stats, saveData.achievementStats);
            }
        }

        // Restore curses & blessings
        if (game.curseSystem) {
            for (const cid of (saveData.curses || [])) {
                const curse = CURSES.find(c => c.id === cid);
                if (curse) game.curseSystem.activeCurses.push(curse);
            }
            for (const bid of (saveData.blessings || [])) {
                const blessing = BLESSINGS.find(b => b.id === bid);
                if (blessing) game.curseSystem.activeBlessings.push(blessing);
            }
        }

        // Restore pets
        if (game.petSystem && saveData.pets) {
            game.petSystem.collection = [];
            for (const pd of saveData.pets) {
                const petDef = PET_DEFS.find(p => p.id === pd.id);
                if (petDef) {
                    const pet = game.petSystem.addPet(petDef);
                    pet.level = pd.level;
                    pet.xp = pd.xp;
                }
            }
            if (saveData.activePetIndex >= 0 && saveData.activePetIndex < game.petSystem.collection.length) {
                game.petSystem.setActive(saveData.activePetIndex);
            }
        }

        // Restore gacha pity
        if (game.gacha && saveData.gachaPullCount) {
            game.gacha.pullCount = saveData.gachaPullCount;
        }

        // Generate new dungeon for this floor
        game.generateFloor();

        // Clear any perk screens from level restore
        while (game.perks && game.perks.active) {
            game.perks.select(0, game.player);
        }
    }

    update(dt, game) {
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer >= this.autoSaveInterval) {
            this.autoSaveTimer = 0;
            if (game.state === 'playing') {
                this.save(game);
            }
        }
    }

    drawSaveIndicator(ctx, w) {
        if (this.autoSaveTimer < 1 && this.autoSaveTimer > 0) {
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(100, 255, 218, 0.5)';
            ctx.font = '9px monospace';
            ctx.fillText('Saving...', w - 20, 150);
        }
    }
}
