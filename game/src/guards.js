// Aurum Heist — guard AI. One state machine per guard:
//   patrol -> suspicious -> chase -> search -> return -> patrol
// A guard's detection rises while the thief is inside its cone and in the
// open, faster up close, slower when the thief sneaks. Noise (running,
// lockpicking, an EMP pop) pulls the nearest guards to investigate.
// At full detection a guard chases; touching the thief while chasing — or
// while the alarm is in lockdown — ends the job.
import {
  TILE, GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, GUARD_SEARCH_SPEED,
  GUARD_SIGHT_RANGE, GUARD_HALF_ANGLE, GUARD_WAYPOINT_PAUSE,
  GUARD_DETECTION_RATE, GUARD_LOSE_SIGHT_TIME, GUARD_SEARCH_TIME,
  GUARD_SUSPICIOUS_TIME, BUMP_DISTANCE, CATCH_DISTANCE, ALARM_LOCKDOWN,
} from './config.js';
import { canSee } from './vision.js';
import { isSolidForGuard } from './levels.js';

export function makeGuards(level, rng) {
  return level.guardDefs.map((def, i) => {
    const start = def.waypoints[0];
    return {
      id: i,
      waypoints: def.waypoints.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })),
      x: (start[0] + 0.5) * TILE,
      y: (start[1] + 0.5) * TILE,
      angle: -Math.PI / 2,
      state: 'patrol',
      waypointIndex: 1,
      waitTimer: def.phase * GUARD_WAYPOINT_PAUSE,
      scanPhase: rng() * Math.PI * 2,
      detection: 0,
      stateTimer: 0,
      noSightTimer: 0,
      target: null, // {x, y} investigation / chase point
      lastSeen: null,
      speed: GUARD_PATROL_SPEED,
    };
  });
}

function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function turnToward(guard, targetAngle, dt, rate) {
  let diff = targetAngle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  guard.angle += step;
}

// Circle-vs-grid movement: slide along walls instead of sticking.
function moveGuard(grid, guard, tx, ty, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(guard.speed * dt, dist);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const r = 11;
  const solidAt = (x, y) => isSolidForGuard(grid, Math.floor(x / TILE), Math.floor(y / TILE));
  let movedX = false;
  let movedY = false;
  if (!solidAt(nx + Math.sign(dx) * r, guard.y - r) && !solidAt(nx + Math.sign(dx) * r, guard.y + r)) {
    guard.x = nx;
    movedX = true;
  }
  if (!solidAt(guard.x - r, ny + Math.sign(dy) * r) && !solidAt(guard.x + r, ny + Math.sign(dy) * r)) {
    guard.y = ny;
    movedY = true;
  }
  if (movedX || movedY) turnToward(guard, angleTo(guard.x, guard.y, tx, ty), dt, 6);
  return movedX || movedY;
}

export function guardSeesThief(state, guard) {
  const thief = state.player;
  const seen = canSee(
    state.level.grid, state.smokes, guard.x, guard.y, guard.angle,
    GUARD_HALF_ANGLE, GUARD_SIGHT_RANGE, thief.x, thief.y,
  );
  return seen;
}

// One guard, one frame. Returns 'caught' when this guard ends the job.
export function updateGuard(state, guard, dt) {
  const thief = state.player;
  const grid = state.level.grid;
  const seen = guardSeesThief(state, guard);
  const dist = Math.hypot(thief.x - guard.x, thief.y - guard.y);

  // Bumping into a guard is instant full detection.
  if (dist < BUMP_DISTANCE && guard.detection < 100) guard.detection = 100;

  // Detection rises in the cone, faster up close and when the thief runs,
  // slower when they sneak; it falls when out of sight.
  if (seen) {
    const closeness = 1.15 - (dist / GUARD_SIGHT_RANGE) * 0.8;
    const sneakFactor = thief.sneaking ? 0.45 : thief.running ? 1.35 : 1;
    guard.detection = Math.min(100, guard.detection + GUARD_DETECTION_RATE * closeness * sneakFactor * dt);
    guard.lastSeen = { x: thief.x, y: thief.y };
    guard.noSightTimer = 0;
  } else {
    guard.detection = Math.max(0, guard.detection - 22 * dt);
    guard.noSightTimer += dt;
  }

  if (guard.detection >= 100 && guard.state !== 'chase') {
    guard.state = 'chase';
    guard.stateTimer = 0;
    state.events.push({ type: 'spotted', guard: guard.id });
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.waitTimer > 0) {
        guard.waitTimer -= dt;
        // Scan the room while standing at a waypoint.
        guard.scanPhase += dt * 1.4;
        guard.angle += Math.sin(guard.scanPhase) * 0.9 * dt;
        break;
      }
      const wp = guard.waypoints[guard.waypointIndex];
      if (moveGuard(grid, guard, wp.x, wp.y, dt)) {
        if (Math.hypot(wp.x - guard.x, wp.y - guard.y) < 4) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.waitTimer = GUARD_WAYPOINT_PAUSE;
        }
      } else {
        // Stuck against something: skip to the next waypoint.
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.waitTimer = GUARD_WAYPOINT_PAUSE;
      }
      break;
    }
    case 'suspicious': {
      guard.stateTimer += dt;
      if (guard.target) {
        moveGuard(grid, guard, guard.target.x, guard.target.y, dt);
        if (Math.hypot(guard.target.x - guard.x, guard.target.y - guard.y) < 8) {
          guard.target = null;
          guard.stateTimer = 0;
        }
      } else if (guard.stateTimer > GUARD_SUSPICIOUS_TIME) {
        guard.state = 'return';
        guard.stateTimer = 0;
      } else {
        guard.scanPhase += dt * 2.2;
        guard.angle += Math.sin(guard.scanPhase) * 1.4 * dt;
      }
      break;
    }
    case 'chase': {
      guard.speed = GUARD_CHASE_SPEED;
      if (seen || state.alarm >= ALARM_LOCKDOWN) {
        guard.target = { x: thief.x, y: thief.y };
      }
      if (guard.target) moveGuard(grid, guard, guard.target.x, guard.target.y, dt);
      if (!seen && guard.noSightTimer > GUARD_LOSE_SIGHT_TIME && state.alarm < ALARM_LOCKDOWN) {
        guard.state = 'search';
        guard.stateTimer = 0;
        guard.target = guard.lastSeen ? { ...guard.lastSeen } : { x: thief.x, y: thief.y };
      }
      if (dist < CATCH_DISTANCE) return 'caught';
      break;
    }
    case 'search': {
      guard.stateTimer += dt;
      if (guard.target) {
        moveGuard(grid, guard, guard.target.x, guard.target.y, dt);
        if (Math.hypot(guard.target.x - guard.x, guard.target.y - guard.y) < 8) {
          guard.target = null;
          guard.stateTimer = 0;
        }
      } else if (guard.stateTimer > GUARD_SEARCH_TIME) {
        guard.state = 'return';
        guard.stateTimer = 0;
      } else {
        guard.scanPhase += dt * 2.0;
        guard.angle += Math.sin(guard.scanPhase) * 1.2 * dt;
      }
      break;
    }
    case 'return': {
      // Head for the nearest waypoint, then resume the patrol.
      let best = guard.waypoints[0];
      let bestDist = Infinity;
      for (const wp of guard.waypoints) {
        const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
        if (d < bestDist) { bestDist = d; best = wp; }
      }
      moveGuard(grid, guard, best.x, best.y, dt);
      if (bestDist < 6) {
        guard.waypointIndex = guard.waypoints.indexOf(best);
        guard.state = 'patrol';
        guard.speed = GUARD_PATROL_SPEED;
        guard.detection = 0;
      }
      break;
    }
    default:
      break;
  }

  if (guard.state !== 'chase') guard.speed = guard.state === 'search' ? GUARD_SEARCH_SPEED : GUARD_PATROL_SPEED;
  return null;
}

// A noise at (x, y) pulls every guard inside `radius` to investigate —
// unless one is already chasing.
export function emitNoise(state, x, y, radius) {
  for (const guard of state.guards) {
    if (guard.state === 'chase') continue;
    if (Math.hypot(guard.x - x, guard.y - y) < radius) {
      guard.state = 'suspicious';
      guard.stateTimer = 0;
      guard.target = { x, y };
    }
  }
}
