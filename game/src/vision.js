// Aurum Heist — sight. Line of sight over the tile grid, vision-cone
// tests, and the things that defeat sight: walls, cover, closed doors,
// smoke clouds, and the vents the thief crawls through (a thief in a vent
// cannot be seen at all).
import { TILE, COLS, ROWS } from './config.js';
import { tileAt, blocksSight } from './levels.js';

function pointInSmoke(smokes, x, y) {
  for (const s of smokes) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.radius * s.radius) return true;
  }
  return false;
}

// Grid raycast (DDA): true when no sight-blocking tile lies between the
// two points. Endpoints on a blocking tile still count as seen from it.
export function hasLineOfSight(grid, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  const step = TILE / 4;
  const steps = Math.ceil(dist / step);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x1 + dx * t) / TILE);
    const ty = Math.floor((y1 + dy * t) / TILE);
    if (blocksSight(grid, tx, ty)) return false;
  }
  return true;
}

// Is the thief visible to an observer at (ox, oy) facing `angle`, with a
// cone of `halfAngle` and a `range`? Sight also fails through smoke and
// when the thief is inside a vent.
export function canSee(grid, smokes, ox, oy, angle, halfAngle, range, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1) {
    let diff = Math.atan2(dy, dx) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > halfAngle) return false;
  }
  // A thief in a vent is out of sight, however close the cone sweeps.
  const ptx = Math.floor(px / TILE);
  const pty = Math.floor(py / TILE);
  if (ptx >= 0 && pty >= 0 && ptx < COLS && pty < ROWS && tileAt(grid, ptx, pty) === 'V') return false;
  // Smoke hides both ways.
  if (pointInSmoke(smokes, px, py) || pointInSmoke(smokes, ox, oy)) return false;
  return hasLineOfSight(grid, ox, oy, px, py);
}

// Distance from a point to a segment (for laser crossings).
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
