// Aurum Heist — the thief. WASD / arrows to move, Shift to sneak, E to
// pick a lock (hold it) or use a keycard door, left-click to throw a smoke
// pellet at the cursor, Q for an EMP burst. Running is fast and loud;
// sneaking is slow and quiet. A thief in a vent is invisible.
import {
  TILE, PLAYER_WALK_SPEED, PLAYER_SNEAK_SPEED, PLAYER_RADIUS,
  SMOKE_START, SMOKE_RANGE, SMOKE_RADIUS, SMOKE_DURATION, EMP_START,
  LOCKPICK_TIME, LOCKPICK_NOISE_RADIUS, RUN_NOISE_RADIUS, RUN_NOISE_INTERVAL,
  SNEAK_NOISE_RADIUS, VALUE_GOLD, VALUE_CASH, VALUE_DIAMOND, VALUE_CROWN,
} from './config.js';
import { tileAt, isSolidForPlayer } from './levels.js';
import { emitNoise } from './guards.js';

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2,
    moving: false,
    sneaking: false,
    running: false,
    smoke: SMOKE_START,
    emp: EMP_START,
    hasKeycard: false,
    noiseTimer: 0,
    lockpickTarget: null, // door being picked, or null
    lootValue: 0,
    lootGot: 0,
  };
}

function tryMove(grid, player, dx, dy) {
  const r = PLAYER_RADIUS;
  const nx = player.x + dx;
  const ny = player.y + dy;
  const solidAt = (x, y) => isSolidForPlayer(grid, Math.floor(x / TILE), Math.floor(y / TILE));
  if (!solidAt(nx + Math.sign(dx) * r, player.y - r) && !solidAt(nx + Math.sign(dx) * r, player.y + r)) {
    player.x = nx;
  }
  if (!solidAt(player.x - r, ny + Math.sign(dy) * r) && !solidAt(player.x + r, ny + Math.sign(dy) * r)) {
    player.y = ny;
  }
}

export function nearestDoor(level, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const door of level.doors) {
    if (door.open) continue;
    const d = Math.hypot(door.x - x, door.y - y);
    if (d < bestDist) { bestDist = d; best = door; }
  }
  return best;
}

export function updatePlayer(state, input, dt) {
  const player = state.player;
  const grid = state.level.grid;
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  const moving = mx !== 0 || my !== 0;
  player.moving = moving;
  player.sneaking = !!input.sneak;
  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  if (moving) {
    const len = Math.hypot(mx, my);
    const vx = (mx / len) * speed * dt;
    const vy = (my / len) * speed * dt;
    tryMove(grid, player, vx, vy);
    player.angle = Math.atan2(vy, vx);
    player.running = !player.sneaking;
    // Footstep noise: running carries, sneaking barely whispers.
    player.noiseTimer -= dt;
    if (player.noiseTimer <= 0) {
      player.noiseTimer = RUN_NOISE_INTERVAL;
      const radius = player.sneaking ? SNEAK_NOISE_RADIUS : RUN_NOISE_RADIUS;
      emitNoise(state, player.x, player.y, radius);
      if (!player.sneaking) state.events.push({ type: 'step' });
    }
  } else {
    player.running = false;
  }

  // Picking a lock: hold E beside a locked door. It is loud work.
  const door = nearestDoor(state.level, player.x, player.y, 40);
  player.lockpickTarget = null;
  if (door && input.interact) {
    if (door.kind === 'keycard') {
      if (player.hasKeycard) {
        door.open = true;
        grid[door.ty][door.tx] = '.';
        state.events.push({ type: 'door-open', kind: 'keycard' });
      } else {
        player.lockpickTarget = door; // show "needs keycard" hint
      }
    } else {
      player.lockpickTarget = door;
      door.pickProgress += dt;
      if (Math.random() < dt * 2) state.events.push({ type: 'pick-tick' });
      emitNoise(state, player.x, player.y, LOCKPICK_NOISE_RADIUS);
      if (door.pickProgress >= LOCKPICK_TIME) {
        door.open = true;
        grid[door.ty][door.tx] = '.';
        state.events.push({ type: 'door-open', kind: 'locked' });
      }
    }
  } else if (door && door.kind === 'locked') {
    door.pickProgress = Math.max(0, door.pickProgress - dt * 2);
  }

  // Pick up loot and the keycard by walking over them.
  for (const item of state.level.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) < TILE * 0.75) {
      item.taken = true;
      player.lootValue += item.value;
      player.lootGot += 1;
      state.events.push({ type: 'loot', kind: item.kind, value: item.value });
    }
  }
  const card = state.level.keycard;
  if (card && !card.taken && Math.hypot(card.x - player.x, card.y - player.y) < TILE * 0.75) {
    card.taken = true;
    player.hasKeycard = true;
    state.events.push({ type: 'keycard' });
  }

  // All loot in hand opens the getaway exit.
  if (player.lootGot === state.level.loot.length && !state.level.exit.active) {
    state.level.exit.active = true;
    state.events.push({ type: 'exit-open' });
  }

  // Reaching the open exit clears the level.
  const exit = state.level.exit;
  if (exit.active && Math.hypot(exit.x - player.x, exit.y - player.y) < TILE * 0.8) {
    return 'clear';
  }
  return null;
}

// Throw a smoke pellet at the clicked point (clamped to throwing range).
export function throwSmoke(state, wx, wy) {
  const player = state.player;
  if (player.smoke <= 0) return false;
  const dx = wx - player.x;
  const dy = wy - player.y;
  const dist = Math.hypot(dx, dy);
  const max = SMOKE_RANGE;
  const tx = dist > max ? player.x + (dx / dist) * max : wx;
  const ty = dist > max ? player.y + (dy / dist) * max : wy;
  player.smoke -= 1;
  state.smokes.push({ x: tx, y: ty, radius: SMOKE_RADIUS, ttl: SMOKE_DURATION });
  emitNoise(state, tx, ty, 70);
  state.events.push({ type: 'smoke' });
  return true;
}

export function updateSmokes(state, dt) {
  for (const s of state.smokes) s.ttl -= dt;
  state.smokes = state.smokes.filter((s) => s.ttl > 0);
}
