// ============================================
// DUNGEON - Procedural dungeon generation
// ============================================

const TILE = {
    VOID: 0,
    FLOOR: 1,
    WALL: 2,
    DOOR: 3,
    STAIRS_DOWN: 4,
    WATER: 5,
    LAVA: 6,
    CHEST: 7,
    TORCH: 8,
    TRAP: 9,
    PILLAR: 10,
};

const TILE_SIZE = 32;

class Room {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.centerX = Math.floor(x + w / 2);
        this.centerY = Math.floor(y + h / 2);
        this.connected = false;
        this.type = 'normal'; // normal, treasure, boss, shop, shrine
        this.enemies = [];
        this.cleared = false;
    }

    intersects(other, padding = 1) {
        return this.x - padding < other.x + other.w + padding &&
               this.x + this.w + padding > other.x - padding &&
               this.y - padding < other.y + other.h + padding &&
               this.y + this.h + padding > other.y - padding;
    }

    contains(px, py) {
        return px >= this.x && px < this.x + this.w &&
               py >= this.y && py < this.y + this.h;
    }
}

class DungeonGenerator {
    constructor(width, height, floor) {
        this.width = width;
        this.height = height;
        this.floor = floor;
        this.tiles = [];
        this.rooms = [];
        this.spawnPoint = null;
        this.exitPoint = null;
        this.torches = [];
        this.traps = [];
        this.decorations = [];
    }

    generate() {
        // Initialize with void
        this.tiles = Array(this.height).fill(null).map(() => Array(this.width).fill(TILE.VOID));

        // Generate rooms
        const roomCount = Utils.randInt(8 + this.floor, 14 + this.floor * 2);
        const maxAttempts = 500;

        for (let i = 0; i < maxAttempts && this.rooms.length < roomCount; i++) {
            const w = Utils.randInt(5, 12);
            const h = Utils.randInt(5, 10);
            const x = Utils.randInt(2, this.width - w - 2);
            const y = Utils.randInt(2, this.height - h - 2);
            const room = new Room(x, y, w, h);

            let overlaps = false;
            for (const other of this.rooms) {
                if (room.intersects(other, 2)) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                this.rooms.push(room);
            }
        }

        // Assign room types
        this.assignRoomTypes();

        // Carve rooms
        for (const room of this.rooms) {
            this.carveRoom(room);
        }

        // Connect rooms with corridors (MST-based)
        this.connectRooms();

        // Place walls
        this.placeWalls();

        // Place decorations
        this.placeDecorations();

        // Place spawn and exit
        this.spawnPoint = {
            x: this.rooms[0].centerX * TILE_SIZE + TILE_SIZE / 2,
            y: this.rooms[0].centerY * TILE_SIZE + TILE_SIZE / 2
        };

        const lastRoom = this.rooms[this.rooms.length - 1];
        this.exitPoint = { x: lastRoom.centerX, y: lastRoom.centerY };
        this.tiles[lastRoom.centerY][lastRoom.centerX] = TILE.STAIRS_DOWN;

        return {
            tiles: this.tiles,
            rooms: this.rooms,
            spawnPoint: this.spawnPoint,
            exitPoint: this.exitPoint,
            torches: this.torches,
            traps: this.traps,
            width: this.width,
            height: this.height,
        };
    }

    assignRoomTypes() {
        if (this.rooms.length < 3) return;

        // First room is always spawn (normal)
        // Last room is always stairs

        // Randomly assign special rooms
        const middleRooms = this.rooms.slice(1, -1);
        const shuffled = [...middleRooms].sort(() => Math.random() - 0.5);

        if (shuffled.length > 0) shuffled[0].type = 'treasure';
        if (shuffled.length > 2) shuffled[2].type = 'shrine';

        // Boss room on certain floors
        if (this.floor % 5 === 0 && this.rooms.length > 2) {
            this.rooms[this.rooms.length - 1].type = 'boss';
        }
    }

    carveRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                this.tiles[y][x] = TILE.FLOOR;
            }
        }

        // Add room features based on type
        if (room.type === 'treasure') {
            // Place chest in center
            this.tiles[room.centerY][room.centerX] = TILE.CHEST;
            // Pillars in corners
            if (room.w >= 6 && room.h >= 6) {
                this.tiles[room.y + 1][room.x + 1] = TILE.PILLAR;
                this.tiles[room.y + 1][room.x + room.w - 2] = TILE.PILLAR;
                this.tiles[room.y + room.h - 2][room.x + 1] = TILE.PILLAR;
                this.tiles[room.y + room.h - 2][room.x + room.w - 2] = TILE.PILLAR;
            }
        }

        if (room.type === 'shrine') {
            // Water pool in center
            for (let y = room.centerY - 1; y <= room.centerY + 1; y++) {
                for (let x = room.centerX - 1; x <= room.centerX + 1; x++) {
                    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                        this.tiles[y][x] = TILE.WATER;
                    }
                }
            }
        }
    }

    connectRooms() {
        // Use Prim's MST to connect rooms
        const connected = new Set([0]);
        const edges = [];

        while (connected.size < this.rooms.length) {
            let bestDist = Infinity;
            let bestFrom = -1;
            let bestTo = -1;

            for (const i of connected) {
                for (let j = 0; j < this.rooms.length; j++) {
                    if (connected.has(j)) continue;
                    const dist = Utils.dist(
                        this.rooms[i].centerX, this.rooms[i].centerY,
                        this.rooms[j].centerX, this.rooms[j].centerY
                    );
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestFrom = i;
                        bestTo = j;
                    }
                }
            }

            if (bestTo === -1) break;
            connected.add(bestTo);
            edges.push([bestFrom, bestTo]);
            this.carveCorridor(this.rooms[bestFrom], this.rooms[bestTo]);
        }

        // Add a few extra connections for loops (more interesting layouts)
        const extraConnections = Utils.randInt(1, 3);
        for (let i = 0; i < extraConnections; i++) {
            const a = Utils.randInt(0, this.rooms.length - 1);
            const b = Utils.randInt(0, this.rooms.length - 1);
            if (a !== b) {
                this.carveCorridor(this.rooms[a], this.rooms[b]);
            }
        }
    }

    carveCorridor(roomA, roomB) {
        let x = roomA.centerX;
        let y = roomA.centerY;
        const tx = roomB.centerX;
        const ty = roomB.centerY;

        // L-shaped corridor
        const horizontalFirst = Math.random() > 0.5;

        if (horizontalFirst) {
            while (x !== tx) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    if (this.tiles[y][x] === TILE.VOID) this.tiles[y][x] = TILE.FLOOR;
                    // Widen corridor slightly
                    if (y + 1 < this.height && this.tiles[y + 1][x] === TILE.VOID) {
                        this.tiles[y + 1][x] = TILE.FLOOR;
                    }
                }
                x += x < tx ? 1 : -1;
            }
            while (y !== ty) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    if (this.tiles[y][x] === TILE.VOID) this.tiles[y][x] = TILE.FLOOR;
                    if (x + 1 < this.width && this.tiles[y][x + 1] === TILE.VOID) {
                        this.tiles[y][x + 1] = TILE.FLOOR;
                    }
                }
                y += y < ty ? 1 : -1;
            }
        } else {
            while (y !== ty) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    if (this.tiles[y][x] === TILE.VOID) this.tiles[y][x] = TILE.FLOOR;
                    if (x + 1 < this.width && this.tiles[y][x + 1] === TILE.VOID) {
                        this.tiles[y][x + 1] = TILE.FLOOR;
                    }
                }
                y += y < ty ? 1 : -1;
            }
            while (x !== tx) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    if (this.tiles[y][x] === TILE.VOID) this.tiles[y][x] = TILE.FLOOR;
                    if (y + 1 < this.height && this.tiles[y + 1][x] === TILE.VOID) {
                        this.tiles[y + 1][x] = TILE.FLOOR;
                    }
                }
                x += x < tx ? 1 : -1;
            }
        }
    }

    placeWalls() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.tiles[y][x] !== TILE.VOID) continue;

                // Check if adjacent to floor
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            if (this.tiles[ny][nx] === TILE.FLOOR ||
                                this.tiles[ny][nx] === TILE.WATER ||
                                this.tiles[ny][nx] === TILE.CHEST ||
                                this.tiles[ny][nx] === TILE.STAIRS_DOWN) {
                                this.tiles[y][x] = TILE.WALL;
                                break;
                            }
                        }
                    }
                    if (this.tiles[y][x] === TILE.WALL) break;
                }
            }
        }
    }

    placeDecorations() {
        for (const room of this.rooms) {
            // Torches along walls
            const torchCount = Utils.randInt(1, 3);
            for (let i = 0; i < torchCount; i++) {
                const side = Utils.randInt(0, 3);
                let tx, ty;
                switch (side) {
                    case 0: tx = Utils.randInt(room.x + 1, room.x + room.w - 2); ty = room.y; break;
                    case 1: tx = Utils.randInt(room.x + 1, room.x + room.w - 2); ty = room.y + room.h - 1; break;
                    case 2: tx = room.x; ty = Utils.randInt(room.y + 1, room.y + room.h - 2); break;
                    case 3: tx = room.x + room.w - 1; ty = Utils.randInt(room.y + 1, room.y + room.h - 2); break;
                }
                if (this.tiles[ty][tx] === TILE.FLOOR) {
                    this.tiles[ty][tx] = TILE.TORCH;
                    this.torches.push({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });
                }
            }

            // Traps in some rooms (not spawn room)
            if (room !== this.rooms[0] && room.type === 'normal' && Math.random() < 0.3) {
                const trapCount = Utils.randInt(1, 3);
                for (let i = 0; i < trapCount; i++) {
                    const tx = Utils.randInt(room.x + 1, room.x + room.w - 2);
                    const ty = Utils.randInt(room.y + 1, room.y + room.h - 2);
                    if (this.tiles[ty][tx] === TILE.FLOOR) {
                        this.tiles[ty][tx] = TILE.TRAP;
                        this.traps.push({
                            x: tx, y: ty,
                            worldX: tx * TILE_SIZE + TILE_SIZE / 2,
                            worldY: ty * TILE_SIZE + TILE_SIZE / 2,
                            triggered: false,
                            type: Utils.randChoice(['spike', 'fire', 'poison']),
                        });
                    }
                }
            }
        }
    }

    isWalkable(tileX, tileY) {
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) return false;
        const tile = this.tiles[tileY][tileX];
        return tile === TILE.FLOOR || tile === TILE.DOOR || tile === TILE.STAIRS_DOWN ||
               tile === TILE.WATER || tile === TILE.CHEST || tile === TILE.TORCH ||
               tile === TILE.TRAP;
    }
}

// Dungeon Renderer
class DungeonRenderer {
    constructor() {
        this.tileColors = {
            [TILE.VOID]: '#0a0a0f',
            [TILE.FLOOR]: '#2a2a3a',
            [TILE.WALL]: '#4a4a5a',
            [TILE.DOOR]: '#8b6914',
            [TILE.STAIRS_DOWN]: '#4a90d9',
            [TILE.WATER]: '#1a3a5a',
            [TILE.LAVA]: '#ff3300',
            [TILE.CHEST]: '#ffd700',
            [TILE.TORCH]: '#2a2a3a',
            [TILE.TRAP]: '#2a2a3a',
            [TILE.PILLAR]: '#5a5a6a',
        };
        this.animTime = 0;
    }

    draw(ctx, dungeon, camera, dt) {
        this.animTime += dt;

        const startX = Math.max(0, Math.floor((camera.x - camera.halfW) / TILE_SIZE) - 1);
        const startY = Math.max(0, Math.floor((camera.y - camera.halfH) / TILE_SIZE) - 1);
        const endX = Math.min(dungeon.width - 1, Math.ceil((camera.x + camera.halfW) / TILE_SIZE) + 1);
        const endY = Math.min(dungeon.height - 1, Math.ceil((camera.y + camera.halfH) / TILE_SIZE) + 1);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = dungeon.tiles[y][x];
                if (tile === TILE.VOID) continue;

                const wx = x * TILE_SIZE;
                const wy = y * TILE_SIZE;

                this.drawTile(ctx, tile, wx, wy, x, y, dungeon);
            }
        }
    }

    drawTile(ctx, tile, wx, wy, tx, ty, dungeon) {
        switch (tile) {
            case TILE.FLOOR:
                this.drawFloor(ctx, wx, wy, tx, ty);
                break;
            case TILE.WALL:
                this.drawWall(ctx, wx, wy, tx, ty, dungeon);
                break;
            case TILE.STAIRS_DOWN:
                this.drawStairs(ctx, wx, wy);
                break;
            case TILE.WATER:
                this.drawWater(ctx, wx, wy);
                break;
            case TILE.CHEST:
                this.drawFloor(ctx, wx, wy, tx, ty);
                this.drawChest(ctx, wx, wy);
                break;
            case TILE.TORCH:
                this.drawFloor(ctx, wx, wy, tx, ty);
                this.drawTorch(ctx, wx, wy);
                break;
            case TILE.TRAP:
                this.drawFloor(ctx, wx, wy, tx, ty);
                break;
            case TILE.PILLAR:
                this.drawFloor(ctx, wx, wy, tx, ty);
                this.drawPillar(ctx, wx, wy);
                break;
        }
    }

    drawFloor(ctx, wx, wy, tx, ty) {
        // Biome-aware floor color
        const v = ((tx * 7 + ty * 13) % 5) * 2;
        let r = 38, g = 38, b = 52;
        if (typeof game !== 'undefined' && game.biomeSystem && game.biomeSystem.current) {
            const fc = game.biomeSystem.current.floorColor;
            r = fc[0]; g = fc[1]; b = fc[2];
        }
        ctx.fillStyle = `rgb(${r + v}, ${g + v}, ${b + v})`;
        ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);

        // Occasional floor detail
        if ((tx * 31 + ty * 17) % 13 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(wx + 8, wy + 12, 4, 2);
        }
        if ((tx * 23 + ty * 37) % 17 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.beginPath();
            ctx.arc(wx + 20, wy + 16, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawWall(ctx, wx, wy, tx, ty, dungeon) {
        // Check if wall has floor below it
        const hasFloorBelow = ty + 1 < dungeon.height &&
            (dungeon.tiles[ty + 1][tx] === TILE.FLOOR ||
             dungeon.tiles[ty + 1][tx] === TILE.TORCH ||
             dungeon.tiles[ty + 1][tx] === TILE.TRAP);

        if (hasFloorBelow) {
            // Biome-aware wall color
            let wallTop = '#5a5a6a', wallBot = '#3a3a4a';
            if (typeof game !== 'undefined' && game.biomeSystem && game.biomeSystem.current) {
                wallTop = game.biomeSystem.current.wallAccent;
                wallBot = game.biomeSystem.current.wallColor;
            }
            const gradient = ctx.createLinearGradient(wx, wy, wx, wy + TILE_SIZE);
            gradient.addColorStop(0, wallTop);
            gradient.addColorStop(1, wallBot);
            ctx.fillStyle = gradient;
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Brick pattern
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx + 1, wy + 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 2);
            ctx.strokeRect(wx + TILE_SIZE / 2 + 1, wy + 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 2);
            ctx.strokeRect(wx + TILE_SIZE / 4, wy + TILE_SIZE / 2 + 1, TILE_SIZE / 2, TILE_SIZE / 2 - 2);

            // Top edge highlight
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(wx, wy, TILE_SIZE, 2);
        } else {
            // Top of wall (biome-aware)
            let wallDark = '#3a3a4a';
            if (typeof game !== 'undefined' && game.biomeSystem && game.biomeSystem.current) {
                wallDark = game.biomeSystem.current.wallColor;
            }
            ctx.fillStyle = wallDark;
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
        }
    }

    drawStairs(ctx, wx, wy) {
        // Floor underneath
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

        // Animated glow
        const pulse = Math.sin(this.animTime * 3) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(74, 144, 217, ${0.3 * pulse})`;
        ctx.fillRect(wx + 2, wy + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        // Stair steps
        ctx.fillStyle = '#4a90d9';
        for (let i = 0; i < 4; i++) {
            const sw = TILE_SIZE - 8 - i * 4;
            const sx = wx + (TILE_SIZE - sw) / 2;
            ctx.fillRect(sx, wy + 6 + i * 6, sw, 4);
        }

        // Glow effect
        ctx.shadowBlur = 15 * pulse;
        ctx.shadowColor = '#4a90d9';
        ctx.fillStyle = 'rgba(74, 144, 217, 0.1)';
        ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
        ctx.shadowBlur = 0;
    }

    drawWater(ctx, wx, wy) {
        const wave = Math.sin(this.animTime * 2 + wx * 0.1) * 5;
        ctx.fillStyle = `rgb(${20 + wave}, ${50 + wave}, ${80 + wave})`;
        ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

        // Water shimmer
        ctx.fillStyle = `rgba(100, 180, 255, ${0.1 + Math.sin(this.animTime * 3 + wy * 0.1) * 0.05})`;
        ctx.fillRect(wx + 4, wy + 8 + wave, 12, 2);
        ctx.fillRect(wx + 16, wy + 18 + wave * 0.5, 8, 2);
    }

    drawChest(ctx, wx, wy) {
        const bounce = Math.sin(this.animTime * 2) * 2;
        const cy = wy + 4 + bounce;

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';

        // Chest body
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(wx + 6, cy + 8, 20, 14);

        // Chest lid
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(wx + 5, cy + 4, 22, 8);

        // Metal bands
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(wx + 6, cy + 8, 20, 2);
        ctx.fillRect(wx + 14, cy + 6, 4, 12);

        // Lock
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(wx + 14, cy + 10, 4, 4);

        ctx.shadowBlur = 0;
    }

    drawTorch(ctx, wx, wy) {
        // Torch base
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(wx + 13, wy + 10, 6, 16);

        // Flame
        const flicker = Math.sin(this.animTime * 10) * 2;
        const flicker2 = Math.cos(this.animTime * 7) * 1.5;

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff6600';

        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.ellipse(wx + 16 + flicker2, wy + 8, 4, 6 + flicker, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(wx + 16 + flicker2 * 0.5, wy + 9, 2, 3 + flicker * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    drawPillar(ctx, wx, wy) {
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(wx + 8, wy + 2, 16, TILE_SIZE - 4);

        // Top decoration
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(wx + 6, wy + 2, 20, 4);
        ctx.fillRect(wx + 6, wy + TILE_SIZE - 6, 20, 4);

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(wx + 10, wy + 6, 4, TILE_SIZE - 12);
    }
}
