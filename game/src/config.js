// Aurum Heist — tuning constants. One place for every number the game
// balances on, so a tweak never means hunting through the logic.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640
export const HUD_TOP = 46;
export const HUD_BOTTOM = 40;
export const CANVAS_W = VIEW_W;
export const CANVAS_H = HUD_TOP + VIEW_H + HUD_BOTTOM; // 726

// Player movement (pixels per second).
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 85;
export const PLAYER_RADIUS = 11;

// Guards.
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 118;
export const GUARD_SEARCH_SPEED = 82;
export const GUARD_SIGHT_RANGE = 170;
export const GUARD_HALF_ANGLE = (32 * Math.PI) / 180;
export const GUARD_WAYPOINT_PAUSE = 1.2; // seconds stood at each waypoint, scanning
export const GUARD_DETECTION_RATE = 60; // per second at point blank, scaled by distance
export const GUARD_LOSE_SIGHT_TIME = 3.0; // seconds without sight before chase gives up
export const GUARD_SEARCH_TIME = 4.0;
export const GUARD_SUSPICIOUS_TIME = 2.5;
export const CATCH_DISTANCE = 16; // guard touches the thief while chasing / in lockdown
export const BUMP_DISTANCE = 14; // bumping into any guard is instant full detection

// Cameras.
export const CAMERA_RANGE = 195;
export const CAMERA_HALF_ANGLE = (26 * Math.PI) / 180;
export const CAMERA_EXPOSURE_RATE = 78; // per second while the thief is in the cone

// Alarm meter (0..100). Rises toward the worst thing currently seeing the
// thief, decays when nobody sees them. Laser hits and EMP add spikes.
export const ALARM_DECAY = 6;
export const ALARM_SUSPICIOUS = 40; // nearest guard investigates past here
export const ALARM_LOCKDOWN = 80; // every guard converges past here
export const LASER_ALARM_SPIKE = 30;
export const EMP_ALARM_SPIKE = 12;
export const GHOST_BONUS_MAX_ALARM = 50; // stay under this all level for the bonus

// Tools. Stock refills at the start of every level.
export const SMOKE_START = 3;
export const SMOKE_RANGE = 6 * TILE; // how far a pellet can be thrown
export const SMOKE_RADIUS = 2.5 * TILE;
export const SMOKE_DURATION = 5.0;
export const EMP_START = 2;
export const EMP_DISABLE_TIME = 6.0; // cameras and lasers dark for this long
export const EMP_NOISE_RADIUS = 280;
export const LOCKPICK_TIME = 2.0; // seconds holding E beside a locked door
export const LOCKPICK_NOISE_RADIUS = 140;

// Noise. Running is loud, sneaking is nearly silent.
export const RUN_NOISE_RADIUS = 110;
export const RUN_NOISE_INTERVAL = 0.35;
export const SNEAK_NOISE_RADIUS = 28;

// Loot values in dollars.
export const VALUE_GOLD = 500;
export const VALUE_CASH = 250;
export const VALUE_DIAMOND = 1000;
export const VALUE_CROWN = 1500;

// Scoring.
export const TIME_BONUS_PER_SECOND = 5;
export const GHOST_BONUS = 500;

// Level time limits in seconds (the police arrive when one runs out).
export const LEVEL_TIME_LIMITS = [180, 210, 240];

// Colours — the look: midnight bank, marble, brass and gold.
export const COLORS = {
  floorA: '#232a3a',
  floorB: '#202636',
  carpet: '#2c2438',
  wall: '#12161f',
  wallEdge: '#c9a227',
  cover: '#3a2f22',
  coverEdge: '#8a6d3b',
  doorLocked: '#6b4f1d',
  doorKeycard: '#39424f',
  vent: '#161c28',
  exit: '#1d7a3a',
  exitActive: '#27ae60',
  gold: '#ffd94d',
  cash: '#7ddb8a',
  diamond: '#7fe7f2',
  crown: '#ff9df5',
  guard: '#4a6fa5',
  guardCone: 'rgba(255, 196, 66, 0.20)',
  guardConeEdge: 'rgba(255, 196, 66, 0.45)',
  cameraCone: 'rgba(255, 70, 70, 0.18)',
  cameraConeEdge: 'rgba(255, 70, 70, 0.5)',
  laser: '#ff3b30',
  smoke: 'rgba(200, 205, 215, 0.55)',
  player: '#e8e4d8',
  playerSneak: '#b9c4d6',
};
