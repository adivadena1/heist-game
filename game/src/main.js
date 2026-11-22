// Aurum Heist — boot. Sizes the canvas, wires input and the game loop,
// starts the screenshot stager when the URL asks for a scene, and reports
// load errors where the dev harness can see them.
import { CANVAS_W, CANVAS_H } from './config.js';
import { mulberry32, parseSeed } from './random.js';
import { makeInput } from './input.js';
import { createGame } from './game.js';
import { installShots } from './shots.js';

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error));
});

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const rng = mulberry32(parseSeed(window.location.search));
const input = makeInput(canvas);
const state = createGame(canvas, input, rng, {});
installShots(state, input);
