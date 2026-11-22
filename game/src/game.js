// Aurum Heist — the game loop, screens and scoring. Screens:
//   title -> briefing -> play -> caught | clear -> briefing -> ... -> win
// The alarm meter is the job's heartbeat: it climbs toward whatever is
// worst at seeing the thief right now (a guard's detection, a camera's
// exposure), plus spikes from lasers and EMPs, and decays when nobody
// sees them. Past 80 the bank goes into lockdown and every guard chases.
import {
  HUD_TOP, VIEW_H, LEVEL_TIME_LIMITS, TIME_BONUS_PER_SECOND, GHOST_BONUS,
  GHOST_BONUS_MAX_ALARM, ALARM_DECAY, ALARM_SUSPICIOUS, ALARM_LOCKDOWN,
} from './config.js';
import { loadLevel } from './levels.js';
import { makeGuards, updateGuard, emitNoise } from './guards.js';
import { updateCameras, updateLasers, fireEmp } from './cameras.js';
import { makePlayer, updatePlayer, updateSmokes, throwSmoke } from './player.js';
import { makeAudio } from './audio.js';
import { render } from './render.js';

export function createGame(canvas, input, rng, hooks) {
  const ctx = canvas.getContext('2d');
  const audio = makeAudio();
  const state = {
    ctx,
    input,
    rng,
    hooks: hooks || {},
    screen: 'title',
    levelIndex: 0,
    level: null,
    guards: [],
    player: null,
    smokes: [],
    events: [],
    time: 0, // level clock (drives sweeps, lasers, patrols)
    timeLeft: 0,
    timeLimit: 0,
    alarm: 0,
    maxAlarm: 0,
    score: 0,
    totalLootValue: 0,
    caughtReason: '',
    lastBreakdown: null,
    pausedFrom: null,
    frameCount: 0,
  };

  function startLevel(index) {
    state.levelIndex = index;
    state.level = loadLevel(index, rng);
    state.guards = makeGuards(state.level, rng);
    state.player = makePlayer(state.level.playerStart);
    state.smokes = [];
    state.events = [];
    state.time = 0;
    state.timeLimit = LEVEL_TIME_LIMITS[index];
    state.timeLeft = state.timeLimit;
    state.alarm = 0;
    state.maxAlarm = 0;
    state.screen = 'briefing';
  }

  function startJob() {
    state.score = 0;
    state.totalLootValue = 0;
    startLevel(0);
  }

  function levelClear() {
    const timeBonus = Math.round(state.timeLeft) * TIME_BONUS_PER_SECOND;
    const ghost = state.maxAlarm < GHOST_BONUS_MAX_ALARM;
    const ghostBonus = ghost ? GHOST_BONUS : 0;
    const loot = state.player.lootValue;
    const total = loot + timeBonus + ghostBonus;
    state.score += total;
    state.totalLootValue += loot;
    state.lastBreakdown = {
      loot, timeBonus, timeLeft: state.timeLeft, ghost, ghostBonus, total,
    };
    audio.clear();
    audio.setAlarm(false);
    state.screen = 'clear';
  }

  function busted(reason) {
    state.caughtReason = reason;
    audio.caught();
    audio.setAlarm(false);
    state.screen = 'caught';
  }

  function drainEvents() {
    for (const ev of state.events) {
      switch (ev.type) {
        case 'step': audio.step(); break;
        case 'loot': audio.pickup(); break;
        case 'keycard': audio.keycard(); break;
        case 'door-open': audio.doorOpen(); break;
        case 'pick-tick': audio.pickTick(); break;
        case 'smoke': audio.smoke(); break;
        case 'emp': audio.emp(); break;
        case 'spotted': audio.spotted(); break;
        case 'laser-tripped': audio.laser(); break;
        case 'exit-open': audio.exitOpen(); break;
        case 'camera-spotted': audio.spotted(); break;
        default: break;
      }
    }
    state.events.length = 0;
  }

  function updatePlay(dt) {
    state.time += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      busted('The police arrived — you ran out of time.');
      return;
    }

    // One-shot actions.
    for (const action of state.input.queued) {
      if (typeof action === 'string') {
        if (action === 'emp') {
          if (fireEmp(state)) audio.emp();
        } else if (action === 'mute') {
          audio.toggleMute();
        } else if (action === 'pause') {
          state.pausedFrom = 'play';
          state.screen = 'paused';
        } else if (action === 'retry') {
          startLevel(state.levelIndex);
          return;
        }
      } else if (action && action.type === 'click') {
        // Clicks are in canvas space; the playfield starts below the HUD.
        const wx = action.x;
        const wy = action.y - HUD_TOP;
        if (wy >= 0 && wy < VIEW_H) throwSmoke(state, wx, wy);
      }
    }
    state.input.queued.length = 0;

    const clear = updatePlayer(state, state.input, dt);
    if (clear === 'clear') {
      levelClear();
      return;
    }
    updateSmokes(state, dt);
    updateCameras(state, dt);
    updateLasers(state, dt);

    // The alarm chases the worst thing currently seeing the thief.
    let worst = 0;
    for (const guard of state.guards) worst = Math.max(worst, guard.detection);
    for (const cam of state.level.cameras) worst = Math.max(worst, cam.exposure);
    if (worst > state.alarm) {
      state.alarm = Math.min(100, state.alarm + 55 * dt);
      if (state.alarm > worst) state.alarm = worst;
    } else if (worst < state.alarm) {
      state.alarm = Math.max(worst, state.alarm - ALARM_DECAY * dt);
    }
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

    // Past the suspicious line, the nearest guard comes to look.
    if (state.alarm >= ALARM_SUSPICIOUS && !state.investigating) {
      state.investigating = true;
      let best = null;
      let bestDist = Infinity;
      for (const guard of state.guards) {
        if (guard.state === 'chase') continue;
        const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
        if (d < bestDist) { bestDist = d; best = guard; }
      }
      if (best) {
        best.state = 'suspicious';
        best.stateTimer = 0;
        best.target = { x: state.player.x, y: state.player.y };
      }
    } else if (state.alarm < ALARM_SUSPICIOUS - 10) {
      state.investigating = false;
    }

    // Lockdown: every guard converges on the thief.
    if (state.alarm >= ALARM_LOCKDOWN) {
      for (const guard of state.guards) {
        if (guard.state !== 'chase') {
          guard.state = 'chase';
          guard.stateTimer = 0;
        }
      }
    }

    for (const guard of state.guards) {
      if (updateGuard(state, guard, dt) === 'caught') {
        busted('A guard caught you red-handed.');
        return;
      }
    }

    audio.setAlarm(state.alarm >= ALARM_LOCKDOWN);
    drainEvents();
  }

  function update(dt) {
    // Menu keys are handled here so the play update never sees them.
    const queued = state.input.queued;
    if (state.screen === 'title') {
      if (queued.includes('confirm') || queued.some((a) => a && a.type === 'click')) {
        audio.ensure();
        audio.click();
        queued.length = 0;
        startJob();
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'briefing') {
      if (queued.includes('confirm') || queued.some((a) => a && a.type === 'click')) {
        audio.ensure();
        audio.click();
        queued.length = 0;
        state.screen = 'play';
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'caught') {
      if (queued.includes('retry')) {
        queued.length = 0;
        startLevel(state.levelIndex);
        return;
      }
      if (queued.includes('confirm')) {
        queued.length = 0;
        state.screen = 'title';
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'clear') {
      if (queued.includes('confirm') || queued.some((a) => a && a.type === 'click')) {
        audio.click();
        queued.length = 0;
        if (state.levelIndex + 1 >= 3) {
          state.screen = 'win';
        } else {
          startLevel(state.levelIndex + 1);
        }
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'win') {
      if (queued.includes('confirm') || queued.some((a) => a && a.type === 'click')) {
        audio.click();
        queued.length = 0;
        state.screen = 'title';
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'paused') {
      if (queued.includes('pause') || queued.includes('confirm')) {
        queued.length = 0;
        state.screen = state.pausedFrom || 'play';
        return;
      }
      queued.length = 0;
      return;
    }
    if (state.screen === 'play') updatePlay(dt);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    state.frameCount += 1;
    // A staged screenshot freezes the world the moment it is ready, so
    // the driver captures the exact frame (a chase, not the caught screen
    // half a second later). Only the shot stager ever sets this flag.
    if (window.__shotDone) {
      render(state);
      requestAnimationFrame(frame);
      return;
    }
    update(dt);
    // Menu screens animate on the same clock (sweeps, sparkles, pulses).
    if (state.screen !== 'play') state.time += dt;
    render(state);
    if (state.hooks.onFrame) state.hooks.onFrame(state);
    requestAnimationFrame(frame);
  }

  // Debug hook for the screenshot stager and the dev harness. The game
  // itself never reads it; it only exposes state for driving and reading.
  window.__aurum = {
    state,
    startJob,
    startLevel,
    emitNoise: (x, y, r) => emitNoise(state, x, y, r),
  };

  startLevel(0);
  state.screen = 'title';
  requestAnimationFrame(frame);
  return state;
}
