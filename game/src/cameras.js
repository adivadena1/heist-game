// Aurum Heist — cameras and lasers.
// A camera sweeps its cone back and forth; while the thief stands in the
// cone its exposure climbs, and the exposure feeds the alarm meter. An EMP
// burst blacks cameras and lasers out for a few seconds — at the cost of a
// noise spike and a jump in the alarm.
// A laser pulses on a cycle; crossing a live beam trips the alarm and
// alerts the nearest guard to the crossing point.
import {
  CAMERA_RANGE, CAMERA_HALF_ANGLE, CAMERA_EXPOSURE_RATE,
  LASER_ALARM_SPIKE, EMP_DISABLE_TIME, EMP_ALARM_SPIKE, EMP_NOISE_RADIUS,
} from './config.js';
import { canSee, distToSegment } from './vision.js';
import { emitNoise } from './guards.js';

// The camera's current facing: base angle plus a sine sweep.
export function cameraAngle(cam, time) {
  return cam.angle + Math.sin(time * cam.speed) * cam.sweep;
}

export function updateCameras(state, dt) {
  const thief = state.player;
  for (const cam of state.level.cameras) {
    if (state.time >= cam.disabledUntil) {
      const ang = cameraAngle(cam, state.time);
      const seen = canSee(
        state.level.grid, state.smokes, cam.pos.x, cam.pos.y, ang,
        CAMERA_HALF_ANGLE, CAMERA_RANGE, thief.x, thief.y,
      );
      if (seen) {
        cam.exposure = Math.min(100, cam.exposure + CAMERA_EXPOSURE_RATE * dt);
        if (cam.exposure >= 100 && !cam.alarmRaised) {
          cam.alarmRaised = true;
          state.events.push({ type: 'camera-spotted' });
        }
      } else {
        cam.exposure = Math.max(0, cam.exposure - 30 * dt);
        if (cam.exposure < 60) cam.alarmRaised = false;
      }
    } else {
      cam.exposure = Math.max(0, cam.exposure - 40 * dt);
    }
  }
}

export function laserIsLive(laser, time) {
  if (time < laser.disabledUntil) return false;
  const cycle = laser.onTime + laser.offTime;
  const t = (time + laser.phase) % cycle;
  return t < laser.onTime;
}

export function updateLasers(state, dt) {
  const thief = state.player;
  for (const laser of state.level.lasers) {
    const live = laserIsLive(laser, state.time);
    if (!live) { laser.tripped = false; continue; }
    const d = distToSegment(thief.x, thief.y, laser.from.x, laser.from.y, laser.to.x, laser.to.y);
    if (d < 12 && !laser.tripped) {
      laser.tripped = true;
      state.alarm = Math.min(100, state.alarm + LASER_ALARM_SPIKE);
      state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
      state.events.push({ type: 'laser-tripped', x: thief.x, y: thief.y });
      emitNoise(state, thief.x, thief.y, 200);
    } else if (d >= 12) {
      laser.tripped = false;
    }
  }
}

// EMP: black out every camera and laser, spike the alarm, make a noise
// the guards will come and look at.
export function fireEmp(state) {
  if (state.player.emp <= 0) return false;
  state.player.emp -= 1;
  const until = state.time + EMP_DISABLE_TIME;
  for (const cam of state.level.cameras) cam.disabledUntil = until;
  for (const laser of state.level.lasers) laser.disabledUntil = until;
  state.alarm = Math.min(100, state.alarm + EMP_ALARM_SPIKE);
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
  emitNoise(state, state.player.x, state.player.y, EMP_NOISE_RADIUS);
  state.events.push({ type: 'emp' });
  return true;
}
