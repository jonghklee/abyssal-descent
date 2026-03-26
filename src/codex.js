// ============================================
// CODEX - Collection tracking & unlockable lore
// ============================================

class Codex {
    constructor() {
        this.data = this.load();
        this.showScreen = false;
        this.tab = 0; // 0=enemies, 1=weapons, 2=pets, 3=relics
        this.tabs = ['Enemies', 'Weapons', 'Pets', 'Relics'];
    }

    load() {
        try {
            const saved = localStorage.getItem('abyssal_codex');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return {
            enemies: {},   // { skeleton: { seen: true, killed: 5, maxDmg: 34 } }
            weapons: {},   // { 'sword_epic': true }
            pets: {},      // { wisp: true }
            relics: {},    // { vampFang: true }
            bosses: {},    // { boss_demon: { killed: 2, bestTime: 12.5 } }
        };
    }

    save() {
        try { localStorage.setItem('abyssal_codex', JSON.stringify(this.data)); } catch(e) {}
    }

    // Track enemy encounters
    trackEnemy(enemy) {
        const id = enemy.type;
        if (!this.data.enemies[id]) {
            this.data.enemies[id] = { seen: true, killed: 0, maxDmg: 0, name: enemy.name };
        }
    }

    trackEnemyKill(enemy, dmg) {
        const id = enemy.type;
        this.trackEnemy(enemy);
        this.data.enemies[id].killed++;
        this.data.enemies[id].maxDmg = Math.max(this.data.enemies[id].maxDmg, dmg || 0);
        if (enemy.isBoss) {
            if (!this.data.bosses[id]) this.data.bosses[id] = { killed: 0 };
            this.data.bosses[id].killed++;
        }
        this.save();
    }

    trackWeapon(weapon) {
        const key = `${weapon.type}_${weapon.rarity}`;
        this.data.weapons[key] = {
            name: weapon.getDisplayName(),
            type: weapon.type,
            rarity: weapon.rarity,
            dmg: weapon.damage,
        };
        this.save();
    }

    trackPet(pet) {
        this.data.pets[pet.id] = { name: pet.name, rarity: pet.rarity, icon: pet.icon };
        this.save();
    }

    trackRelic(relic) {
        this.data.relics[relic.id] = { name: relic.name, icon: relic.icon, desc: relic.desc };
        this.save();
    }

    getCompletionPercent() {
        const totalEnemies = Object.keys(ENEMY_TYPES).length;
        const totalWeapons = Object.keys(WEAPON_TYPES).length * 5; // 5 rarities
        const totalPets = PET_DEFS.length;
        const totalRelics = RELIC_POOL.length;
        const total = totalEnemies + totalWeapons + totalPets + totalRelics;

        const found = Object.keys(this.data.enemies).length +
                      Object.keys(this.data.weapons).length +
                      Object.keys(this.data.pets).length +
                      Object.keys(this.data.relics).length;

        return Math.min(100, Math.round(found / total * 100));
    }

    draw(ctx, w, h) {
        if (!this.showScreen) return;

        ctx.fillStyle = 'rgba(5,5,10,0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#64ffda';
        ctx.font = 'bold 24px monospace';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#64ffda';
        ctx.fillText('CODEX', w / 2, 50);
        ctx.shadowBlur = 0;

        // Completion
        ctx.fillStyle = '#78909c';
        ctx.font = '12px monospace';
        ctx.fillText(`Collection: ${this.getCompletionPercent()}%`, w / 2, 72);

        // Tabs
        const tabW = 100;
        const tabStartX = w / 2 - (this.tabs.length * tabW) / 2;
        for (let i = 0; i < this.tabs.length; i++) {
            const tx = tabStartX + i * tabW;
            const isActive = this.tab === i;
            ctx.fillStyle = isActive ? 'rgba(100,255,218,0.15)' : 'rgba(255,255,255,0.03)';
            ctx.fillRect(tx, 85, tabW - 5, 25);
            ctx.fillStyle = isActive ? '#64ffda' : '#546e7a';
            ctx.font = isActive ? 'bold 11px monospace' : '11px monospace';
            ctx.fillText(this.tabs[i], tx + tabW / 2, 102);
        }

        // Content area
        const contentY = 125;
        const entries = this.getTabEntries();
        const cols = 3;
        const cellW = Math.min(220, (w - 80) / cols);
        const cellH = 55;
        const gridW = cols * cellW;
        const startX = (w - gridW) / 2;

        for (let i = 0; i < entries.length && i < 24; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * cellW;
            const y = contentY + row * cellH;
            const entry = entries[i];

            ctx.fillStyle = entry.found ? 'rgba(30,30,50,0.8)' : 'rgba(15,15,25,0.5)';
            ctx.fillRect(x, y, cellW - 5, cellH - 5);

            if (entry.found) {
                ctx.strokeStyle = entry.color || '#333';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellW - 5, cellH - 5);

                ctx.fillStyle = entry.color || '#e0e0e0';
                ctx.font = '14px monospace';
                ctx.textAlign = 'left';
                if (entry.icon) ctx.fillText(entry.icon, x + 8, y + 22);

                ctx.fillStyle = '#e0e0e0';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(entry.name, x + (entry.icon ? 28 : 8), y + 20);

                ctx.fillStyle = '#78909c';
                ctx.font = '9px monospace';
                ctx.fillText(entry.detail, x + 8, y + 38);
            } else {
                ctx.fillStyle = '#263238';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('???', x + (cellW - 5) / 2, y + 30);
            }
            ctx.textAlign = 'center';
        }

        // Controls
        ctx.fillStyle = '#455a64';
        ctx.font = '10px monospace';
        ctx.fillText('[1-4] Switch Tab  |  [ESC] Close', w / 2, h - 20);
    }

    getTabEntries() {
        switch (this.tab) {
            case 0: return this.getEnemyEntries();
            case 1: return this.getWeaponEntries();
            case 2: return this.getPetEntries();
            case 3: return this.getRelicEntries();
        }
        return [];
    }

    getEnemyEntries() {
        const allTypes = Object.keys(ENEMY_TYPES);
        return allTypes.map(type => {
            const def = ENEMY_TYPES[type];
            const data = this.data.enemies[type];
            return {
                found: !!data,
                name: data ? data.name : def.name,
                detail: data ? `Killed: ${data.killed}` : '',
                color: def.isBoss ? '#ff1744' : '#78909c',
            };
        });
    }

    getWeaponEntries() {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const rarityColors = { common: '#9e9e9e', uncommon: '#4caf50', rare: '#2196f3', epic: '#9c27b0', legendary: '#ff9800' };
        const entries = [];
        for (const type of Object.keys(WEAPON_TYPES)) {
            for (const rarity of rarities) {
                const key = `${type}_${rarity}`;
                const data = this.data.weapons[key];
                entries.push({
                    found: !!data,
                    name: data ? data.name : `??? ${WEAPON_TYPES[type].name}`,
                    detail: data ? `DMG: ${data.dmg}` : '',
                    color: rarityColors[rarity],
                });
            }
        }
        return entries;
    }

    getPetEntries() {
        return PET_DEFS.map(def => {
            const data = this.data.pets[def.id];
            return {
                found: !!data,
                name: def.name,
                icon: data ? def.icon : '?',
                detail: data ? `[${def.rarity}]` : '',
                color: GACHA_RARITIES[def.rarity]?.color || '#78909c',
            };
        });
    }

    getRelicEntries() {
        return RELIC_POOL.map(relic => {
            const data = this.data.relics[relic.id];
            return {
                found: !!data,
                name: relic.name,
                icon: data ? relic.icon : '?',
                detail: data ? relic.desc : '',
                color: GACHA_RARITIES[relic.rarity]?.color || '#78909c',
            };
        });
    }
}
