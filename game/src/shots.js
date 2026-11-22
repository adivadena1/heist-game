// Aurum Heist — staged scenes for screenshots (?shot=<name>&seed=<n>).
// The stager plays the real game with scripted inputs: a BFS autopilot
// walks the thief to waypoints, picks locks, waits out laser pulses, and
// stands in a cone until the alarm builds. Nothing is teleported and no
// state is edited, so the screenshots are real renders of the game's own
// code. The driver polls window.__shotDone, then takes the shot.
import { TILE, COLS, ROWS, LOCKPICK_TIME } from './config.js';
import { tileAt } from './levels.js';
import { laserIsLive } from './cameras.js';
import { throwSmoke } from './player.js';
import { distToSegment } from './vision.js';

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// BFS over the tile grid. Closed doors are passable (the thief picks them);
// a keycard door only when the thief holds the keycard.
function findPath(state, fromTx, fromTy, toTx, toTy) {
  const grid = state.level.grid;
  const passable = (x, y) => {
    const t = tileAt(grid, x, y);
    if (t === '#' || t === 'C') return false;
    if (t === 'K') return state.player.hasKeycard;
    return true;
  };
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [[fromTx, fromTy]];
  prev.set(key(fromTx, fromTy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) {
      const path = [];
      let cur = [x, y];
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (prev.has(key(nx, ny))) continue;
      if (!passable(nx, ny)) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

function makeDriver(state, input) {
  const driver = {
    path: null,
    pathTarget: null,
    replanTimer: 0,
    waitTimer: 0,
    empUsed: false,
    smoked: false,
    lastPos: null,
    stuckTimer: 0,
  };

  function releaseAll() {
    input.up = false; input.down = false; input.left = false; input.right = false;
    input.interact = false;
    input.sneak = false;
  }

  // Drive toward (tx, ty). Returns 'arrived' | 'driving' | 'blocked'.
  driver.driveTo = function driveTo(tx, ty, dt) {
    const p = state.player;
    const ptx = Math.floor(p.x / TILE);
    const pty = Math.floor(p.y / TILE);
    if (ptx === tx && pty === ty) { releaseAll(); return 'arrived'; }
    driver.replanTimer -= dt;
    const targetKey = `${tx},${ty}`;
    if (!driver.path || driver.pathTarget !== targetKey || driver.replanTimer <= 0) {
      driver.path = findPath(state, ptx, pty, tx, ty);
      driver.pathTarget = targetKey;
      driver.replanTimer = 0.5;
      if (!driver.path) return 'blocked';
    }
    // Skip tiles already reached.
    while (driver.path.length > 1) {
      const [nx, ny] = driver.path[0];
      if (nx === ptx && ny === pty) driver.path.shift();
      else break;
    }
    const [nx, ny] = driver.path[0];
    const doorTile = tileAt(state.level.grid, nx, ny);
    // A closed door on the path: stand next to it and pick it.
    if (doorTile === 'D' || doorTile === 'K') {
      const door = state.level.doors.find((d) => d.tx === nx && d.ty === ny);
      const d = door ? Math.hypot(door.x - p.x, door.y - p.y) : 999;
      if (d < 44) {
        releaseAll();
        input.interact = true;
        return 'driving';
      }
      // Otherwise walk to the tile just before the door.
      const [bx, by] = driver.path.length > 1 ? driver.path[0] : [ptx, pty];
      return stepToward(bx, by);
    }
    return stepToward(nx, ny);
  };

  function stepToward(nx, ny) {
    const p = state.player;
    const c = tileCenter(nx, ny);
    // Read the room: sneak when a guard is close (running is loud and
    // pulls guards over), never walk into a guard's next step, and if a
    // guard has almost made the thief, drop smoke on the spot and wait
    // inside it until the heat dies down.
    let nearGuard = false;
    let guardBlocking = false;
    for (const g of state.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < 110) nearGuard = true;
      if (Math.hypot(g.x - c.x, g.y - c.y) < 56) guardBlocking = true;
      if (g.detection > 55 && p.smoke > 0 && !driver.smoked) {
        driver.smoked = true;
        throwSmoke(state, p.x, p.y);
      }
    }
    if (state.guards.every((g) => g.detection < 30)) driver.smoked = false;
    if (guardBlocking) {
      releaseAll();
      return 'driving';
    }
    input.sneak = nearGuard;
    // Never step into a live laser: wait for the pulse, then EMP if it
    // takes too long.
    for (const laser of state.level.lasers) {
      if (!laserIsLive(laser, state.time)) continue;
      const d = distToSegment(p.x, p.y, laser.from.x, laser.from.y, laser.to.x, laser.to.y);
      const dNext = distToSegment(c.x, c.y, laser.from.x, laser.from.y, laser.to.x, laser.to.y);
      if (dNext < 14 || d < 14) {
        releaseAll();
        driver.waitTimer += 1 / 60;
        if (driver.waitTimer > 5 && !driver.empUsed && p.emp > 0) {
          driver.empUsed = true;
          input.queue('emp');
        }
        return 'driving';
      }
    }
    driver.waitTimer = 0;
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    input.left = dx < -4;
    input.right = dx > 4;
    input.up = dy < -4;
    input.down = dy > 4;
    input.interact = false;
    // Stuck detection: barely moving while a path exists.
    if (driver.lastPos) {
      const moved = Math.hypot(p.x - driver.lastPos.x, p.y - driver.lastPos.y);
      driver.stuckTimer = moved < 0.5 ? driver.stuckTimer + 1 / 60 : 0;
    }
    driver.lastPos = { x: p.x, y: p.y };
    return 'driving';
  }

  driver.releaseAll = releaseAll;
  return driver;
}

const SCENES = {
  // Cover: the thief holds position in front of the vault door, inside the
  // camera cone, while the alarm meter climbs.
  heist: {
    level: 0,
    waypoints: [[15, 12]],
    done: (state) => state.alarm >= 25,
  },
  // A guard walks into the thief on its patrol line; wait for the chase.
  alarm: {
    level: 0,
    waypoints: [[15, 15]],
    done: (state) => state.guards.some((g) => g.state === 'chase'),
    settleFrames: 30,
  },
  // The full job on floor 3: office door, keycard, vault door, crown.
  vault: {
    level: 2,
    waypoints: [[4, 6], [4, 4], [14, 10], [14, 5]],
    done: (state) => {
      const crown = state.level.loot.find((l) => l.kind === 'crown');
      return crown ? crown.taken : false;
    },
  },
  // Floor 1 start to finish: every loot, then the getaway.
  clear: {
    level: 0,
    waypoints: null, // computed: all loot, then the exit
    done: (state) => state.screen === 'clear',
  },
};

export function installShots(state, input) {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  if (!shotName || !SCENES[shotName]) return;
  const scene = SCENES[shotName];
  const driver = makeDriver(state, input);
  const stager = {
    step: 'begin',
    waypointIndex: 0,
    restarts: 0,
    settle: 0,
    computeWaypoints() {
      if (scene.waypoints) return scene.waypoints;
      // clear: visit every loot tile, then the exit.
      const wps = state.level.loot.map((l) => [l.tx, l.ty]);
      wps.push([state.level.exit.tx, state.level.exit.ty]);
      return wps;
    },
    waypoints: scene.waypoints,
  };

  function restart() {
    stager.restarts += 1;
    if (stager.restarts > 3) {
      window.__shotDone = true;
      window.__shotInfo = { error: 'too many restarts (caught repeatedly)' };
      return;
    }
    driver.path = null;
    driver.waitTimer = 0;
    driver.empUsed = false;
    driver.smoked = false;
    stager.waypointIndex = 0;
    stager.waypoints = scene.waypoints;
    window.__aurum.startLevel(scene.level);
    stager.step = 'briefing';
  }

  state.hooks.onFrame = (s) => {
    if (window.__shotDone) return;
    if (s.screen === 'title' && stager.step === 'begin') {
      input.queue('confirm');
      stager.step = 'title-confirm';
      return;
    }
    if (s.screen === 'briefing' && (stager.step === 'title-confirm' || stager.step === 'briefing')) {
      // Make sure we are on the scene's level (startJob always opens 1).
      if (s.levelIndex !== scene.level) {
        window.__aurum.startLevel(scene.level);
        return;
      }
      input.queue('confirm');
      stager.step = 'drive';
      stager.waypoints = stager.computeWaypoints();
      return;
    }
    if (s.screen === 'caught') {
      driver.releaseAll();
      restart();
      return;
    }
    // A scene can finish off the play screen: the 'clear' scene ends on
    // the clear screen, after the exit. Check first, drive second.
    if (stager.step === 'drive' && scene.done(s)) {
      if (scene.settleFrames) {
        stager.settle += 1;
        if (stager.settle < scene.settleFrames) return;
      }
      driver.releaseAll();
      window.__shotDone = true;
      window.__shotInfo = { shot: shotName, alarm: Math.round(s.alarm), score: s.score };
      return;
    }
    if (s.screen !== 'play') return;
    if (stager.step !== 'drive') return;

    const wps = stager.waypoints;
    if (!wps || stager.waypointIndex >= wps.length) return;
    const [tx, ty] = wps[stager.waypointIndex];
    const result = driver.driveTo(tx, ty, 1 / 60);
    if (result === 'arrived' || result === 'blocked') {
      stager.waypointIndex += 1;
      driver.path = null;
    }
    if (driver.stuckTimer > 2.5) {
      driver.stuckTimer = 0;
      driver.path = null;
      stager.waypointIndex = Math.max(0, stager.waypointIndex - 1);
    }
  };

  // Start on the scene's level: title -> startJob opens floor 1, and the
  // briefing step above switches to the scene's level when needed.
  if (scene.level !== 0) {
    window.__aurum.startLevel(scene.level);
    stager.step = 'briefing';
  }
}
