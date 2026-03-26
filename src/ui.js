// ============================================
// UI - HUD, Menus, and interface
// ============================================

class GameUI {
    constructor(canvas) {
        this.canvas = canvas;
        this.notifications = [];
        this.weaponPickupUI = null;
        this.minimap = true;
        this.showStats = false;
        this.deathScreen = false;
        this.deathTimer = 0;
        this.floorTransition = null;
        this.titleScreen = true;
        this.titleAlpha = 1;
        this.titleTimer = 0;
        this.pauseMenu = false;
    }

    update(dt) {
        // Notifications
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].life -= dt;
            if (this.notifications[i].life <= 0) {
                this.notifications.splice(i, 1);
            }
        }

        // Title screen
        if (this.titleScreen) {
            this.titleTimer += dt;
        }

        // Death screen
        if (this.deathScreen) {
            this.deathTimer += dt;
        }

        // Floor transition
        if (this.floorTransition) {
            this.floorTransition.timer += dt;
            if (this.floorTransition.timer > this.floorTransition.duration) {
                this.floorTransition = null;
            }
        }
    }

    notify(text, color = '#fff', duration = 3) {
        this.notifications.push({ text, color, life: duration, maxLife: duration });
    }

    startFloorTransition(floor) {
        this.floorTransition = {
            floor,
            timer: 0,
            duration: 2.0,
        };
    }

    drawHUD(ctx, player, floor, game) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();

        // ---- HP Bar ----
        const hpBarW = 200;
        const hpBarH = 16;
        const hpX = 20;
        const hpY = 20;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4);

        // Trailing HP bar (shows recent damage)
        if (!this._trailHp) this._trailHp = player.hp;
        if (player.hp < this._trailHp) {
            this._trailHp -= (this._trailHp - player.hp) * 0.05; // Slow catch up
        } else {
            this._trailHp = player.hp;
        }
        const trailPercent = this._trailHp / player.maxHp;
        ctx.fillStyle = 'rgba(255,82,82,0.5)';
        ctx.fillRect(hpX, hpY, hpBarW * trailPercent, hpBarH);

        // HP fill
        const hpPercent = player.hp / player.maxHp;
        const hpGradient = ctx.createLinearGradient(hpX, hpY, hpX + hpBarW * hpPercent, hpY);
        if (hpPercent > 0.5) {
            hpGradient.addColorStop(0, '#4caf50');
            hpGradient.addColorStop(1, '#66bb6a');
        } else if (hpPercent > 0.25) {
            hpGradient.addColorStop(0, '#ff9800');
            hpGradient.addColorStop(1, '#ffa726');
        } else {
            hpGradient.addColorStop(0, '#f44336');
            hpGradient.addColorStop(1, '#ef5350');
        }
        ctx.fillStyle = hpGradient;
        ctx.fillRect(hpX, hpY, hpBarW * hpPercent, hpBarH);

        // HP text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.hp}/${player.maxHp}`, hpX + hpBarW / 2, hpY + 12);

        // HP icon
        ctx.fillStyle = '#f44336';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('♥', hpX - 0, hpY - 4);

        // ---- XP Bar ----
        const xpBarW = 200;
        const xpBarH = 6;
        const xpY = hpY + hpBarH + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(hpX, xpY, xpBarW, xpBarH);
        const xpPercent = player.xp / player.xpToLevel;
        ctx.fillStyle = '#64ffda';
        ctx.fillRect(hpX, xpY, xpBarW * xpPercent, xpBarH);

        // Level + class
        ctx.fillStyle = '#64ffda';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        const classIcon = player.classIcon || '';
        ctx.fillText(`${classIcon} Lv.${player.level}`, hpX, xpY + 16);

        // ---- Dash cooldown ----
        const dashY = xpY + 22;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(hpX, dashY, 60, 4);
        const dashPercent = 1 - (player.dashCooldown / player.dashMaxCooldown);
        ctx.fillStyle = dashPercent >= 1 ? '#64ffda' : '#455a64';
        ctx.fillRect(hpX, dashY, 60 * Math.min(dashPercent, 1), 4);
        ctx.fillStyle = '#78909c';
        ctx.font = '9px monospace';
        ctx.fillText('DASH [SPACE]', hpX, dashY + 12);

        // ---- Relics (below dash) ----
        if (player.relics && player.relics.length > 0) {
            ctx.textAlign = 'left';
            ctx.font = '14px monospace';
            const relicY = dashY + 20;
            for (let i = 0; i < Math.min(player.relics.length, 8); i++) {
                ctx.fillText(player.relics[i].icon, hpX + i * 18, relicY);
            }
            if (player.relics.length > 8) {
                ctx.fillStyle = '#546e7a';
                ctx.font = '9px monospace';
                ctx.fillText(`+${player.relics.length - 8}`, hpX + 8 * 18, relicY);
            }
        }

        // ---- Floor & Stats (top right) ----
        ctx.textAlign = 'right';
        ctx.fillStyle = '#78909c';
        ctx.font = 'bold 14px monospace';
        const biomeIcons = { crypt: '🏚', inferno: '🔥', void: '🌀', abyss: '🌑', heaven: '✨' };
        const biomeId = (typeof game !== 'undefined' && game.biomeSystem?.current?.id) || 'crypt';
        const biomeIcon = biomeIcons[biomeId] || '';
        ctx.fillText(`${biomeIcon} Floor ${floor}`, w - 20, 30);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#ffd740';
        ctx.fillText(`Gold: ${player.gold}`, w - 20, 48);
        ctx.fillStyle = '#ff5252';
        ctx.fillText(`Kills: ${player.kills}`, w - 20, 63);

        // ATK/DEF/CRIT stats
        ctx.fillStyle = '#546e7a';
        ctx.font = '9px monospace';
        ctx.fillText(`ATK:${player.attack} DEF:${player.defense} CRIT:${Math.floor(player.critChance * 100)}%`, w - 20, 78);

        // ---- Potions (bottom left) ----
        const potY = h - 50;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(18, potY - 2, 80, 30);
        ctx.fillStyle = '#66bb6a';
        ctx.font = '12px monospace';
        ctx.fillText(`🧪 x${player.potions}`, 24, potY + 14);
        ctx.fillStyle = '#546e7a';
        ctx.font = '9px monospace';
        ctx.fillText('[Q]', 24, potY + 24);

        // ---- Weapon info (bottom center) ----
        if (player.weapons.length > 0) {
            const weapon = player.weapons[player.currentWeapon];
            const wbX = w / 2;
            const wbY = h - 40;

            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(wbX - 100, wbY - 10, 200, 35);

            ctx.fillStyle = weapon.getRarityColor();
            ctx.font = 'bold 12px monospace';
            ctx.fillText(weapon.getDisplayName(), wbX, wbY + 4);

            ctx.fillStyle = '#78909c';
            ctx.font = '10px monospace';
            const totalDmg = weapon.damage + player.attack;
            const dps = (totalDmg / weapon.cooldown).toFixed(0);

            // Weapon set bonus check
            const sameTypeCount = player.weapons.filter(w => w.type === weapon.type).length;
            const setBonus = sameTypeCount >= 2 ? ' [SET +15%]' : '';
            if (sameTypeCount >= 2 && !weapon._setApplied) {
                weapon._setApplied = true; // Mark to avoid re-applying
            }

            ctx.fillText(`DMG:${totalDmg} DPS:${dps}${setBonus}  |  [E] Switch  |  [Click] Attack`, wbX, wbY + 18);
        }

        // ---- Combo counter ----
        if (player.combo >= 3) {
            const comboX = w / 2;
            const comboY = 80;
            const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 1;
            const comboColor = player.combo >= 20 ? '#ff1744' :
                              player.combo >= 10 ? '#ff9100' :
                              player.combo >= 6 ? '#ffea00' : '#64ffda';

            ctx.save();
            ctx.translate(comboX, comboY);
            ctx.scale(pulse, pulse);
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px monospace';
            ctx.fillStyle = comboColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = comboColor;
            ctx.fillText(`${player.combo} COMBO`, 0, 0);
            ctx.font = '12px monospace';
            ctx.fillStyle = '#fff';
            ctx.fillText(`x${player.getComboMultiplier().toFixed(1)}`, 0, 16);
            ctx.restore();
        }

        // ---- Boss HP Bar ----
        if (game.enemies) {
            for (const enemy of game.enemies) {
                if (enemy.isBoss && enemy.alive) {
                    this.drawBossBar(ctx, w, h, enemy);
                    break;
                }
            }
        }

        // ---- Minimap ----
        if (this.minimap && game.dungeon) {
            this.drawMinimap(ctx, game.dungeon, player, w, h, game.enemies);
        }

        // ---- Notifications ----
        for (let i = 0; i < this.notifications.length; i++) {
            const notif = this.notifications[i];
            const alpha = Math.min(notif.life, 1);
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#000';
            ctx.fillText(notif.text, w / 2 + 1, 130 + i * 24 + 1);
            ctx.fillStyle = notif.color;
            ctx.fillText(notif.text, w / 2, 130 + i * 24);
        }
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    drawBossBar(ctx, w, h, boss) {
        const barW = 400;
        const barH = 20;
        const x = (w - barW) / 2;
        const y = h - 140;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - 4, y - 22, barW + 8, barH + 30);

        // Boss name
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 12px monospace';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff1744';
        ctx.fillText(boss.name, w / 2, y - 6);
        ctx.shadowBlur = 0;

        // HP bar background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y, barW, barH);

        // HP fill
        const hpPct = boss.hp / boss.maxHp;
        const grad = ctx.createLinearGradient(x, y, x + barW * hpPct, y);
        grad.addColorStop(0, '#d50000');
        grad.addColorStop(1, '#ff5252');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW * hpPct, barH);

        // HP text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${boss.hp} / ${boss.maxHp}`, w / 2, y + 14);

        // Phase indicator
        if (boss.phase >= 2) {
            ctx.fillStyle = '#ff6d00';
            ctx.font = 'bold 9px monospace';
            ctx.fillText('ENRAGED', w / 2, y + barH + 12);
        }

        // Border
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, barH);
    }

    drawMinimap(ctx, dungeon, player, canvasW, canvasH, enemies) {
        const mapSize = 130;
        const mx = canvasW - mapSize - 12;
        const my = canvasH - mapSize - 12;
        const scale = mapSize / Math.max(dungeon.width, dungeon.height);

        // Track explored tiles (fog of war)
        if (!dungeon._explored) dungeon._explored = {};
        const ptx = Math.floor(player.x / TILE_SIZE);
        const pty = Math.floor(player.y / TILE_SIZE);

        // Compass relic: reveal full map
        if (player.fullMapReveal && !dungeon._fullRevealed) {
            dungeon._fullRevealed = true;
            for (let y = 0; y < dungeon.height; y++) {
                for (let x = 0; x < dungeon.width; x++) {
                    dungeon._explored[`${x},${y}`] = true;
                }
            }
        }

        const revealRadius = 8;
        for (let dy = -revealRadius; dy <= revealRadius; dy++) {
            for (let dx = -revealRadius; dx <= revealRadius; dx++) {
                const ex = ptx + dx, ey = pty + dy;
                if (ex >= 0 && ex < dungeon.width && ey >= 0 && ey < dungeon.height) {
                    dungeon._explored[`${ex},${ey}`] = true;
                }
            }
        }

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(mx - 2, my - 2, mapSize + 4, mapSize + 4);
        ctx.strokeStyle = '#263238';
        ctx.strokeRect(mx - 2, my - 2, mapSize + 4, mapSize + 4);

        for (let y = 0; y < dungeon.height; y++) {
            for (let x = 0; x < dungeon.width; x++) {
                const tile = dungeon.tiles[y][x];
                if (tile === TILE.VOID) continue;

                const explored = dungeon._explored[`${x},${y}`];
                if (!explored) continue; // Fog of war

                let color;
                switch (tile) {
                    case TILE.WALL: color = '#3a3a4a'; break;
                    case TILE.STAIRS_DOWN: color = '#4a90d9'; break;
                    case TILE.CHEST: color = '#ffd740'; break;
                    case TILE.WATER: color = '#1a3a5a'; break;
                    default: color = '#1a1a2a'; break;
                }

                ctx.fillStyle = color;
                ctx.fillRect(mx + x * scale, my + y * scale, Math.max(scale, 1), Math.max(scale, 1));
            }
        }

        // Enemy positions (only show nearby or in explored areas)
        if (enemies) {
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                const etx = Math.floor(enemy.x / TILE_SIZE);
                const ety = Math.floor(enemy.y / TILE_SIZE);
                if (!dungeon._explored[`${etx},${ety}`]) continue;

                const ex = mx + (enemy.x / TILE_SIZE) * scale;
                const ey = my + (enemy.y / TILE_SIZE) * scale;
                ctx.fillStyle = enemy.isBoss ? '#ff1744' : enemy.isElite ? '#ff9800' : '#ff5252';
                const eSize = enemy.isBoss ? 3.5 : enemy.isElite ? 2.5 : 1.5;
                ctx.fillRect(ex - eSize / 2, ey - eSize / 2, eSize, eSize);
            }
        }

        // Player position (pulsing)
        const px = mx + (player.x / TILE_SIZE) * scale;
        const py = my + (player.y / TILE_SIZE) * scale;
        const pulse = Math.sin(Date.now() * 0.006) * 0.5 + 1.5;
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(px - pulse, py - pulse, pulse * 2, pulse * 2);
    }

    // Enemy proximity danger indicator
    drawDangerIndicator(ctx, w, h, player, enemies) {
        if (!enemies) return;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const dist = Utils.dist(player.x, player.y, enemy.x, enemy.y);
            if (dist > 120 && dist < 250) {
                // Off-screen enemy indicator
                const angle = Utils.angle(player.x, player.y, enemy.x, enemy.y);
                const edgeX = w / 2 + Math.cos(angle) * Math.min(w, h) * 0.38;
                const edgeY = h / 2 + Math.sin(angle) * Math.min(w, h) * 0.38;

                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(angle);
                ctx.fillStyle = enemy.isBoss ? 'rgba(255,23,68,0.5)' : 'rgba(255,82,82,0.2)';
                ctx.beginPath();
                ctx.moveTo(8, 0);
                ctx.lineTo(-4, -5);
                ctx.lineTo(-4, 5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
    }

    drawTitleScreen(ctx, w, h) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        // Animated background particles
        const time = this.titleTimer;
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(i * 7.3 + time * 0.3) * 0.5 + 0.5) * w;
            const y = (Math.cos(i * 4.7 + time * 0.2) * 0.5 + 0.5) * h;
            const size = Math.sin(i + time) * 1.5 + 2;
            ctx.fillStyle = `rgba(100, 255, 218, ${0.1 + Math.sin(i + time) * 0.05})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        const titleY = h * 0.3;
        ctx.textAlign = 'center';

        // Shadow
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 48px monospace';
        ctx.fillText('ABYSSAL', w / 2 + 3, titleY + 3);
        ctx.fillText('DESCENT', w / 2 + 3, titleY + 58);

        // Main title
        const titleGlow = Math.sin(time * 2) * 0.3 + 0.7;
        ctx.shadowBlur = 20 * titleGlow;
        ctx.shadowColor = '#64ffda';
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText('ABYSSAL', w / 2, titleY);
        ctx.fillStyle = '#64ffda';
        ctx.fillText('DESCENT', w / 2, titleY + 55);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '14px monospace';
        ctx.fillStyle = '#546e7a';
        ctx.fillText('A Roguelike Dungeon Crawler', w / 2, titleY + 85);

        // Menu options
        const menuY = h * 0.55;
        const hasSave = typeof game !== 'undefined' && game.saveSystem && game.saveSystem.hasSave;
        const menuItems = [
            { text: '[ 1 ] New Run', color: '#64ffda' },
            { text: '[ 2 ] Daily Challenge', color: '#ffd740' },
            { text: '[ 3 ] Soul Forge', color: '#b388ff' },
        ];
        if (hasSave) {
            menuItems.push({ text: '[ 4 ] Continue', color: '#4caf50' });
        }

        for (let i = 0; i < menuItems.length; i++) {
            const item = menuItems[i];
            const pulse = Math.sin(time * 2 + i * 0.5) * 0.1 + 0.9;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = item.color;
            ctx.font = 'bold 16px monospace';
            ctx.fillText(item.text, w / 2, menuY + i * 32);
        }
        ctx.globalAlpha = 1;

        // Meta stats
        if (typeof game !== 'undefined' && game.meta) {
            const meta = game.meta.data;
            if (meta.totalRuns > 0) {
                ctx.fillStyle = '#37474f';
                ctx.font = '10px monospace';
                ctx.fillText(`Runs: ${meta.totalRuns} | Best Floor: ${meta.bestFloor} | Kills: ${meta.totalKills} | Souls: ${meta.souls}`, w / 2, menuY + 100);

                // Best class info
                if (meta.classesPlayed) {
                    const classes = Object.keys(meta.classesPlayed);
                    ctx.fillStyle = '#2e3440';
                    ctx.fillText(`Classes: ${classes.join(', ')}`, w / 2, menuY + 116);
                }

                // Codex progress
                if (typeof game.codex !== 'undefined') {
                    ctx.fillStyle = '#2e3440';
                    ctx.fillText(`Codex: ${game.codex.getCompletionPercent()}%`, w / 2, menuY + 132);
                }
            }
            if (typeof game.ascension !== 'undefined' && game.ascension.level > 0) {
                ctx.fillStyle = '#ffd740';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(`★ Ascension ${game.ascension.level} ★`, w / 2, menuY + 148);
            }
        }

        // Controls
        const ctrlY = h * 0.85;
        ctx.fillStyle = '#37474f';
        ctx.font = '10px monospace';
        ctx.fillText('WASD Move | Click Attack | Space Dash | Q Potion | E Switch | R Forge | T Slots | F Finisher | C Codex', w / 2, ctrlY);

        // Version
        ctx.fillStyle = '#1a1a2e';
        ctx.font = '10px monospace';
        ctx.fillText('v0.5.0 — Abyssal Descent', w / 2, h - 15);
    }

    drawDeathScreen(ctx, w, h, player, floor) {
        const alpha = Math.min(this.deathTimer * 0.5, 0.85);
        ctx.fillStyle = `rgba(8, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, w, h);

        if (this.deathTimer > 1) {
            ctx.textAlign = 'center';

            // YOU DIED
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ff1744';
            ctx.fillStyle = '#ff1744';
            ctx.font = 'bold 48px monospace';
            ctx.fillText('YOU DIED', w / 2, h * 0.18);
            ctx.shadowBlur = 0;

            // Run stats card
            const cardW = 350;
            const cardH = 280;
            const cardX = w / 2 - cardW / 2;
            const cardY = h * 0.24;

            ctx.fillStyle = 'rgba(15,10,20,0.9)';
            ctx.fillRect(cardX, cardY, cardW, cardH);
            ctx.strokeStyle = '#ff1744';
            ctx.lineWidth = 1;
            ctx.strokeRect(cardX, cardY, cardW, cardH);

            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#78909c';
            const classText = player.className ? `— ${player.classIcon || ''} ${player.className} Run —` : '— RUN SUMMARY —';
            ctx.fillText(classText, w / 2, cardY + 22);

            // Stats with icons
            const stats = [
                { icon: '⬇', label: 'Floor', value: floor, color: '#4fc3f7' },
                { icon: '⭐', label: 'Level', value: player.level, color: '#64ffda' },
                { icon: '💀', label: 'Kills', value: player.kills, color: '#ff5252' },
                { icon: '💰', label: 'Gold', value: Math.floor(player.gold), color: '#ffd740' },
                { icon: '🔗', label: 'Best Combo', value: player.maxCombo, color: '#ff4081' },
                { icon: '🎒', label: 'Relics', value: player.relics ? player.relics.length : 0, color: '#b388ff' },
            ];

            for (let i = 0; i < stats.length; i++) {
                const s = stats[i];
                const sy = cardY + 42 + i * 24;
                ctx.fillStyle = '#546e7a';
                ctx.font = '12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`${s.icon} ${s.label}`, cardX + 30, sy);
                ctx.fillStyle = s.color;
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(s.value.toString(), cardX + cardW - 30, sy);
            }

            // Souls earned
            ctx.textAlign = 'center';
            const soulsEarned = (typeof game !== 'undefined' && game.soulsEarned) || 0;
            if (soulsEarned > 0) {
                const soulY = cardY + 42 + stats.length * 24 + 15;
                ctx.fillStyle = 'rgba(179,136,255,0.2)';
                ctx.fillRect(cardX + 15, soulY - 12, cardW - 30, 28);

                ctx.fillStyle = '#b388ff';
                ctx.font = 'bold 16px monospace';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#b388ff';
                ctx.fillText(`+${soulsEarned} Souls Earned`, w / 2, soulY + 6);
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#7c4dff';
                ctx.font = '9px monospace';
                const totalSouls = (typeof game !== 'undefined' && game.meta) ? game.meta.data.souls : 0;
                ctx.fillText(`Total: ${totalSouls} souls`, w / 2, soulY + 20);
            }

            // Milestone unlocks
            if (typeof game !== 'undefined' && game.milestoneUnlocks && game.milestoneUnlocks.length > 0) {
                const unlockY = cardY + cardH - 40;
                ctx.fillStyle = '#ffd740';
                ctx.font = 'bold 10px monospace';
                ctx.fillText('✨ NEW UNLOCKS:', w / 2, unlockY);
                for (let i = 0; i < game.milestoneUnlocks.length; i++) {
                    ctx.fillStyle = '#ffd740';
                    ctx.font = '9px monospace';
                    ctx.fillText(game.milestoneUnlocks[i], w / 2, unlockY + 14 + i * 12);
                }
            }

            // Options
            if (this.deathTimer > 2.5) {
                const optY = h * 0.78;
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = '#64ffda';
                ctx.fillText('[ 1 ] Try Again', w / 2 - 100, optY);
                ctx.fillStyle = '#b388ff';
                ctx.fillText('[ 2 ] Soul Forge', w / 2 + 100, optY);

                ctx.fillStyle = '#37474f';
                ctx.font = '10px monospace';
                ctx.fillText('or click anywhere', w / 2, optY + 22);
            }
        }
    }

    drawFloorTransition(ctx, w, h) {
        if (!this.floorTransition) return;

        const t = this.floorTransition.timer / this.floorTransition.duration;
        let alpha;
        if (t < 0.3) {
            alpha = t / 0.3;
        } else if (t > 0.7) {
            alpha = (1 - t) / 0.3;
        } else {
            alpha = 1;
        }

        ctx.fillStyle = `rgba(10, 10, 15, ${alpha})`;
        ctx.fillRect(0, 0, w, h);

        if (alpha > 0.5) {
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(100, 255, 218, ${alpha})`;
            ctx.font = 'bold 36px monospace';
            ctx.fillText(`Floor ${this.floorTransition.floor}`, w / 2, h / 2);

            ctx.fillStyle = `rgba(120, 144, 156, ${alpha * 0.7})`;
            ctx.font = '14px monospace';
            ctx.fillText('Descending deeper...', w / 2, h / 2 + 35);
        }
    }

    drawWeaponPickup(ctx, w, h, weapon, currentWeapon) {
        if (!weapon) return;

        const cx = w / 2;
        const cy = h / 2;
        const boxW = 320;
        const boxH = 200;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(20,20,30,0.95)';
        ctx.strokeStyle = weapon.getRarityColor();
        ctx.lineWidth = 2;
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = weapon.getRarityColor();
        ctx.font = 'bold 16px monospace';
        ctx.fillText(weapon.getDisplayName(), cx, cy - 65);

        ctx.fillStyle = '#78909c';
        ctx.font = '11px monospace';
        ctx.fillText(`[${weapon.rarity.toUpperCase()}]`, cx, cy - 48);

        // Stats
        ctx.font = '13px monospace';
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(`Damage: ${weapon.damage}  |  Type: ${weapon.weaponType}`, cx, cy - 20);
        ctx.fillText(`Range: ${weapon.range}  |  Speed: ${(1 / weapon.cooldown).toFixed(1)}/s`, cx, cy);

        if (weapon.effects.length > 0) {
            ctx.fillStyle = '#ffd740';
            ctx.fillText(`Effects: ${weapon.effects.join(', ')}`, cx, cy + 20);
        }

        // Compare with current
        if (currentWeapon) {
            ctx.fillStyle = '#546e7a';
            ctx.font = '10px monospace';
            const dmgDiff = weapon.damage - currentWeapon.damage;
            const dmgColor = dmgDiff > 0 ? '#4caf50' : dmgDiff < 0 ? '#f44336' : '#78909c';
            ctx.fillStyle = dmgColor;
            ctx.fillText(
                `vs current: ${dmgDiff > 0 ? '+' : ''}${dmgDiff} damage`,
                cx, cy + 45
            );
        }

        // Actions
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#4caf50';
        ctx.fillText('[F] Equip', cx - 60, cy + 75);
        ctx.fillStyle = '#f44336';
        ctx.fillText('[X] Discard', cx + 60, cy + 75);
    }

    drawCrosshair(ctx, mouseX, mouseY) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;

        // Cross
        const size = 8;
        ctx.beginPath();
        ctx.moveTo(mouseX - size, mouseY);
        ctx.lineTo(mouseX - 3, mouseY);
        ctx.moveTo(mouseX + 3, mouseY);
        ctx.lineTo(mouseX + size, mouseY);
        ctx.moveTo(mouseX, mouseY - size);
        ctx.lineTo(mouseX, mouseY - 3);
        ctx.moveTo(mouseX, mouseY + 3);
        ctx.lineTo(mouseX, mouseY + size);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
