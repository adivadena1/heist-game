// Aurum Heist — the three floors of the Meridian Bank job.
// Maps are built with small grid helpers instead of ASCII art, so a wall is
// never one character off: every row is exactly COLS wide by construction.
//
// Tile legend:
//   #  wall            C  cover (desk / safe / planter: blocks move + sight)
//   .  marble floor    ,  carpet (walkable, decorative)
//   D  locked door     K  keycard door (needs the keycard)
//   V  vent (the thief crawls through; guards cannot enter, sight cannot reach)
//   P  thief start     X  getaway exit
//   L  gold bar $500   $  cash stack $250   *  diamond $1000   k  keycard
// The crown diamond (level 3) is a `*` with crown: true in the loot list.
//
// Cameras and lasers are entities, not tiles: a camera mounts on a wall and
// sweeps its cone; a laser is a beam between two wall posts that pulses.
// A guard patrol is a list of tile waypoints; the builder validates that
// every leg between consecutive waypoints is walkable for a guard.
import {
  COLS, ROWS, TILE, VALUE_GOLD, VALUE_CASH, VALUE_DIAMOND, VALUE_CROWN,
} from './config.js';

function blankGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
}

function border(grid) {
  for (let x = 0; x < COLS; x += 1) {
    grid[0][x] = '#';
    grid[ROWS - 1][x] = '#';
  }
  for (let y = 0; y < ROWS; y += 1) {
    grid[y][0] = '#';
    grid[y][COLS - 1] = '#';
  }
}

function hwall(grid, x, y, len) {
  for (let i = 0; i < len; i += 1) grid[y][x + i] = '#';
}

function vwall(grid, x, y, len) {
  for (let i = 0; i < len; i += 1) grid[y + i][x] = '#';
}

function set(grid, x, y, ch) {
  grid[y][x] = ch;
}

function cover(grid, x, y) {
  grid[y][x] = 'C';
}

// A walled room with one door tile. (x, y) is the top-left wall corner.
function room(grid, x, y, w, h, doorX, doorY, doorCh) {
  hwall(grid, x, y, w);
  hwall(grid, x, y + h - 1, w);
  vwall(grid, x, y + 1, h - 2);
  vwall(grid, x + w - 1, y + 1, h - 2);
  set(grid, doorX, doorY, doorCh);
}

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function px(tx, ty) {
  return { x: tx * TILE, y: ty * TILE };
}

// --- Level 1: The Lobby -----------------------------------------------
// Open plan. Learn to move, sneak and read a cone. One camera watches the
// vault door; two guards cross the floor; the diamond sits in a locked
// vault room in the middle of the lobby.
function buildLobby() {
  const g = blankGrid();
  border(g);
  // Vault room in the middle, door on its south wall.
  room(g, 11, 3, 8, 7, 14, 9, 'D');
  // Desks and planters as cover.
  cover(g, 5, 5); cover(g, 6, 5); cover(g, 23, 5); cover(g, 24, 5);
  cover(g, 5, 14); cover(g, 6, 14); cover(g, 23, 14); cover(g, 24, 14);
  // Carpet runners down the middle aisles.
  for (let y = 1; y <= 18; y += 1) { g[y][10] = ','; g[y][19] = ','; }
  set(g, 3, 2, 'L'); set(g, 26, 2, 'L');
  set(g, 15, 5, 'L'); set(g, 14, 6, '*');
  set(g, 3, 13, '$'); set(g, 26, 13, '$'); set(g, 3, 18, 'L');
  set(g, 4, 17, 'P'); set(g, 26, 18, 'X');
  return {
    name: 'The Lobby',
    brief: 'Slip past the night shift, crack the lobby vault and reach the van. The camera over the vault door sees everything — time your crossing.',
    grid: g,
    cameras: [
      // Mounted on the vault room's south wall, watching the door approach.
      { pos: px(18.5, 9.5), angle: Math.PI / 2, sweep: (50 * Math.PI) / 180, range: 195, speed: 0.55 },
    ],
    lasers: [],
    guards: [
      { waypoints: [[5, 15], [24, 15]], phase: 0.0 },
      { waypoints: [[8, 2], [8, 17]], phase: 0.5 },
    ],
  };
}

// --- Level 2: The Vault Corridor --------------------------------------
// Two wings split by a wall; the only open link is the central corridor,
// crossed by a pulsing laser grid. Two vent shafts in the outer walls let
// the thief bypass the lasers entirely — if they find them.
function buildCorridor() {
  const g = blankGrid();
  border(g);
  // Divider wall with a two-tile gap in the middle.
  hwall(g, 1, 9, 13);
  hwall(g, 16, 9, 13);
  // Loot rooms north, each behind a locked door.
  room(g, 2, 2, 5, 5, 4, 6, 'D');
  room(g, 21, 2, 5, 5, 23, 6, 'D');
  // Vent shafts down both outer walls, through the divider.
  for (let y = 7; y <= 16; y += 1) { g[y][1] = 'V'; g[y][28] = 'V'; }
  set(g, 3, 4, 'L'); set(g, 5, 3, '$');
  set(g, 24, 4, 'L'); set(g, 22, 3, '*');
  set(g, 8, 17, 'L'); set(g, 15, 16, '$'); set(g, 20, 16, '$');
  set(g, 4, 17, 'P'); set(g, 26, 18, 'X');
  return {
    name: 'The Vault Corridor',
    brief: 'The laser grid owns the middle corridor — it pulses, so watch the rhythm, or crawl the vents along the outer walls. Two vault rooms, two locked doors.',
    grid: g,
    cameras: [
      // Top wall, watching the staging area above the laser corridor.
      { pos: px(15.5, 0.5), angle: Math.PI / 2, sweep: (45 * Math.PI) / 180, range: 180, speed: 0.5 },
      { pos: px(22.5, 19.5), angle: -Math.PI / 2, sweep: (45 * Math.PI) / 180, range: 180, speed: 0.5 },
    ],
    lasers: [
      { from: px(14, 9.5), to: px(16, 9.5), onTime: 3.0, offTime: 1.5, phase: 0.0 },
      { from: px(14, 10.5), to: px(16, 10.5), onTime: 3.0, offTime: 1.5, phase: 0.75 },
    ],
    guards: [
      { waypoints: [[5, 8], [24, 8]], phase: 0.0 },
      { waypoints: [[5, 14], [24, 14]], phase: 0.4 },
      { waypoints: [[15, 2], [15, 17]], phase: 0.2 },
    ],
  };
}

// --- Level 3: The Aurum Vault -----------------------------------------
// The crown diamond waits behind a keycard door; the keycard is in the
// guard office. Lasers guard the vault approach and a U-shaped vent loops
// around the vault for the patient thief.
function buildVault() {
  const g = blankGrid();
  border(g);
  // The Aurum Vault itself, keycard door on its south wall.
  room(g, 10, 2, 10, 9, 14, 10, 'K');
  // Guard office (keycard) west, strong room east.
  room(g, 2, 2, 6, 5, 4, 6, 'D');
  room(g, 22, 2, 6, 5, 24, 6, 'D');
  // U-shaped vent around the vault.
  for (let y = 7; y <= 13; y += 1) { g[y][2] = 'V'; g[y][27] = 'V'; }
  for (let x = 2; x <= 27; x += 1) g[13][x] = 'V';
  // Carpet in front of the vault door.
  for (let y = 11; y <= 12; y += 1) { g[y][13] = ','; g[y][14] = ','; g[y][15] = ','; }
  set(g, 14, 5, '*'); // crown diamond, flagged below
  set(g, 12, 4, 'L'); set(g, 16, 4, 'L');
  set(g, 12, 7, '$'); set(g, 16, 7, '$');
  set(g, 4, 4, 'k'); // keycard, in the guard office
  set(g, 24, 4, 'L'); set(g, 23, 3, '$');
  set(g, 3, 17, 'L'); set(g, 26, 17, 'L'); set(g, 15, 16, '$');
  set(g, 4, 17, 'P'); set(g, 26, 18, 'X');
  return {
    name: 'The Aurum Vault',
    brief: 'The crown diamond is behind the keycard door. Lift the keycard from the guard office, beat the lasers on the vault approach, and get out rich.',
    grid: g,
    cameras: [
      // Mounted on the vault's south wall, watching the keycard door approach.
      { pos: px(18.5, 10.5), angle: Math.PI / 2, sweep: (50 * Math.PI) / 180, range: 200, speed: 0.6 },
      { pos: px(2.5, 19.5), angle: -Math.PI / 2, sweep: (40 * Math.PI) / 180, range: 180, speed: 0.5 },
      { pos: px(29.5, 10.5), angle: Math.PI, sweep: (40 * Math.PI) / 180, range: 180, speed: 0.5 },
    ],
    lasers: [
      { from: px(11, 11.5), to: px(19, 11.5), onTime: 2.6, offTime: 1.4, phase: 0.0 },
      { from: px(11, 12.5), to: px(19, 12.5), onTime: 2.6, offTime: 1.4, phase: 0.7 },
    ],
    guards: [
      { waypoints: [[5, 15], [24, 15]], phase: 0.0 },
      { waypoints: [[8, 2], [8, 12]], phase: 0.3 },
      { waypoints: [[21, 2], [21, 12]], phase: 0.6 },
      { waypoints: [[12, 1], [17, 1]], phase: 0.15 },
    ],
  };
}

export const LEVELS = [buildLobby(), buildCorridor(), buildVault()];

// --- Loading a level into play state ----------------------------------

export function tileAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return grid[ty][tx];
}

export function isSolidForPlayer(grid, tx, ty) {
  const t = tileAt(grid, tx, ty);
  return t === '#' || t === 'C' || t === 'D' || t === 'K';
}

export function isSolidForGuard(grid, tx, ty) {
  const t = tileAt(grid, tx, ty);
  return t === '#' || t === 'C' || t === 'D' || t === 'K' || t === 'V';
}

export function blocksSight(grid, tx, ty) {
  const t = tileAt(grid, tx, ty);
  return t === '#' || t === 'C' || t === 'D' || t === 'K';
}

// Scan the grid once and pull out the entities the rules need.
export function loadLevel(index, rng) {
  const def = LEVELS[index];
  const grid = def.grid.map((row) => row.slice());
  const loot = [];
  const doors = [];
  let playerStart = null;
  let exit = null;
  let keycard = null;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const t = grid[y][x];
      const c = tileCenter(x, y);
      if (t === 'P') { playerStart = c; grid[y][x] = '.'; }
      else if (t === 'X') { exit = { ...c, tx: x, ty: y, active: false }; grid[y][x] = '.'; }
      else if (t === 'L') { loot.push({ ...c, tx: x, ty: y, kind: 'gold', value: VALUE_GOLD, taken: false, phase: rng() * Math.PI * 2 }); grid[y][x] = '.'; }
      else if (t === '$') { loot.push({ ...c, tx: x, ty: y, kind: 'cash', value: VALUE_CASH, taken: false, phase: rng() * Math.PI * 2 }); grid[y][x] = '.'; }
      else if (t === '*') {
        const crown = index === 2;
        loot.push({ ...c, tx: x, ty: y, kind: crown ? 'crown' : 'diamond', value: crown ? VALUE_CROWN : VALUE_DIAMOND, taken: false, phase: rng() * Math.PI * 2 });
        grid[y][x] = '.';
      } else if (t === 'k') { keycard = { ...c, tx: x, ty: y, taken: false, phase: rng() * Math.PI * 2 }; grid[y][x] = '.'; }
      else if (t === 'D' || t === 'K') {
        doors.push({ tx: x, ty: y, x: c.x, y: c.y, kind: t === 'D' ? 'locked' : 'keycard', open: false, pickProgress: 0 });
      }
    }
  }
  return {
    index,
    name: def.name,
    brief: def.brief,
    grid,
    loot,
    doors,
    keycard,
    playerStart,
    exit,
    cameras: def.cameras.map((cam) => ({ ...cam, exposure: 0, disabledUntil: 0 })),
    lasers: def.lasers.map((lz) => ({ ...lz, disabledUntil: 0, tripped: false })),
    guardDefs: def.guards,
    totalLoot: loot.reduce((sum, l) => sum + l.value, 0),
  };
}

// --- Validation (run at build time, and by the dev harness) ------------
// Breadth-first reachability from the player start, treating closed doors
// as passable (the thief can pick them) and vents as walkable.
export function validateLevel(index) {
  const def = LEVELS[index];
  const grid = def.grid;
  const errors = [];
  let start = null;
  const lootTiles = [];
  let exitTile = null;
  for (let y = 0; y < ROWS; y += 1) {
    if (grid[y].length !== COLS) errors.push(`row ${y} is ${grid[y].length} wide, want ${COLS}`);
    for (let x = 0; x < COLS; x += 1) {
      const t = grid[y][x];
      if (t === 'P') start = [x, y];
      if (t === 'L' || t === '$' || t === '*' || t === 'k') lootTiles.push([x, y, t]);
      if (t === 'X') exitTile = [x, y];
    }
  }
  if (!start) errors.push('no player start');
  if (!exitTile) errors.push('no exit');
  if (start) {
    const seen = new Set([`${start[0]},${start[1]}`]);
    const queue = [start];
    const passable = (x, y) => {
      const t = tileAt(grid, x, y);
      return t !== '#' && t !== 'C';
    };
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (!seen.has(key) && passable(nx, ny)) {
          seen.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    for (const [x, y, t] of lootTiles) {
      if (!seen.has(`${x},${y}`)) errors.push(`loot ${t} at (${x},${y}) unreachable`);
    }
    if (exitTile && !seen.has(`${exitTile[0]},${exitTile[1]}`)) errors.push('exit unreachable');
    // Every guard patrol leg must be walkable for a guard (no vents, no doors).
    for (const gd of def.guards) {
      const wps = gd.waypoints;
      for (let i = 0; i < wps.length; i += 1) {
        const [x1, y1] = wps[i];
        const [x2, y2] = wps[(i + 1) % wps.length];
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let s = 0; s <= steps; s += 1) {
          const x = Math.round(x1 + ((x2 - x1) * s) / steps);
          const y = Math.round(y1 + ((y2 - y1) * s) / steps);
          if (isSolidForGuard(grid, x, y)) {
            errors.push(`guard leg (${x1},${y1})->(${x2},${y2}) blocked at (${x},${y})`);
            break;
          }
        }
      }
    }
  }
  return errors;
}
