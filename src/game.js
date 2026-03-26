// ============================================
// GAME - Main game loop and state management
// ============================================

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Lighting (must be before resize)
        this.lightCanvas = document.createElement('canvas');
        this.lightCtx = this.lightCanvas.getContext('2d');

        // Camera (must be before resize)
        this.camera = {
            x: 0, y: 0,
            targetX: 0, targetY: 0,
            halfW: 0, halfH: 0,
            smoothing: 0.08,
        };

        // Display
        this.pixelRatio = window.devicePixelRatio || 1;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input
        this.input = {
            keys: {},
            mouse: { x: 0, y: 0 },
            mouseDown: false,
            mouseJustPressed: false,
            worldMouseX: 0,
            worldMouseY: 0,
        };
        this.setupInput();

        // Game state
        this.state = 'title'; // title, playing, dead, paused
        this.floor = 1;
        this.dungeon = null;
        this.dungeonGen = null;
        this.dungeonRenderer = new DungeonRenderer();
        this.player = null;
        this.enemies = [];
        this.combat = new CombatSystem();
        this.items = new ItemManager();
        this.ui = new GameUI(this.canvas);
        this.weaponPickup = null;

        // FPS
        this.lastTime = 0;
        this.fps = 0;
        this.fpsTimer = 0;
        this.fpsCount = 0;

        // Opened chests tracking
        this.openedChests = new Set();

        // Meta-progression (available from title screen)
        this.meta = new MetaProgression();

        // Start
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.lightCanvas.width = this.canvas.width;
        this.lightCanvas.height = this.canvas.height;
        this.camera.halfW = this.canvas.width / 2;
        this.camera.halfH = this.canvas.height / 2;
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.input.keys[e.code] = true;

            // Title screen menu
            if (this.state === 'title') {
                GameAudio.init();
                if (e.code === 'Digit1' || e.code === 'Space' || e.code === 'Enter') {
                    this.startGame();
                } else if (e.code === 'Digit2') {
                    this.startGame();
                    this.dailyChallenge.start(this);
                    this.ui.notify('Daily Challenge Active!', '#ffd740', 3);
                } else if (e.code === 'Digit3') {
                    this.state = 'soulforge';
                } else if (e.code === 'Digit4' && this.saveSystem && this.saveSystem.hasSave) {
                    // Continue from save (skip class select)
                    this.startGame(true);
                    const saveData = this.saveSystem.load();
                    if (saveData) {
                        this.saveSystem.restoreGame(this, saveData);
                        this.ui.notify('Game loaded!', '#64ffda', 2);
                    }
                }
                return;
            }

            // Soul Forge screen
            if (this.state === 'soulforge') {
                for (let i = 0; i < 8; i++) {
                    if (e.code === `Digit${i + 1}`) {
                        const ids = ['startHp','startAtk','startDef','startPotions','startSpeed','luckBoost','xpBoost','goldBoost'];
                        if (this.meta.buyUpgrade(ids[i])) {
                            this.ui.notify(`Upgrade purchased! (Lv.${this.meta.data.upgrades[ids[i]]})`, '#b388ff');
                            GameAudio.play('levelUp');
                            Utils.addFlash('#b388ff', 0.15);
                        } else {
                            this.ui.notify('Not enough souls!', '#546e7a');
                        }
                    }
                }
                if (e.code === 'Space') this.startGame();
                if (e.code === 'Escape') this.state = 'title';
                return;
            }

            // Death screen options
            if (this.state === 'dead' && this.ui.deathTimer > 2.5) {
                if (e.code === 'Digit1' || e.code === 'Space') this.startGame();
                else if (e.code === 'Digit2') this.state = 'soulforge';
                return;
            }

            // Weapon switch
            if (e.code === 'KeyE' && this.player && this.player.weapons.length > 1) {
                this.player.currentWeapon = (this.player.currentWeapon + 1) % this.player.weapons.length;
                this.ui.notify(`Equipped: ${this.player.weapons[this.player.currentWeapon].getDisplayName()}`,
                    this.player.weapons[this.player.currentWeapon].getRarityColor());
            }

            // Potion
            if (e.code === 'KeyQ' && this.player) {
                this.player.usePotion();
            }

            // Minimap toggle
            if (e.code === 'KeyM') {
                this.ui.minimap = !this.ui.minimap;
            }

            // Stats overlay (Tab)
            if (e.code === 'Tab' && this.state === 'playing') {
                this.showStats = !this.showStats;
                e.preventDefault();
            }

            // Pause (Escape during gameplay)
            if (e.code === 'Escape' && (this.state === 'playing' || this.state === 'paused')) {
                if (this.codex && this.codex.showScreen) {
                    this.codex.showScreen = false;
                } else {
                    this.state = this.state === 'paused' ? 'playing' : 'paused';
                }
            }

            // Codex (C)
            if (e.code === 'KeyC' && this.state === 'playing') {
                if (this.codex) {
                    this.codex.showScreen = !this.codex.showScreen;
                    if (this.codex.showScreen) return;
                }
            }

            // Weapon Forge (R)
            if (e.code === 'KeyR' && this.player && this.player.weapons.length >= 2 && this.state === 'playing') {
                if (!this.forge.active) this.forge.open(this.player);
            }

            // Slot Machine (T) - available when near merchant events
            if (e.code === 'KeyT' && this.player && this.state === 'playing') {
                if (!this.slotMachine.active) this.slotMachine.open();
            }

            // Weapon pickup
            if (this.weaponPickup) {
                if (e.code === 'KeyF') {
                    this.equipWeapon(this.weaponPickup);
                    this.weaponPickup = null;
                } else if (e.code === 'KeyX') {
                    this.weaponPickup = null;
                }
            }

            // Prevent scrolling
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.input.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.input.mouse.x = e.clientX;
            this.input.mouse.y = e.clientY;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.input.mouseDown = true;
            this.input.mouseJustPressed = true;

            // Initialize audio on first click
            GameAudio.init();

            if (this.state === 'title') {
                this.startGame();
                return;
            }

            if (this.state === 'dead' && this.ui.deathTimer > 2.5) {
                this.startGame();
                return;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.input.mouseDown = false;
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    startGame(skipClassSelect = false) {
        this.state = 'playing';
        this.floor = 1;
        this.player = new Player(0, 0);
        this.ui.titleScreen = false;
        this.ui.deathScreen = false;
        this.ui.deathTimer = 0;

        // Skills
        this.skills = new SkillSystem(this.player);

        // Perks
        this.perks = new PerkSystem();

        // Gacha & Events
        this.gacha = new GachaSystem();
        this.events = new EventSystem();
        this.killStreak = new KillStreakSystem();
        this.enchant = new EnchantSystem();
        this.achievements = new AchievementSystem();
        this.challenge = new ChallengeRoom();
        this.slotMachine = new SlotMachine();
        this.forge = new WeaponForge();
        this.petSystem = new PetSystem();
        this.curseSystem = new CurseSystem();
        this.biomeSystem = new BiomeSystem();
        this.synergySystem = new SynergySystem();
        this.vfx = new VFXSystem();
        this.meta = new MetaProgression();
        this.ascension = new AscensionSystem();
        this.comboFinisher = new ComboFinisher();
        this.dailyChallenge = new DailyChallenge();
        this.luckWheel = new LuckWheel();
        this.floorMods = new FloorModSystem();
        this.goblinManager = new GoblinManager();
        this.saveSystem = new SaveSystem();
        this.tutorial = new Tutorial();
        this.codex = new Codex();
        this.classSelect = new ClassSelect();

        // Play timer
        this.playTime = 0;
        this.firstKillDone = false;

        // Meta bonuses: applied after class selection (in classes.js)
        // For save/load (skipClassSelect), apply here
        if (skipClassSelect && this.meta) {
            this.meta.applyToPlayer(this.player);
        }

        // Give starter pet
        const starterPet = this.petSystem.getRandomPet('common');
        this.petSystem.addPet(starterPet);
        this.player.relics = [];

        // Override player levelUp to show perk choices
        const origLevelUp = this.player.levelUp.bind(this.player);
        this.player.levelUp = () => {
            origLevelUp();
            this.perks.show(this.player.level);
        };

        // Start ambient music
        GameAudio.startAmbience();

        // Tutorial
        if (this.tutorial) {
            this.tutorial.start();
            this.tutorial.trigger('start');
        }

        // Show class selection (skip if loading save)
        if (!skipClassSelect && this.classSelect) {
            this.classSelect.show();
        }

        // Give default weapon (class select will override)
        if (this.player.weapons.length === 0) {
            this.player.weapons.push(new Weapon('sword', 'common'));
        }

        this.generateFloor();
    }

    generateFloor() {
        this.enemies = [];
        this.items.clear();
        this.combat.playerProjectiles = [];
        this.combat.damageNumbers = [];
        this.combat.swingVisuals = [];
        particles.clear();
        this.openedChests = new Set();
        this._floorCleared = false;

        // Generate dungeon
        const mapW = 60 + this.floor * 5;
        const mapH = 50 + this.floor * 4;
        this.dungeonGen = new DungeonGenerator(mapW, mapH, this.floor);
        this.dungeon = this.dungeonGen.generate();

        // Place player at spawn
        this.player.x = this.dungeon.spawnPoint.x;
        this.player.y = this.dungeon.spawnPoint.y;

        // Camera snap
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;

        // Spawn enemies
        this.spawnEnemies();

        // Floor modifier
        if (this.floorMods) {
            this.floorMods.cleanup();
            const mod = this.floorMods.rollModifier(this.floor);
            if (mod) {
                this.ui.notify(`${mod.name}: ${mod.desc}`, mod.color, 4);
            }
        }

        // Biome setup
        if (this.biomeSystem) this.biomeSystem.setFloor(this.floor);

        // Small HP recovery on floor clear (10% of max)
        if (this.player) {
            const healAmt = Math.floor(this.player.maxHp * 0.1);
            this.player.hp = Math.min(this.player.hp + healAmt, this.player.maxHp);
        }

        // Floor transition
        this.ui.startFloorTransition(this.floor);
        this.ui.notify(`Entering Floor ${this.floor}`, '#64ffda');
    }

    spawnEnemies() {
        const floorEnemies = this.getFloorEnemyTypes();

        for (let i = 1; i < this.dungeon.rooms.length; i++) {
            const room = this.dungeon.rooms[i];

            if (room.type === 'boss' && this.floor % 5 === 0) {
                // Boss (type varies by floor)
                const boss = new Enemy(
                    room.centerX * TILE_SIZE + TILE_SIZE / 2,
                    room.centerY * TILE_SIZE + TILE_SIZE / 2,
                    this.getBossType()
                );
                // Scale boss with floor
                boss.maxHp = Math.floor(boss.maxHp * (1 + this.floor * 0.3));
                boss.hp = boss.maxHp;
                boss.baseAttack = Math.floor(boss.baseAttack * (1 + this.floor * 0.15));
                this.enemies.push(boss);
                room.enemies.push(boss);
                continue;
            }

            if (room.type === 'treasure' || room.type === 'shrine') {
                // Fewer enemies in special rooms
                const count = Utils.randInt(1, 2);
                for (let j = 0; j < count; j++) {
                    this.spawnEnemyInRoom(room, floorEnemies);
                }
                continue;
            }

            if (room.type === 'secret') {
                // Secret rooms: no enemies, just loot
                continue;
            }

            if (room.type === 'miniboss') {
                // Miniboss room: one strong elite + guards
                const mbTypes = ['knight', 'zombie', 'mage', 'golem_enemy'];
                const mbType = Utils.randChoice(mbTypes.filter(t => ENEMY_TYPES[t]));
                const mx = room.centerX * TILE_SIZE + TILE_SIZE / 2;
                const my = room.centerY * TILE_SIZE + TILE_SIZE / 2;
                const miniboss = new Enemy(mx, my, mbType);
                // Make it a powerful elite
                const scale = this.getFloorDifficulty() * 2;
                miniboss.maxHp = Math.floor(miniboss.maxHp * scale);
                miniboss.hp = miniboss.maxHp;
                miniboss.baseAttack = Math.floor(miniboss.baseAttack * scale * 0.8);
                miniboss.xpReward = Math.floor(miniboss.xpReward * 4);
                miniboss.goldReward = Math.floor(miniboss.goldReward * 4);
                EventSystem.makeElite(miniboss, this.floor);
                miniboss.name = '⭐ ' + miniboss.name + ' (Miniboss)';
                this.enemies.push(miniboss);
                room.enemies.push(miniboss);

                // Add a few guards
                for (let j = 0; j < 3; j++) {
                    this.spawnEnemyInRoom(room, floorEnemies);
                }
                continue;
            }

            // Normal rooms
            const count = Utils.randInt(2, 4 + Math.floor(this.floor / 2));
            for (let j = 0; j < count; j++) {
                this.spawnEnemyInRoom(room, floorEnemies);
            }
        }
    }

    getFloorEnemyTypes() {
        const types = ['slime', 'skeleton'];
        if (this.floor >= 2) types.push('bat');
        if (this.floor >= 3) types.push('zombie');
        if (this.floor >= 4) types.push('ghost');
        if (this.floor >= 5) types.push('mage');
        if (this.floor >= 7) types.push('knight');
        if (this.floor >= 10) types.push('assassin');
        if (this.floor >= 12) types.push('necromancer');
        if (this.floor >= 15) types.push('golem_enemy');
        return types;
    }

    getBossType() {
        // Cycle through bosses in endless mode
        const bossPool = ['boss_demon', 'boss_lich', 'boss_dragon'];
        if (this.floor >= 20) {
            // Endless: cycle bosses with increasing difficulty
            return bossPool[(Math.floor(this.floor / 5) - 1) % bossPool.length];
        }
        if (this.floor >= 10) return 'boss_lich';
        return 'boss_demon';
    }

    getFloorDifficulty() {
        const base = 1 + (this.floor - 1) * 0.12;
        if (this.floor > 20) {
            // Endless: moderate exponential (player also scales via perks/relics/forge)
            const endlessMult = Math.pow(1.05, this.floor - 20);
            return base * endlessMult;
        }
        return base;
    }

    spawnEnemyInRoom(room, types) {
        const type = Utils.randChoice(types);
        const x = Utils.randInt(room.x + 1, room.x + room.w - 2) * TILE_SIZE + TILE_SIZE / 2;
        const y = Utils.randInt(room.y + 1, room.y + room.h - 2) * TILE_SIZE + TILE_SIZE / 2;
        const enemy = new Enemy(x, y, type);

        // Scale with floor (uses exponential scaling for endless)
        const scale = this.getFloorDifficulty();
        enemy.maxHp = Math.floor(enemy.maxHp * scale);
        enemy.hp = enemy.maxHp;
        enemy.baseAttack = Math.floor(enemy.baseAttack * (1 + (this.floor - 1) * 0.08 + (this.floor > 20 ? (this.floor - 20) * 0.05 : 0)));
        enemy.xpReward = Math.floor(enemy.xpReward * scale * 1.2); // More XP in endless
        enemy.goldReward = Math.floor(enemy.goldReward * scale);

        // Ascension modifiers
        if (this.ascension && this.ascension.level > 0) {
            this.ascension.applyToEnemy(enemy, this);
        }

        // Elite enemy chance (increases with floor + ascension)
        const eliteMult = this.eliteChanceMult || 1;
        const eliteChance = Math.min((0.05 + this.floor * 0.02) * eliteMult, 0.5);
        if (Math.random() < eliteChance) {
            EventSystem.makeElite(enemy, this.floor);
        }

        this.enemies.push(enemy);
        room.enemies.push(enemy);
    }

    equipWeapon(weapon) {
        if (this.player.weapons.length >= 3) {
            // Replace current
            this.player.weapons[this.player.currentWeapon] = weapon;
        } else {
            this.player.weapons.push(weapon);
            this.player.currentWeapon = this.player.weapons.length - 1;
        }
        this.ui.notify(`Equipped: ${weapon.getDisplayName()}`, weapon.getRarityColor());
        GameAudio.play('pickup');
        if (this.codex) this.codex.trackWeapon(weapon);
    }

    // ---- Main loop ----

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        // FPS counter
        this.fpsCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1) {
            this.fps = this.fpsCount;
            this.fpsCount = 0;
            this.fpsTimer = 0;
        }

        // Freeze frames
        if (Utils.freezeFrames > 0) {
            Utils.freezeFrames--;
            this.render();
            requestAnimationFrame((t) => this.loop(t));
            return;
        }

        // Slow motion
        const effectiveDt = dt * Utils.slowMo;
        Utils.updateSlowMo(dt);

        this.update(effectiveDt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.ui.update(dt);

        if (this.state === 'victory') {
            this.ui.victoryTimer = (this.ui.victoryTimer || 0) + dt;
            if (this.input.keys['Digit1'] && this.ui.victoryTimer > 2) {
                // Continue to endless mode + ascend
                if (this.ascension && this.ascension.canAscend()) {
                    this.ascension.ascend(this);
                    this.ui.notify(`⬆ ASCENSION ${this.ascension.level}! Enemies grow stronger...`, '#ffd740', 5);
                }
                this.state = 'playing';
                this.generateFloor();
                this.ui.notify('♾ ENDLESS MODE — How deep can you go?', '#ffd740', 5);
            } else if (this.input.keys['Digit2'] && this.ui.victoryTimer > 2) {
                this.state = 'soulforge';
            }
            return;
        }
        if (this.state !== 'playing') return;

        // Class selection pauses game
        if (this.classSelect && this.classSelect.active) {
            this.classSelect.update(dt);
            this.classSelect.handleMouseMove(this.input.mouse.x, this.input.mouse.y,
                this.canvas.width, this.canvas.height);
            // Key selection
            const classIds = this.classSelect.getAvailableClasses().map(([id]) => id);
            for (let i = 0; i < classIds.length; i++) {
                if (this.input.keys[`Digit${i + 1}`]) {
                    this.classSelect.select(classIds[i], this.player);
                    this.input.keys[`Digit${i + 1}`] = false;
                    break;
                }
            }
            // Mouse click selection
            if (this.input.mouseJustPressed && this.classSelect.hoveredIndex >= 0) {
                this.classSelect.select(classIds[this.classSelect.hoveredIndex], this.player);
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Codex screen pauses game
        if (this.codex && this.codex.showScreen) {
            if (this.input.keys['Escape']) {
                this.codex.showScreen = false;
                this.input.keys['Escape'] = false;
            }
            // Tab switching
            for (let i = 0; i < 4; i++) {
                if (this.input.keys[`Digit${i + 1}`]) {
                    this.codex.tab = i;
                    this.input.keys[`Digit${i + 1}`] = false;
                }
            }
            return;
        }

        if (this.weaponPickup) return; // Pause during weapon pickup

        // Lucky Wheel
        if (this.luckWheel && this.luckWheel.active) {
            this.luckWheel.update(dt);
            if (this.input.keys['Space']) {
                if (this.luckWheel.result) {
                    this.luckWheel.applyReward(this.player, this);
                    this.ui.notify(`Wheel: ${this.luckWheel.result.label}!`, this.luckWheel.result.color);
                } else if (!this.luckWheel.spinning) {
                    this.luckWheel.spin();
                }
                this.input.keys['Space'] = false;
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Curse system deals
        if (this.curseSystem && this.curseSystem.offerActive) {
            this.curseSystem.update(dt, this.player);
            if (this.input.keys['Digit1']) {
                this.curseSystem.acceptDeal(this.player);
                this.ui.notify(`Blessed & Cursed!`, '#7c4dff');
                this.input.keys['Digit1'] = false;
            }
            if (this.input.keys['Digit2']) {
                this.curseSystem.declineDeal();
                this.input.keys['Digit2'] = false;
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Slot Machine
        if (this.slotMachine && this.slotMachine.active) {
            this.slotMachine.playerGold = this.player.gold;
            this.slotMachine.update(dt, this.player);
            if (this.input.keys['Space'] && this.slotMachine.canSpin(this.player)) {
                this.slotMachine.spin(this.player);
                this.input.keys['Space'] = false;
            }
            if (this.input.keys['Escape']) {
                this.slotMachine.close();
                this.input.keys['Escape'] = false;
            }
            // Handle gacha from jackpot
            if (this.slotMachine.result && this.slotMachine.result.payout) {
                const payout = this.slotMachine.result.payout;
                if (payout.gacha && !this.slotMachine._gachaDone) {
                    this.slotMachine._gachaDone = true;
                    setTimeout(() => {
                        this.slotMachine.close();
                        this.gacha.pull(this.floor, (reward) => {
                            if (reward.type === 'weapon') this.weaponPickup = reward.item;
                        });
                    }, 2000);
                }
            } else {
                this.slotMachine._gachaDone = false;
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Weapon Forge
        if (this.forge && this.forge.active) {
            this.forge.update(dt);
            if (this.forge.result) {
                if (this.input.keys['Space']) {
                    this.forge.close();
                    this.input.keys['Space'] = false;
                }
            } else {
                // Select weapons with number keys
                for (let i = 0; i < this.player.weapons.length; i++) {
                    if (this.input.keys[`Digit${i + 1}`]) {
                        const wp = this.player.weapons[i];
                        if (!this.forge.selectedWeapons[0]) {
                            this.forge.selectWeapon(0, wp);
                        } else if (!this.forge.selectedWeapons[1] && wp !== this.forge.selectedWeapons[0]) {
                            this.forge.selectWeapon(1, wp);
                        }
                        this.input.keys[`Digit${i + 1}`] = false;
                    }
                }
                if (this.input.keys['Space'] && this.forge.canForge()) {
                    this.forge.forge(this.player);
                    this.input.keys['Space'] = false;
                }
            }
            if (this.input.keys['Escape']) {
                this.forge.close();
                this.input.keys['Escape'] = false;
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Gacha system
        if (this.gacha && this.gacha.active) {
            this.gacha.update(dt);
            if (this.gacha.phase === 'reward') {
                if (this.input.keys['Space'] || this.input.mouseJustPressed) {
                    this.gacha.close(this.player);
                    this.input.keys['Space'] = false;
                    this.input.mouseJustPressed = false;
                }
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Event system
        if (this.events && this.events.activeEvent) {
            this.events.update(dt);
            this.events.handleMouseMove(this.input.mouse.x, this.input.mouse.y,
                this.canvas.width, this.canvas.height);

            if (!this.events.eventResult) {
                for (let i = 0; i < 4; i++) {
                    if (this.input.keys[`Digit${i + 1}`]) {
                        const result = this.events.selectChoice(i, this.player, this);
                        if (result) this.ui.notify(result, this.events.activeEvent.color);
                        this.input.keys[`Digit${i + 1}`] = false;
                        break;
                    }
                }
                if (this.input.mouseJustPressed && this.events.selectedChoice >= 0) {
                    const result = this.events.selectChoice(this.events.selectedChoice, this.player, this);
                    if (result) this.ui.notify(result, this.events.activeEvent.color);
                }
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Perk selection pauses game
        if (this.perks && this.perks.active) {
            this.perks.update(dt);
            this.perks.handleMouseMove(this.input.mouse.x, this.input.mouse.y,
                this.canvas.width, this.canvas.height);

            // Check perk selection (keys 1-3)
            for (let i = 0; i < 3; i++) {
                if (this.input.keys[`Digit${i + 1}`]) {
                    const perk = this.perks.select(i, this.player);
                    if (perk) {
                        this.ui.notify(`${perk.name}: ${perk.description}`, perk.color, 3);
                        GameAudio.play('pickup');
                    }
                    this.input.keys[`Digit${i + 1}`] = false;
                    break;
                }
            }
            // Also allow click selection
            if (this.input.mouseJustPressed && this.perks.selectedIndex >= 0) {
                const perk = this.perks.select(this.perks.selectedIndex, this.player);
                if (perk) {
                    this.ui.notify(`${perk.name}: ${perk.description}`, perk.color, 3);
                    GameAudio.play('pickup');
                }
            }
            this.input.mouseJustPressed = false;
            return;
        }

        // Update world mouse position
        this.input.worldMouseX = this.input.mouse.x + this.camera.x - this.camera.halfW;
        this.input.worldMouseY = this.input.mouse.y + this.camera.y - this.camera.halfH;

        // Player
        this.player.update(dt, this.dungeon, this.input);

        // Attack with charge mechanic
        if (!this.chargeTimer) this.chargeTimer = 0;
        if (this.input.mouseDown) {
            this.chargeTimer += dt;
            this.combat.attack(this.player, this.enemies, this.input, this.dungeon);

            // Show charge indicator
            if (this.chargeTimer > 0.5) {
                // Charge particles around player
                if (Math.random() < 0.3) {
                    const angle = Utils.rand(0, Math.PI * 2);
                    particles.add(new Particle(
                        this.player.x + Math.cos(angle) * 20,
                        this.player.y + Math.sin(angle) * 20, {
                        vx: -Math.cos(angle) * 2,
                        vy: -Math.sin(angle) * 2,
                        life: 0.2, size: 2, endSize: 0,
                        color: '#ffd740', glow: true, glowSize: 6,
                    }));
                }
            }
        } else {
            // Release charge attack
            if (this.chargeTimer > 0.8 && this.player.weapons.length > 0) {
                const weapon = this.player.weapons[this.player.currentWeapon];
                const chargeMult = Math.min(this.chargeTimer / 0.8, 3); // Up to 3x damage

                // Charged melee swing
                for (const enemy of this.enemies) {
                    if (!enemy.alive) continue;
                    const dist = Utils.dist(this.player.x, this.player.y, enemy.x, enemy.y);
                    if (dist < weapon.range * 1.5) {
                        const dmg = Math.floor(weapon.getDamage(this.player.attack, false) * chargeMult);
                        enemy.takeDamage(dmg, this.player.x, this.player.y);
                        this.combat.addDamageNumber(enemy.x, enemy.y - 20, dmg, true);
                        particles.hitSpark(enemy.x, enemy.y, '#ffd740', 15);
                        this.player.addCombo();
                    }
                }

                Utils.addShake(8 * chargeMult);
                Utils.addFlash('#ffd740', 0.2);
                if (this.vfx && chargeMult >= 2) {
                    this.vfx.critSlash(this.player.facing);
                }
                GameAudio.play('attack');

                // Charged swing visual
                this.combat.swingVisuals.push({
                    x: this.player.x, y: this.player.y,
                    angle: this.player.facing,
                    range: weapon.range * 1.5,
                    arc: Math.PI * 1.2,
                    color: '#ffd740',
                    life: 0.3, maxLife: 0.3,
                });
            }
            this.chargeTimer = 0;
        }

        // Enemies
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            if (enemy.isAlly) continue; // Skip necromancer allies (they just exist as visuals)

            // Frozen Hourglass relic: slow nearby enemies
            if (this.player.auraSlowPct) {
                const d = Utils.dist(enemy.x, enemy.y, this.player.x, this.player.y);
                if (d < 120) {
                    enemy._auraSlow = true;
                    enemy.update(dt * (1 - this.player.auraSlowPct), this.dungeon, this.player);
                } else {
                    enemy._auraSlow = false;
                    enemy.update(dt, this.dungeon, this.player);
                }
            } else {
                enemy._auraSlow = false;
                enemy.update(dt, this.dungeon, this.player);
            }
            enemy.updateProjectiles(dt, this.player, this.dungeon);

            // Melee contact damage
            if (enemy.attackCooldown <= 0) {
                const dist = Utils.dist(enemy.x, enemy.y, this.player.x, this.player.y);
                if (dist < enemy.attackRange) {
                    const dmg = Math.max(1, enemy.baseAttack - this.player.defense);
                    if (this.player.takeDamage(dmg, enemy.x, enemy.y)) {
                        enemy.attackCooldown = enemy.attackMaxCooldown;
                        particles.bloodSplatter(this.player.x, this.player.y,
                            Utils.angle(enemy.x, enemy.y, this.player.x, this.player.y), 8);
                        Utils.addShake(4);
                        Utils.addFlash('#ff1744', 0.2);
                        GameAudio.play('playerHit');
                        this.player.combo = 0;

                        this.combat.addDamageNumber(
                            this.player.x, this.player.y - this.player.h / 2,
                            dmg, false
                        );

                        // Thorn Armor relic: reflect damage
                        if (this.player.thornDmg) {
                            const reflectDmg = Math.floor(dmg * this.player.thornDmg);
                            if (reflectDmg > 0) {
                                enemy.takeDamage(reflectDmg, this.player.x, this.player.y);
                                particles.hitSpark(enemy.x, enemy.y, '#66bb6a', 4);
                            }
                        }

                        // Greed curse: lose gold on hit
                        if (this.player.goldLossOnHit) {
                            const loss = Math.floor(this.player.gold * 0.5);
                            this.player.gold = Math.max(0, this.player.gold - loss);
                            if (loss > 0) {
                                this.combat.addDamageNumber(
                                    this.player.x + 15, this.player.y - 10,
                                    `-${loss}g`, false
                                );
                            }
                        }
                    }
                }
            }
        }

        // Necromancer allies attack nearby enemies
        for (const ally of this.enemies) {
            if (!ally.isAlly || !ally.alive) continue;
            // Find nearest non-ally enemy
            let nearest = null, nearDist = 80;
            for (const e of this.enemies) {
                if (e.isAlly || !e.alive) continue;
                const d = Utils.dist(ally.x, ally.y, e.x, e.y);
                if (d < nearDist) { nearDist = d; nearest = e; }
            }
            if (nearest) {
                // Move toward and attack
                const angle = Utils.angle(ally.x, ally.y, nearest.x, nearest.y);
                ally.x += Math.cos(angle) * 80 * dt;
                ally.y += Math.sin(angle) * 80 * dt;
                if (nearDist < 25 && ally.attackCooldown <= 0) {
                    nearest.takeDamage(ally.baseAttack, ally.x, ally.y);
                    ally.attackCooldown = 1.5;
                    particles.hitSpark(nearest.x, nearest.y, '#e040fb', 3);
                }
            } else {
                // Follow player
                const angle = Utils.angle(ally.x, ally.y, this.player.x, this.player.y);
                const dist = Utils.dist(ally.x, ally.y, this.player.x, this.player.y);
                if (dist > 50) {
                    ally.x += Math.cos(angle) * 60 * dt;
                    ally.y += Math.sin(angle) * 60 * dt;
                }
            }
            if (ally.attackCooldown > 0) ally.attackCooldown -= dt;
        }

        // Combat system
        this.combat.update(dt, this.player, this.enemies, this.dungeon);

        // Handle enemy deaths and drops
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.alive) {
                this.items.spawnEnemyDrops(enemy.x, enemy.y, enemy, this.floor);

                // Kill streak
                if (this.killStreak) {
                    this.killStreak.addKill();

                    // Bonus gold/xp from streak
                    const streakMult = this.killStreak.getStreakMultiplier();
                    if (streakMult > 1) {
                        const bonusGold = Math.floor(enemy.goldReward * (streakMult - 1));
                        this.player.gold = Math.floor(this.player.gold + bonusGold);
                    }

                    // Achievement & codex tracking
                    if (this.achievements) {
                        if (enemy.isElite) this.achievements.addStat('eliteKills');
                        if (enemy.isBoss) this.achievements.addStat('bossKills');
                    }
                    if (this.codex) {
                        this.codex.trackEnemyKill(enemy);
                    }

                    // Elite enemies drop gacha on kill
                    if (enemy.isElite && Math.random() < 0.4) {
                        this.gacha.pull(this.floor, (reward) => {
                            if (reward.type === 'weapon') this.weaponPickup = reward.item;
                        });
                    }

                    // Explosive enemies explode on death
                    if (enemy.explosive) {
                        particles.explosion(enemy.x, enemy.y, '#ff1744', 40);
                        Utils.addShake(8);
                        // Damage nearby enemies too
                        for (const other of this.enemies) {
                            if (other.alive && other !== enemy) {
                                const d = Utils.dist(enemy.x, enemy.y, other.x, other.y);
                                if (d < 80) {
                                    other.takeDamage(30, enemy.x, enemy.y);
                                }
                            }
                        }
                    }
                }

                this.enemies.splice(i, 1);

                // Last enemy in current room? Extra dramatic slowmo
                if (this.lastRoom) {
                    const ptx = Math.floor(this.player.x / TILE_SIZE);
                    const pty = Math.floor(this.player.y / TILE_SIZE);
                    const roomEnemies = this.enemies.filter(e => e.alive && this.lastRoom.contains(
                        Math.floor(e.x / TILE_SIZE), Math.floor(e.y / TILE_SIZE)
                    ));
                    if (roomEnemies.length === 0 && this.lastRoom.enemies && this.lastRoom.enemies.length > 0) {
                        Utils.addSlowMo(0.15, 0.6);
                        Utils.addFreeze(4);
                    }
                }
            }
        }

        // Pet system
        if (this.petSystem) this.petSystem.update(dt, this.player, this.enemies, this.dungeon);

        // Floor clear bonus (all enemies dead)
        if (!this._floorCleared && this.enemies.filter(e => e.alive && !e.isAlly).length === 0) {
            this._floorCleared = true;
            const bonus = 20 + this.floor * 5;
            this.player.gold += bonus;
            this.ui.notify(`Floor ${this.floor} Cleared! +${bonus}g`, '#64ffda', 3);
            particles.levelUpEffect(this.player.x, this.player.y);
        }

        // Floor modifier update
        if (this.floorMods) this.floorMods.update(dt);

        // Treasure Goblins
        if (this.goblinManager) {
            this.goblinManager.update(dt, this.dungeon, this.player, this.combat);
        }

        // Combo finisher
        if (this.comboFinisher) {
            this.comboFinisher.update(dt, this.player);
            if (this.input.keys['KeyF'] && this.comboFinisher.ready && !this.weaponPickup) {
                this.comboFinisher.execute(this.player, this.enemies, this.combat, this.vfx);
                this.input.keys['KeyF'] = false;
            }
        }

        // Biome ambient
        if (this.biomeSystem) this.biomeSystem.update(dt, this.camera);

        // VFX
        if (this.vfx) this.vfx.update(dt);

        // Synergy check (low frequency)
        if (this.synergySystem && Math.random() < 0.02) {
            this.synergySystem.check(this.player);
        }
        if (this.synergySystem) this.synergySystem.update(dt);

        // Curse system
        if (this.curseSystem) this.curseSystem.update(dt, this.player);

        // Kill streak update
        if (this.killStreak) this.killStreak.update(dt);

        // Challenge room update
        if (this.challenge && this.challenge.active) {
            this.challenge.update(dt, this);
        }

        // Achievements check (every few frames for perf)
        if (this.achievements && Math.random() < 0.1) {
            this.achievements.check(this.player, this);
        }
        if (this.achievements) this.achievements.update(dt);

        // Check room clear
        this.checkRoomClears();

        // Items
        this.items.update(dt, this.player);

        // Check for weapon pickups (manual)
        for (const item of this.items.items) {
            if (item.type === 'weapon' && item.alive && !item.spawning) {
                const dist = Utils.dist(item.x, item.y, this.player.x, this.player.y);
                if (dist < 30) {
                    this.weaponPickup = item.data.weapon;
                    item.alive = false;
                    GameAudio.play('chest');
                }
            }
        }

        // Check stairs
        const playerTX = Math.floor(this.player.x / TILE_SIZE);
        const playerTY = Math.floor(this.player.y / TILE_SIZE);
        if (playerTX >= 0 && playerTX < this.dungeon.width &&
            playerTY >= 0 && playerTY < this.dungeon.height &&
            this.dungeon.tiles[playerTY][playerTX] === TILE.STAIRS_DOWN) {
            this.descend();
        }

        // Check chest interaction
        if (this.dungeon.tiles[playerTY] && this.dungeon.tiles[playerTY][playerTX] === TILE.CHEST) {
            const chestKey = `${playerTX},${playerTY}`;
            if (!this.openedChests.has(chestKey)) {
                this.openedChests.add(chestKey);
                this.dungeon.tiles[playerTY][playerTX] = TILE.FLOOR;

                // 25% chance of gacha pull from chest!
                if (Math.random() < 0.25) {
                    this.ui.notify('✨ Magical Chest! Gacha Pull!', '#ffd740', 2);
                    this.gacha.pull(this.floor, (reward) => {
                        if (reward.type === 'weapon') this.weaponPickup = reward.item;
                    });
                } else {
                    this.items.spawnChestLoot(
                        playerTX * TILE_SIZE + TILE_SIZE / 2,
                        playerTY * TILE_SIZE + TILE_SIZE / 2,
                        this.floor
                    );
                }
                GameAudio.play('chest');
                this.ui.notify('Chest opened!', '#ffd740');
            }
        }

        // Overlay guard - prevent events/interactions while UI is open
        const anyOverlayActive = (this.perks && this.perks.active) ||
            (this.gacha && this.gacha.active) ||
            (this.events && this.events.activeEvent) ||
            (this.curseSystem && this.curseSystem.offerActive) ||
            (this.luckWheel && this.luckWheel.active) ||
            (this.slotMachine && this.slotMachine.active) ||
            (this.forge && this.forge.active) ||
            this.weaponPickup;

        // Check shrine/water room events (only if no overlay active)
        if (!anyOverlayActive && this.dungeon.tiles[playerTY] && this.dungeon.tiles[playerTY][playerTX] === TILE.WATER) {
            const shrineKey = `shrine_${playerTX},${playerTY}`;
            if (!this.openedChests.has(shrineKey)) {
                for (const room of this.dungeon.rooms) {
                    if (room.type === 'shrine' && room.contains(playerTX, playerTY)) {
                        this.openedChests.add(shrineKey);
                        this.events.triggerRandomEvent(room);
                        break;
                    }
                }
            }
        }

        // Random event chance when entering new rooms
        if (!this.lastRoom) this.lastRoom = null;
        const currentRoom = this.dungeon.rooms.find(r => r.contains(playerTX, playerTY));
        if (currentRoom && currentRoom !== this.lastRoom && !anyOverlayActive) {
            this.lastRoom = currentRoom;

            // Chaos Dice relic: random ATK bonus each room
            if (this.player.chaosDice) {
                // Remove old bonus, add new
                if (this.player._chaosBonus) this.player.attack -= this.player._chaosBonus;
                this.player._chaosBonus = Utils.randInt(0, 20);
                this.player.attack += this.player._chaosBonus;
                if (this.player._chaosBonus > 10) {
                    this.ui.notify(`🎲 Chaos: +${this.player._chaosBonus} ATK!`, '#ffd740', 1.5);
                }
            }

            // Boss room entrance
            if (currentRoom.type === 'boss' && !currentRoom.eventTriggered) {
                currentRoom.eventTriggered = true;
                if (this.vfx) this.vfx.bossEntrance();
                Utils.addShake(8);
                GameAudio.play('trap');
                // First boss tip
                if (!this._bossSeenBefore) {
                    this._bossSeenBefore = true;
                    this.ui.notify('TIP: Use [SPACE] to dash through attacks!', '#78909c', 5);
                }
            }
            // Secret room discovery
            else if (currentRoom.type === 'secret' && !currentRoom.eventTriggered) {
                currentRoom.eventTriggered = true;
                this.ui.notify('✨ Secret Room Discovered!', '#ffd740', 3);
                Utils.addFlash('#ffd740', 0.2);
                GameAudio.play('chest');
            }
            // Miniboss room warning
            else if (currentRoom.type === 'miniboss' && !currentRoom.eventTriggered) {
                currentRoom.eventTriggered = true;
                this.ui.notify('⭐ Miniboss Awaits!', '#ff9800', 3);
                Utils.addShake(5);
                GameAudio.play('trap');
            }
            // Normal room events
            else if (currentRoom.type === 'normal' && !currentRoom.eventTriggered) {
                currentRoom.eventTriggered = true;

                const roll = Math.random();
                if (roll < 0.08 && !this.challenge.active) {
                    const diff = this.floor >= 10 ? 'nightmare' : this.floor >= 5 ? 'hard' : 'normal';
                    this.challenge.start(currentRoom, this.floor, diff);
                } else if (roll < 0.18) {
                    this.events.triggerRandomEvent(currentRoom);
                }
            }
        }

        // Check traps
        for (const trap of this.dungeon.traps) {
            if (trap.triggered) continue;
            if (Math.abs(this.player.x - trap.worldX) < 16 && Math.abs(this.player.y - trap.worldY) < 16) {
                trap.triggered = true;
                let dmg = 10 + this.floor * 3;
                this.player.takeDamage(dmg, trap.worldX, trap.worldY);
                particles.explosion(trap.worldX, trap.worldY,
                    trap.type === 'fire' ? '#ff6600' : trap.type === 'poison' ? '#66bb6a' : '#78909c', 15);
                Utils.addShake(5);
                GameAudio.play('trap');
                this.combat.addDamageNumber(this.player.x, this.player.y - 20, dmg, false);
            }
        }

        // Skills
        if (this.skills) {
            this.skills.update(dt);

            // Check for skill unlocks on level up
            const unlocked = this.skills.checkUnlocks();
            if (unlocked) {
                this.ui.notify(`Skill Unlocked: ${unlocked.def.name}! [${unlocked.def.key.replace('Digit', '')}]`, unlocked.def.color, 4);
            }

            // Skill input
            for (const [id, skill] of Object.entries(this.skills.skills)) {
                if (this.input.keys[skill.key]) {
                    this.skills.use(id, this.enemies, this.combat);
                    this.input.keys[skill.key] = false; // Consume input
                }
            }
        }

        // Particles & effects
        particles.update(dt);
        Utils.updateShake();
        Utils.updateFlash();

        // Torch particles
        for (const torch of this.dungeon.torches) {
            particles.torchFlicker(torch.x, torch.y);
        }

        // Camera follow
        this.camera.targetX = this.player.x;
        this.camera.targetY = this.player.y;
        this.camera.x += (this.camera.targetX - this.camera.x) * this.camera.smoothing;
        this.camera.y += (this.camera.targetY - this.camera.y) * this.camera.smoothing;

        // Tutorial
        if (this.tutorial && this.tutorial.active) {
            this.tutorial.update(dt);
            // Auto-trigger based on player state
            if (Math.abs(this.player.vx) > 0 || Math.abs(this.player.vy) > 0) {
                this.tutorial.trigger('move');
            }
            if (this.player.kills >= 1) this.tutorial.trigger('firstKill');
            if (this.player.level >= 2) this.tutorial.trigger('perkDone');
            if (this.player.isDashing) this.tutorial.trigger('dash');
            if (this.floor >= 2) this.tutorial.trigger('floor2');
        }

        // Play time
        this.playTime += dt;

        // Auto-save
        if (this.saveSystem) this.saveSystem.update(dt, this);

        // Player death
        if (!this.player.alive) {
            // Phoenix Feather revive check
            if (this.player.hasRevive) {
                this.player.hasRevive = false;
                this.player.alive = true;
                this.player.hp = Math.floor(this.player.maxHp * 0.5);
                this.player.invulnerable = 3;
                particles.levelUpEffect(this.player.x, this.player.y);
                particles.explosion(this.player.x, this.player.y, '#ff6d00', 40);
                Utils.addShake(12);
                Utils.addFlash('#ff6d00', 0.5);
                Utils.addSlowMo(0.2, 1.0);
                this.ui.notify('🔥 Phoenix Feather Activated! Revived!', '#ff6d00', 4);
                GameAudio.play('levelUp');
            } else {
                this.state = 'dead';
                this.ui.deathScreen = true;
                this.ui.deathTimer = 0;
                Utils.addShake(15);

                // Close all overlays on death
                if (this.luckWheel) this.luckWheel.active = false;
                if (this.gacha) this.gacha.active = false;
                if (this.events && this.events.activeEvent) this.events.activeEvent = null;
                if (this.slotMachine) this.slotMachine.active = false;
                if (this.forge) this.forge.active = false;
                if (this.curseSystem) this.curseSystem.offerActive = false;
                this.weaponPickup = null;
                Utils.addSlowMo(0.1, 1.5);
                // Death explosion with player-colored particles
                particles.explosion(this.player.x, this.player.y, '#ff1744', 50);
                particles.explosion(this.player.x, this.player.y, this.player.classColor || '#4fc3f7', 30);
                // Equipment scatter
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    particles.add(new Particle(this.player.x, this.player.y, {
                        vx: Math.cos(angle) * Utils.rand(2, 6),
                        vy: Math.sin(angle) * Utils.rand(2, 6),
                        life: Utils.rand(0.5, 1.5),
                        size: Utils.rand(3, 6),
                        endSize: 0,
                        color: Utils.randChoice(['#78909c', '#546e7a', '#b0bec5']),
                        gravity: 0.15,
                        friction: 0.96,
                        shape: 'square',
                        rotSpeed: Utils.rand(-5, 5),
                    }));
                }

                // Delete run save on death (roguelike permadeath)
                if (this.saveSystem) this.saveSystem.deleteSave();

                // Meta-progression: earn souls
                if (this.meta) {
                    let soulsEarned = this.meta.endRun(this.player, this.floor, this);
                    // Soul Jar relic bonus
                    if (this.player.soulBonus) {
                        soulsEarned = Math.floor(soulsEarned * this.player.soulBonus);
                        this.meta.data.souls += soulsEarned - Math.floor(soulsEarned / this.player.soulBonus);
                        this.meta.save();
                    }
                    this.soulsEarned = soulsEarned;

                    // Check milestone unlocks
                    const newUnlocks = this.meta.checkMilestones(this);
                    if (newUnlocks.length > 0) {
                        this.milestoneUnlocks = newUnlocks;
                    }
                }
            }
        }

        // Reset just-pressed
        this.input.mouseJustPressed = false;
    }

    checkRoomClears() {
        for (const room of this.dungeon.rooms) {
            if (room.cleared) continue;

            // Check if player is in this room
            const ptx = Math.floor(this.player.x / TILE_SIZE);
            const pty = Math.floor(this.player.y / TILE_SIZE);
            if (!room.contains(ptx, pty)) continue;

            // Check if all enemies in this room are dead
            const aliveInRoom = this.enemies.filter(e => e.alive && room.contains(
                Math.floor(e.x / TILE_SIZE), Math.floor(e.y / TILE_SIZE)
            ));

            if (room.enemies.length > 0 && aliveInRoom.length === 0) {
                room.cleared = true;

                // Room clear bonus
                const goldBonus = 5 + this.floor * 2;
                this.player.gold += goldBonus;
                this.ui.notify(`Room Cleared! +${goldBonus}g`, '#64ffda');
                particles.levelUpEffect(this.player.x, this.player.y);

                // Boss defeat reward
                if (room.type === 'boss') {
                    this.ui.notify('BOSS DEFEATED!', '#ff1744', 5);
                    Utils.addShake(12);
                    Utils.addSlowMo(0.15, 1.5);
                    if (this.vfx) {
                        this.vfx.screenCrack();
                        this.vfx.comboExplosion();
                    }
                    // Boss drops gacha + gold
                    this.player.gold += 50 + this.floor * 10;
                    setTimeout(() => {
                        this.gacha.pull(this.floor, (reward) => {
                            if (reward.type === 'weapon') this.weaponPickup = reward.item;
                        });
                    }, 2000);
                }

                // Achievement: perfect room (no damage taken)
                if (this.player.hp === this.player.maxHp) {
                    if (this.achievements) this.achievements.addStat('perfectRooms');
                    // Consecutive perfect room streak
                    if (!this._perfectStreak) this._perfectStreak = 0;
                    this._perfectStreak++;
                    if (this._perfectStreak >= 2) {
                        const streakBonus = this._perfectStreak * 10;
                        this.player.gold += streakBonus;
                        this.ui.notify(`Flawless x${this._perfectStreak}! +${streakBonus}g`, '#64ffda', 2);
                    }
                } else {
                    this._perfectStreak = 0;
                }
            }
        }
    }

    descend() {
        this.floor++;
        GameAudio.play('stairs');

        // Victory at floor 20!
        if (this.floor === 21 && !this._victoryShown) {
            this._victoryShown = true;
            this.state = 'victory';
            this.ui.victoryTimer = 0;
            // Track victory
            if (!this.meta.data.victories) this.meta.data.victories = 0;
            this.meta.data.victories++;
            // Earn bonus souls
            const victorySouls = this.meta.endRun(this.player, this.floor, this);
            this.soulsEarned = victorySouls * 2; // Double souls for winning!
            this.meta.data.souls += victorySouls; // Extra bonus
            this.meta.save();
            return;
        }

        // King's Crown relic: +ATK per floor
        if (this.player.atkPerFloor) {
            this.player.attack += this.player.atkPerFloor;
            this.ui.notify(`👑 Crown: +${this.player.atkPerFloor} ATK!`, '#ffd740', 2);
        }

        // Floor milestones
        const milestones = {
            10: { msg: '🏔 FLOOR 10 — The Void Awaits', color: '#7c4dff' },
            15: { msg: '🌑 FLOOR 15 — The Abyss Opens', color: '#ff1744' },
            20: { msg: '✨ FLOOR 20 — Celestial Ruins', color: '#fff9c4' },
            25: { msg: '♾ FLOOR 25 — ENDLESS MODE BEGINS', color: '#ffd740' },
            50: { msg: '☠ FLOOR 50 — Legendary Territory', color: '#ff1744' },
            100: { msg: '👑 FLOOR 100 — IMMORTAL REALM', color: '#ffd740' },
        };
        if (milestones[this.floor]) {
            const m = milestones[this.floor];
            this.ui.notify(m.msg, m.color, 5);
            if (this.vfx) this.vfx.bossEntrance();
        }

        // Every 2 floors: Lucky Wheel!
        if (this.floor % 2 === 0 && this.luckWheel) {
            setTimeout(() => {
                this.luckWheel.open();
                this.ui.notify('🎡 Lucky Wheel!', '#ffd740', 2);
            }, 2500);
        }

        // Every 3 floors: free gacha pull!
        if (this.floor % 3 === 0) {
            this.ui.notify('✨ Floor Bonus: Free Gacha Pull!', '#ffd740', 3);
            setTimeout(() => {
                this.gacha.pull(this.floor, (reward) => {
                    if (reward.type === 'weapon') this.weaponPickup = reward.item;
                });
            }, this.floor % 2 === 0 ? 8000 : 2500); // Delay if wheel is also active
        }

        // Every 4 floors: Devil's Bargain
        if (this.floor % 4 === 0) {
            setTimeout(() => {
                this.curseSystem.offerDeal();
            }, 3000);
        }

        // Every 5 floors: boss floor + pet egg
        if (this.floor % 5 === 0) {
            this.ui.notify('⚠ BOSS FLOOR ⚠', '#ff1744', 4);
        }

        // Every 6 floors: free pet!
        if (this.floor % 6 === 0) {
            const rarities = ['uncommon', 'rare', 'epic'];
            const petRarity = Utils.randChoice(rarities);
            const petDef = this.petSystem.getRandomPet(petRarity);
            const pet = this.petSystem.addPet(petDef);
            this.ui.notify(`🐾 New Pet: ${pet.name}! [${pet.rarity}]`, pet.getRarityColor(), 4);
        }

        this.generateFloor();
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        if (this.state === 'title') {
            this.ui.drawTitleScreen(ctx, w, h);
            return;
        }

        if (this.state === 'soulforge') {
            if (this.meta) this.meta.drawUpgradeScreen(ctx, w, h, this.input);
            return;
        }

        if (!this.dungeon) return;

        // Camera transform
        ctx.save();
        ctx.translate(
            Math.floor(-this.camera.x + this.camera.halfW + Utils.shake.x),
            Math.floor(-this.camera.y + this.camera.halfH + Utils.shake.y)
        );

        // Dungeon
        this.dungeonRenderer.draw(ctx, this.dungeon, this.camera, 1/60);

        // Items (below entities)
        this.items.draw(ctx);

        // Enemies (with off-screen culling for performance)
        for (const enemy of this.enemies) {
            const dx = Math.abs(enemy.x - this.camera.x);
            const dy = Math.abs(enemy.y - this.camera.y);
            if (dx < this.camera.halfW + 100 && dy < this.camera.halfH + 100) {
                // Blue tint for aura-slowed enemies
                if (enemy._auraSlow) {
                    ctx.save();
                    ctx.filter = 'hue-rotate(180deg) brightness(1.2)';
                }
                enemy.draw(ctx);
                if (enemy._auraSlow) ctx.restore();
                enemy.drawProjectiles(ctx);
            }
        }

        // Combat visuals (swing arcs, projectiles, damage numbers)
        this.combat.draw(ctx);

        // Treasure Goblins
        if (this.goblinManager) this.goblinManager.draw(ctx);

        // Pet
        if (this.petSystem) this.petSystem.draw(ctx);

        // Player weapon
        this.combat.drawWeapon(ctx, this.player);

        // Player
        this.player.draw(ctx);

        // Biome ambient particles (in world space)
        if (this.biomeSystem) this.biomeSystem.drawAmbient(ctx);

        // Particles
        particles.draw(ctx);

        ctx.restore();

        // ---- Lighting overlay ----
        this.renderLighting();

        // ---- Screen flash ----
        if (Utils.flashAlpha > 0) {
            ctx.fillStyle = Utils.flashColor;
            ctx.globalAlpha = Utils.flashAlpha;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }

        // ---- Low HP vignette ----
        if (this.player && this.player.alive) {
            const hpPct = this.player.hp / this.player.maxHp;
            if (hpPct < 0.35) {
                const intensity = (0.35 - hpPct) / 0.35;
                const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 0.9;
                const vigAlpha = intensity * 0.5 * pulse;
                const grad = ctx.createRadialGradient(w/2, h/2, w*0.25, w/2, h/2, w*0.7);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(180,0,0,${vigAlpha})`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // ---- HUD ----
        if (this.state === 'playing' || this.state === 'dead') {
            this.ui.drawHUD(ctx, this.player, this.floor, this);
            if (this.skills) {
                this.skills.drawHUD(ctx, w, h);
            }
            if (this.killStreak) {
                this.killStreak.draw(ctx, w, h);
            }
            if (this.challenge) {
                this.challenge.draw(ctx, w, h);
            }
            if (this.achievements) {
                this.achievements.draw(ctx, w, h);
            }
            // Pet HUD
            if (this.petSystem) {
                this.petSystem.drawCollectionHUD(ctx, 20, h - 80);
            }
            // Curse/Blessing icons
            if (this.curseSystem) {
                this.curseSystem.drawHUD(ctx, 130, h - 80);
            }
            // Biome name
            if (this.biomeSystem) {
                this.biomeSystem.drawBiomeName(ctx, w, h);
            }
            // Floor modifier badge
            if (this.floorMods) {
                this.floorMods.draw(ctx, w, h);
            }
            // Combo finisher
            if (this.comboFinisher) {
                this.comboFinisher.drawHUD(ctx, w, h);
            }
            // Daily challenge
            if (this.dailyChallenge) {
                this.dailyChallenge.drawBadge(ctx, w);
            }
            // Ascension level
            if (this.ascension && this.ascension.level > 0) {
                ctx.textAlign = 'right';
                ctx.fillStyle = '#ffd740';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(`ASCENSION ${this.ascension.level}`, w - 20, 135);
            }
            // Save indicator
            if (this.saveSystem) this.saveSystem.drawSaveIndicator(ctx, w);
            // Tutorial
            if (this.tutorial) this.tutorial.draw(ctx, w, h);
        }

        // ---- Danger indicators ----
        if (this.state === 'playing') {
            this.ui.drawDangerIndicator(ctx, w, h, this.player, this.enemies);
        }

        // ---- Crosshair ----
        if (this.state === 'playing') {
            this.ui.drawCrosshair(ctx, this.input.mouse.x, this.input.mouse.y);
        }

        // ---- Class Select ----
        if (this.classSelect && this.classSelect.active) {
            this.classSelect.draw(ctx, w, h);
        }

        // ---- Codex ----
        if (this.codex && this.codex.showScreen) {
            this.codex.draw(ctx, w, h);
        }

        // ---- Lucky Wheel ----
        if (this.luckWheel && this.luckWheel.active) {
            this.luckWheel.draw(ctx, w, h);
        }

        // ---- Curse Deals ----
        if (this.curseSystem && this.curseSystem.offerActive) {
            this.curseSystem.draw(ctx, w, h);
        }

        // ---- Slot Machine ----
        if (this.slotMachine && this.slotMachine.active) {
            this.slotMachine.draw(ctx, w, h);
        }

        // ---- Weapon Forge ----
        if (this.forge && this.forge.active) {
            this.forge.draw(ctx, w, h, this.player);
        }

        // ---- Gacha UI ----
        if (this.gacha && this.gacha.active) {
            this.gacha.draw(ctx, w, h);
        }

        // ---- Event UI ----
        if (this.events && this.events.activeEvent) {
            this.events.draw(ctx, w, h);
        }

        // ---- Perk selection UI ----
        if (this.perks && this.perks.active) {
            this.perks.draw(ctx, w, h);
        }

        // ---- Weapon pickup UI ----
        if (this.weaponPickup) {
            const currentWeapon = this.player.weapons.length > 0 ?
                this.player.weapons[this.player.currentWeapon] : null;
            this.ui.drawWeaponPickup(ctx, w, h, this.weaponPickup, currentWeapon);
        }

        // ---- Floor transition ----
        this.ui.drawFloorTransition(ctx, w, h);

        // ---- VFX (screen-space effects) ----
        if (this.vfx) this.vfx.draw(ctx, w, h);

        // ---- Synergy notification ----
        if (this.synergySystem) this.synergySystem.draw(ctx, w, h);

        // ---- Stats overlay (Tab) ----
        if (this.showStats && this.state === 'playing') {
            const p = this.player;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(15, 100, 220, 280);
            ctx.strokeStyle = '#455a64';
            ctx.lineWidth = 1;
            ctx.strokeRect(15, 100, 220, 280);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#64ffda';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`${p.classIcon || ''} ${p.className || 'Adventurer'} Stats`, 25, 118);

            const stats = [
                ['HP', `${p.hp}/${p.maxHp}`, '#4caf50'],
                ['Attack', p.attack, '#ff5252'],
                ['Defense', p.defense, '#78909c'],
                ['Speed', Math.floor(p.speed), '#4fc3f7'],
                ['Crit %', Math.floor(p.critChance * 100) + '%', '#ffeb3b'],
                ['Crit DMG', p.critMultiplier.toFixed(1) + 'x', '#ff9800'],
                ['Lifesteal', Math.floor(p.lifesteal * 100) + '%', '#e91e63'],
                ['Kills', p.kills, '#ff5252'],
                ['Gold', Math.floor(p.gold), '#ffd740'],
                ['Level', p.level, '#64ffda'],
                ['Potions', p.potions, '#66bb6a'],
                ['Combo', `${p.combo} (best: ${p.maxCombo})`, '#ff4081'],
                ['Relics', p.relics ? p.relics.length : 0, '#b388ff'],
                ['Weapons', p.weapons.length, '#78909c'],
            ];

            for (let i = 0; i < stats.length; i++) {
                const [label, val, color] = stats[i];
                ctx.fillStyle = '#546e7a';
                ctx.font = '10px monospace';
                ctx.fillText(label, 25, 138 + i * 17);
                ctx.fillStyle = color;
                ctx.textAlign = 'right';
                ctx.fillText(String(val), 225, 138 + i * 17);
                ctx.textAlign = 'left';
            }

            ctx.fillStyle = '#37474f';
            ctx.font = '8px monospace';
            ctx.fillText('[TAB] close', 25, 375);
        }

        // ---- Victory screen ----
        if (this.state === 'victory') {
            ctx.fillStyle = 'rgba(0,0,10,0.9)';
            ctx.fillRect(0, 0, w, h);
            ctx.textAlign = 'center';

            // Title
            ctx.fillStyle = '#ffd740';
            ctx.font = 'bold 48px monospace';
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ffd740';
            ctx.fillText('VICTORY!', w / 2, h * 0.15);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#78909c';
            ctx.font = '16px monospace';
            ctx.fillText('You have conquered the Abyss!', w / 2, h * 0.22);

            // Stats
            const p = this.player;
            const sy = h * 0.30;
            ctx.font = '13px monospace';
            const stats = [
                [`${p.classIcon || ''} ${p.className || 'Hero'}`, '', '#e0e0e0'],
                ['Level', p.level, '#64ffda'],
                ['Kills', p.kills, '#ff5252'],
                ['Gold', Math.floor(p.gold), '#ffd740'],
                ['Best Combo', p.maxCombo, '#ff4081'],
                ['Relics', p.relics ? p.relics.length : 0, '#b388ff'],
                ['Pets', this.petSystem ? this.petSystem.collection.length : 0, '#e91e63'],
            ];
            for (let i = 0; i < stats.length; i++) {
                ctx.fillStyle = '#546e7a';
                ctx.textAlign = 'left';
                ctx.fillText(stats[i][0], w / 2 - 100, sy + i * 22);
                ctx.fillStyle = stats[i][2];
                ctx.textAlign = 'right';
                ctx.fillText(String(stats[i][1]), w / 2 + 100, sy + i * 22);
            }

            // Souls
            ctx.textAlign = 'center';
            ctx.fillStyle = '#b388ff';
            ctx.font = 'bold 18px monospace';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#b388ff';
            ctx.fillText(`+${this.soulsEarned || 0} Souls (2x Victory Bonus!)`, w / 2, h * 0.68);
            ctx.shadowBlur = 0;

            // Options
            if ((this.ui.victoryTimer || 0) > 2) {
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = '#ffd740';
                ctx.fillText('[ 1 ] Continue to Endless Mode', w / 2, h * 0.78);
                ctx.fillStyle = '#b388ff';
                ctx.fillText('[ 2 ] Soul Forge', w / 2, h * 0.83);
            }
        }

        // ---- Pause screen ----
        if (this.state === 'paused') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, w, h);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e0e0e0';
            ctx.font = 'bold 36px monospace';
            ctx.fillText('PAUSED', w / 2, h * 0.35);
            ctx.fillStyle = '#78909c';
            ctx.font = '14px monospace';
            ctx.fillText(`Floor ${this.floor} | ${this.player.className || 'Adventurer'} Lv.${this.player.level}`, w / 2, h * 0.42);
            const mins = Math.floor(this.playTime / 60);
            const secs = Math.floor(this.playTime % 60);
            ctx.fillText(`Kills: ${this.player.kills} | Gold: ${Math.floor(this.player.gold)} | Time: ${mins}m ${secs}s`, w / 2, h * 0.47);
            ctx.fillStyle = '#546e7a';
            ctx.font = '12px monospace';
            ctx.fillText('[ESC] Resume  |  [C] Codex', w / 2, h * 0.58);
            ctx.fillText('WASD Move | Click Attack | Space Dash', w / 2, h * 0.63);
            ctx.fillText('Q Potion | E Switch | R Forge | T Slots | F Finisher', w / 2, h * 0.67);
        }

        // ---- Death screen ----
        if (this.state === 'dead') {
            this.ui.drawDeathScreen(ctx, w, h, this.player, this.floor);
        }

        // FPS counter
        ctx.fillStyle = '#333';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${this.fps}`, 5, this.canvas.height - 5);
    }

    renderLighting() {
        const lctx = this.lightCtx;
        const w = this.lightCanvas.width;
        const h = this.lightCanvas.height;

        // Dark overlay
        // Biome-aware fog
        lctx.fillStyle = (this.biomeSystem && this.biomeSystem.current) ?
            this.biomeSystem.getFogColor() : 'rgba(0, 0, 0, 0.65)';
        lctx.fillRect(0, 0, w, h);

        // Subtract light sources
        lctx.globalCompositeOperation = 'destination-out';

        // Player light
        const px = this.player.x - this.camera.x + this.camera.halfW + Utils.shake.x;
        const py = this.player.y - this.camera.y + this.camera.halfH + Utils.shake.y;
        const playerLightSize = 120 + Math.sin(Date.now() * 0.003) * 10;

        const playerGrad = lctx.createRadialGradient(px, py, 0, px, py, playerLightSize);
        playerGrad.addColorStop(0, 'rgba(0,0,0,1)');
        playerGrad.addColorStop(0.5, 'rgba(0,0,0,0.8)');
        playerGrad.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = playerGrad;
        lctx.fillRect(px - playerLightSize, py - playerLightSize, playerLightSize * 2, playerLightSize * 2);

        // Torch lights
        for (const torch of this.dungeon.torches) {
            const tx = torch.x - this.camera.x + this.camera.halfW + Utils.shake.x;
            const ty = torch.y - this.camera.y + this.camera.halfH + Utils.shake.y;

            // Skip if off screen
            if (tx < -100 || tx > w + 100 || ty < -100 || ty > h + 100) continue;

            const flicker = 60 + Math.sin(Date.now() * 0.008 + torch.x) * 10;
            const grad = lctx.createRadialGradient(tx, ty, 0, tx, ty, flicker);
            grad.addColorStop(0, 'rgba(0,0,0,0.9)');
            grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            lctx.fillStyle = grad;
            lctx.fillRect(tx - flicker, ty - flicker, flicker * 2, flicker * 2);
        }

        // Boss glow
        for (const enemy of this.enemies) {
            if (enemy.isBoss && enemy.alive) {
                const ex = enemy.x - this.camera.x + this.camera.halfW + Utils.shake.x;
                const ey = enemy.y - this.camera.y + this.camera.halfH + Utils.shake.y;
                const bossGlow = 80;
                const grad = lctx.createRadialGradient(ex, ey, 0, ex, ey, bossGlow);
                grad.addColorStop(0, 'rgba(0,0,0,0.6)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                lctx.fillStyle = grad;
                lctx.fillRect(ex - bossGlow, ey - bossGlow, bossGlow * 2, bossGlow * 2);
            }
        }

        lctx.globalCompositeOperation = 'source-over';

        // Apply lighting
        this.ctx.drawImage(this.lightCanvas, 0, 0);
    }
}

// ---- Launch ----
const game = new Game();
