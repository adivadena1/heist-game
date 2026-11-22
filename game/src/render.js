// Aurum Heist — everything the eye sees, on one canvas. The whole floor
// fits in a single frame (960x640) so the room, the guards and their cones,
// the cameras, the loot and the alarm meter are all visible at once.
// Style: a midnight bank — dark marble, brass trim, gold loot, amber guard
// cones and red camera cones, so safe cover, danger and loot read at a
// glance.
import {
  TILE, COLS, ROWS, VIEW_W, VIEW_H, HUD_TOP, HUD_BOTTOM, CANVAS_W, CANVAS_H,
  COLORS, GUARD_SIGHT_RANGE, GUARD_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE,
  LOCKPICK_TIME, ALARM_SUSPICIOUS, ALARM_LOCKDOWN,
} from './config.js';
import { tileAt } from './levels.js';
import { cameraAngle, laserIsLive } from './cameras.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function conePath(ctx, x, y, angle, halfAngle, range) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
}

export function render(state) {
  const ctx = state.ctx;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawFloorAndWalls(state, ctx);
  drawCones(state, ctx);
  drawLasers(state, ctx);
  drawLoot(state, ctx);
  drawDoors(state, ctx);
  drawExit(state, ctx);
  drawSmokes(state, ctx);
  drawGuards(state, ctx);
  drawPlayer(state, ctx);
  drawHud(state, ctx);
  if (state.screen === 'title') drawTitle(state, ctx);
  else if (state.screen === 'briefing') drawBriefing(state, ctx);
  else if (state.screen === 'caught') drawCaught(state, ctx);
  else if (state.screen === 'clear') drawClear(state, ctx);
  else if (state.screen === 'win') drawWin(state, ctx);
  else if (state.screen === 'paused') drawPaused(state, ctx);
}

function drawFloorAndWalls(state, ctx) {
  const grid = state.level.grid;
  const ox = 0;
  const oy = HUD_TOP;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const t = tileAt(grid, x, y);
      const px = ox + x * TILE;
      const py = oy + y * TILE;
      if (t === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        // Brass trim where a wall meets the floor.
        ctx.fillStyle = COLORS.wallEdge;
        if (tileAt(grid, x, y + 1) !== '#') ctx.fillRect(px, py + TILE - 2, TILE, 2);
        if (tileAt(grid, x, y - 1) !== '#') ctx.fillRect(px, py, TILE, 2);
        if (tileAt(grid, x + 1, y) !== '#') ctx.fillRect(px + TILE - 2, py, 2, TILE);
        if (tileAt(grid, x - 1, y) !== '#') ctx.fillRect(px, py, 2, TILE);
      } else if (t === ',') {
        // Carpet runner: flat deep plum, a faint gold edge only where the
        // runner meets bare marble, so it reads as one runner, not dashes.
        ctx.fillStyle = COLORS.carpet;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(201, 162, 39, 0.18)';
        if (tileAt(grid, x - 1, y) !== ',') ctx.fillRect(px, py, 2, TILE);
        if (tileAt(grid, x + 1, y) !== ',') ctx.fillRect(px + TILE - 2, py, 2, TILE);
      } else if (t === 'V') {
        ctx.fillStyle = COLORS.vent;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = '#3d4a63';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 9 + i * 7);
          ctx.lineTo(px + TILE - 6, py + 9 + i * 7);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(px, py, TILE, 1);
      }
      if (t === 'C') {
        ctx.fillStyle = COLORS.cover;
        rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 4);
        ctx.fill();
        ctx.strokeStyle = COLORS.coverEdge;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#5d4a2f';
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        ctx.fillStyle = '#e8e4d8';
        ctx.fillRect(px + 12, py + 12, 8, 5);
      }
    }
  }
}

function drawCones(state, ctx) {
  const oy = HUD_TOP;
  // Camera cones first (red), then guard cones (amber) on top.
  for (const cam of state.level.cameras) {
    const disabled = state.time >= cam.disabledUntil ? false : true;
    const ang = cameraAngle(cam, state.time);
    ctx.save();
    ctx.translate(cam.pos.x, oy + cam.pos.y);
    ctx.rotate(ang);
    ctx.fillStyle = disabled ? 'rgba(120,120,120,0.10)' : COLORS.cameraCone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, CAMERA_RANGE, -CAMERA_HALF_ANGLE, CAMERA_HALF_ANGLE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(150,150,150,0.35)' : COLORS.cameraConeEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  for (const guard of state.guards) {
    ctx.save();
    ctx.translate(guard.x, oy + guard.y);
    ctx.rotate(guard.angle);
    ctx.fillStyle = guard.state === 'chase' ? 'rgba(255, 80, 60, 0.28)' : COLORS.guardCone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, GUARD_SIGHT_RANGE, -GUARD_HALF_ANGLE, GUARD_HALF_ANGLE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = guard.state === 'chase' ? 'rgba(255, 80, 60, 0.6)' : COLORS.guardConeEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function drawLasers(state, ctx) {
  const oy = HUD_TOP;
  for (const laser of state.level.lasers) {
    const live = laserIsLive(laser, state.time);
    const disabled = state.time < laser.disabledUntil;
    ctx.save();
    ctx.strokeStyle = disabled ? 'rgba(120,120,120,0.5)' : live ? COLORS.laser : 'rgba(255, 59, 48, 0.25)';
    ctx.lineWidth = live ? 3 : 2;
    if (live) {
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(laser.from.x, oy + laser.from.y);
    ctx.lineTo(laser.to.x, oy + laser.to.y);
    ctx.stroke();
    ctx.restore();
    // Emitter posts.
    ctx.fillStyle = '#5a6474';
    for (const p of [laser.from, laser.to]) {
      ctx.fillRect(p.x - 4, oy + p.y - 4, 8, 8);
      ctx.fillStyle = live ? COLORS.laser : '#3a414d';
      ctx.fillRect(p.x - 2, oy + p.y - 2, 4, 4);
      ctx.fillStyle = '#5a6474';
    }
  }
}

function drawLoot(state, ctx) {
  const oy = HUD_TOP;
  const t = state.time;
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const bob = Math.sin(t * 2 + item.phase) * 2;
    const cx = item.x;
    const cy = oy + item.y + bob;
    if (item.kind === 'gold') {
      ctx.fillStyle = COLORS.gold;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.12);
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-9, -5, 18, 3);
      ctx.restore();
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 9, cy - 5, 18, 10);
    } else if (item.kind === 'cash') {
      ctx.fillStyle = COLORS.cash;
      rr(ctx, cx - 9, cy - 6, 18, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#2c6b34';
      ctx.fillRect(cx - 2, cy - 3, 4, 6);
      ctx.strokeStyle = '#2c6b34';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 9, cy - 6, 18, 12);
    } else {
      // Diamond, and the crown diamond: bigger, pink, with a sparkle.
      const big = item.kind === 'crown';
      const r = big ? 11 : 8;
      const col = big ? COLORS.crown : COLORS.diamond;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-r, -r, r, r);
      ctx.restore();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      const s = 4 + Math.sin(t * 3 + item.phase) * 2;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
      ctx.stroke();
    }
  }
  const card = state.level.keycard;
  if (card && !card.taken) {
    const cy = oy + card.y + Math.sin(t * 2 + card.phase) * 2;
    ctx.fillStyle = '#f2f2f2';
    rr(ctx, card.x - 9, cy - 6, 18, 12, 2);
    ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(card.x - 9, cy - 6, 18, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(card.x - 5, cy + 1, 10, 2);
  }
}

function drawDoors(state, ctx) {
  const oy = HUD_TOP;
  for (const door of state.level.doors) {
    if (door.open) continue;
    const px = door.x - TILE / 2;
    const py = oy + door.y - TILE / 2;
    if (door.kind === 'locked') {
      ctx.fillStyle = COLORS.doorLocked;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = '#e8c95a';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#e8c95a';
      ctx.beginPath();
      ctx.arc(door.x, oy + door.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Lockpick progress ring.
      if (door.pickProgress > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(door.x, oy + door.y, 13, -Math.PI / 2, -Math.PI / 2 + (door.pickProgress / LOCKPICK_TIME) * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = COLORS.doorKeycard;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = state.player.hasKeycard ? '#27ae60' : '#c0392b';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = state.player.hasKeycard ? '#27ae60' : '#c0392b';
      ctx.fillRect(px + TILE - 9, py + 8, 5, 8);
    }
  }
}

function drawExit(state, ctx) {
  const oy = HUD_TOP;
  const exit = state.level.exit;
  const active = exit.active;
  const pulse = active ? 0.6 + Math.sin(state.time * 4) * 0.4 : 0;
  ctx.save();
  ctx.fillStyle = active ? COLORS.exitActive : COLORS.exit;
  ctx.globalAlpha = active ? 0.85 + pulse * 0.15 : 0.55;
  rr(ctx, exit.x - 14, oy + exit.y - 14, 28, 28, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = active ? '#b8ffcf' : '#5a7a63';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(active ? '➜' : '✕', exit.x, oy + exit.y + 1);
  if (active) {
    ctx.fillStyle = '#b8ffcf';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('GETAWAY', exit.x, oy + exit.y - 22);
  }
  ctx.restore();
}

function drawSmokes(state, ctx) {
  const oy = HUD_TOP;
  for (const s of state.smokes) {
    const alpha = Math.min(1, s.ttl / 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.smoke;
    ctx.beginPath();
    ctx.arc(s.x, oy + s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x - s.radius * 0.4, oy + s.y + 6, s.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x + s.radius * 0.45, oy + s.y - 8, s.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGuards(state, ctx) {
  const oy = HUD_TOP;
  for (const guard of state.guards) {
    const gy = oy + guard.y;
    // Body: navy uniform, brass badge.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, gy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d2f4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e8c95a';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 5, gy + Math.sin(guard.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#dfe6f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.angle) * 12, gy + Math.sin(guard.angle) * 12);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, gy + Math.sin(guard.angle) * 18);
    ctx.stroke();
    // Detection arc over the head.
    if (guard.detection > 2) {
      ctx.strokeStyle = guard.detection >= 100 ? '#ff5040' : '#ffc442';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, gy, 17, -Math.PI / 2, -Math.PI / 2 + (guard.detection / 100) * Math.PI * 2);
      ctx.stroke();
    }
    // State mark.
    if (guard.state === 'chase') {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, gy - 22);
    } else if (guard.state === 'suspicious' || guard.state === 'search') {
      ctx.fillStyle = '#ffc442';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, gy - 22);
    }
  }
  // Cameras: wall mounts with a lens.
  for (const cam of state.level.cameras) {
    const disabled = state.time < cam.disabledUntil;
    const ang = cameraAngle(cam, state.time);
    ctx.fillStyle = '#5a6474';
    ctx.beginPath();
    ctx.arc(cam.pos.x, oy + cam.pos.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = disabled ? '#777' : '#ff5040';
    ctx.beginPath();
    ctx.arc(cam.pos.x + Math.cos(ang) * 5, oy + cam.pos.y + Math.sin(ang) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(state, ctx) {
  const oy = HUD_TOP;
  const p = state.player;
  const py = oy + p.y;
  // Soft shadow so the thief reads against any floor.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, py + 8, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.sneaking ? COLORS.playerSneak : COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, py, p.sneaking ? 10 : 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Mask stripe with two eyes, facing the movement direction.
  ctx.save();
  ctx.translate(p.x, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(0, -6, 9, 12);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, -3, 1.6, 0, Math.PI * 2);
  ctx.arc(4, 3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sneak = crouched dot; running = motion tick.
  if (p.sneaking) {
    ctx.fillStyle = '#7fa8e0';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', p.x, py - 17);
  }
}

function alarmColor(alarm) {
  if (alarm >= ALARM_LOCKDOWN) return '#ff5040';
  if (alarm >= ALARM_SUSPICIOUS) return '#ffc442';
  return '#37c978';
}

function drawHud(state, ctx) {
  const p = state.player;
  // Top bar.
  ctx.fillStyle = '#0d1119';
  ctx.fillRect(0, 0, CANVAS_W, HUD_TOP);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, HUD_TOP - 2, CANVAS_W, 2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`FLOOR ${state.levelIndex + 1} · ${state.level.name.toUpperCase()}`, 12, 16);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '13px sans-serif';
  ctx.fillText(`LOOT $${p.lootValue.toLocaleString()} / $${state.level.totalLoot.toLocaleString()}`, 12, 34);
  // Alarm meter, centred.
  const mw = 300;
  const mx = (CANVAS_W - mw) / 2;
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.alarm >= ALARM_LOCKDOWN ? '! ALARM !' : 'ALARM', CANVAS_W / 2, 12);
  ctx.fillStyle = '#1a2233';
  rr(ctx, mx, 22, mw, 12, 6);
  ctx.fill();
  ctx.fillStyle = alarmColor(state.alarm);
  if (state.alarm > 0.5) {
    rr(ctx, mx, 22, Math.max(12, (mw * state.alarm) / 100), 12, 6);
    ctx.fill();
  }
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 1;
  rr(ctx, mx, 22, mw, 12, 6);
  ctx.stroke();
  // Right: timer and score.
  ctx.textAlign = 'right';
  ctx.fillStyle = state.timeLeft < 30 ? '#ff5040' : '#e8e4d8';
  ctx.font = 'bold 14px sans-serif';
  const mm = Math.floor(state.timeLeft / 60);
  const ss = Math.floor(state.timeLeft % 60).toString().padStart(2, '0');
  ctx.fillText(`⏱ ${mm}:${ss}`, CANVAS_W - 12, 16);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '13px sans-serif';
  ctx.fillText(`SCORE ${state.score.toLocaleString()}`, CANVAS_W - 12, 34);
  // Bottom bar.
  ctx.fillStyle = '#0d1119';
  ctx.fillRect(0, CANVAS_H - HUD_BOTTOM, CANVAS_W, HUD_BOTTOM);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, CANVAS_H - HUD_BOTTOM, CANVAS_W, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '13px sans-serif';
  const tools = `SMOKE ×${p.smoke} [click]    EMP ×${p.emp} [Q]    ${p.hasKeycard ? 'KEYCARD ✓' : ''}`;
  ctx.fillText(tools, 12, CANVAS_H - 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9aa5b8';
  let hint = 'WASD move · Shift sneak · hold E to pick a lock · R retry · M mute · P pause';
  const door = p.lockpickTarget;
  if (door && door.kind === 'keycard' && !p.hasKeycard) hint = 'THIS DOOR NEEDS THE KEYCARD — find it in the guard office';
  else if (door && door.kind === 'locked') hint = 'PICKING THE LOCK… keep holding E';
  else if (state.level.exit.active) hint = 'EXIT OPEN — GET TO THE GETAWAY!';
  ctx.fillText(hint, CANVAS_W - 12, CANVAS_H - 20);
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(6, 8, 13, ${alpha})`;
  ctx.fillRect(0, HUD_TOP, VIEW_W, VIEW_H);
}

function panel(ctx, y, h) {
  ctx.fillStyle = 'rgba(13, 17, 25, 0.92)';
  rr(ctx, VIEW_W / 2 - 330, y, 660, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(state, ctx) {
  overlay(ctx, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('AURUM HEIST', VIEW_W / 2, HUD_TOP + 150);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Three floors of the Meridian Bank. One thief. No witnesses.', VIEW_W / 2, HUD_TOP + 195);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#9aa5b8';
  ctx.fillText('Guards sweep their cones. Cameras never blink. Lasers pulse.', VIEW_W / 2, HUD_TOP + 230);
  ctx.fillText('Take the loot, mind the alarm meter, and get to the getaway.', VIEW_W / 2, HUD_TOP + 254);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Press ENTER or click to start the job', VIEW_W / 2, HUD_TOP + 330);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#9aa5b8';
  ctx.fillText('WASD / arrows — move      Shift — sneak      Click — throw smoke', VIEW_W / 2, HUD_TOP + 380);
  ctx.fillText('Hold E — pick a lock      Q — EMP burst      R — retry      M — mute', VIEW_W / 2, HUD_TOP + 404);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game built for the make.fun Best Heist Game bounty', VIEW_W / 2, HUD_TOP + 470);
}

function drawBriefing(state, ctx) {
  overlay(ctx, 0.6);
  panel(ctx, HUD_TOP + 130, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(`FLOOR ${state.levelIndex + 1} — ${state.level.name.toUpperCase()}`, VIEW_W / 2, HUD_TOP + 185);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '16px sans-serif';
  const words = state.level.brief.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 62) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, HUD_TOP + 225 + i * 24));
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`LOOT TARGET  $${state.level.totalLoot.toLocaleString()}`, VIEW_W / 2, HUD_TOP + 225 + lines.length * 24 + 14);
  ctx.fillStyle = '#9aa5b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Time limit ${Math.floor(state.timeLimit / 60)}:${String(state.timeLimit % 60).padStart(2, '0')}  ·  Smoke ×${state.player.smoke}  ·  EMP ×${state.player.emp}`, VIEW_W / 2, HUD_TOP + 225 + lines.length * 24 + 40);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press ENTER to begin', VIEW_W / 2, HUD_TOP + 390);
}

function drawCaught(state, ctx) {
  overlay(ctx, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5040';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('BUSTED!', VIEW_W / 2, HUD_TOP + 220);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '19px sans-serif';
  ctx.fillText(state.caughtReason || 'A guard caught you red-handed.', VIEW_W / 2, HUD_TOP + 265);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#9aa5b8';
  ctx.fillText(`Loot kept from this floor: $${state.player.lootValue.toLocaleString()} — it stays in the vault.`, VIEW_W / 2, HUD_TOP + 300);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Press R to retry this floor · Enter for the title screen', VIEW_W / 2, HUD_TOP + 360);
}

function drawClear(state, ctx) {
  overlay(ctx, 0.6);
  panel(ctx, HUD_TOP + 120, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(state.levelIndex + 1 >= 3 ? 'THE PERFECT JOB' : 'FLOOR CLEARED', VIEW_W / 2, HUD_TOP + 175);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '16px sans-serif';
  const b = state.lastBreakdown;
  ctx.fillText(`Loot taken   $${b.loot.toLocaleString()}`, VIEW_W / 2, HUD_TOP + 225);
  ctx.fillText(`Time bonus   $${b.timeBonus.toLocaleString()}  (${Math.round(b.timeLeft)}s left)`, VIEW_W / 2, HUD_TOP + 252);
  ctx.fillText(b.ghost ? `Ghost bonus  $${b.ghostBonus.toLocaleString()}  (never raised the alarm)` : 'Ghost bonus  $0  (the alarm saw you)', VIEW_W / 2, HUD_TOP + 279);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Floor total  $${b.total.toLocaleString()}      ·      Score so far  ${state.score.toLocaleString()}`, VIEW_W / 2, HUD_TOP + 315);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(state.levelIndex + 1 >= 3 ? 'Press ENTER for the final score' : 'Press ENTER for the next floor', VIEW_W / 2, HUD_TOP + 380);
}

function drawWin(state, ctx) {
  overlay(ctx, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('THE PERFECT JOB', VIEW_W / 2, HUD_TOP + 210);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Every floor cracked. Every guard outplayed. The Aurum is yours.', VIEW_W / 2, HUD_TOP + 260);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`FINAL SCORE  ${state.score.toLocaleString()}`, VIEW_W / 2, HUD_TOP + 320);
  ctx.fillStyle = '#9aa5b8';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Loot $${state.totalLootValue.toLocaleString()} across three floors`, VIEW_W / 2, HUD_TOP + 355);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press ENTER to run it back', VIEW_W / 2, HUD_TOP + 420);
}

function drawPaused(state, ctx) {
  overlay(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', VIEW_W / 2, HUD_TOP + 300);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#9aa5b8';
  ctx.fillText('Press P to keep the job going', VIEW_W / 2, HUD_TOP + 340);
}
