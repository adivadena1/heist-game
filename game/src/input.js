// Aurum Heist — keyboard and mouse. WASD or arrows to move, Shift to
// sneak, E to pick a lock or use a keycard door, Q for an EMP burst,
// left-click to throw a smoke pellet at the cursor. Enter advances menus,
// R retries a busted level, M mutes, P pauses.
export function makeInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    interact: false,
    // One-shot actions, consumed by the game loop each frame.
    queued: [],
    mouseX: 0,
    mouseY: 0,
  };

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
    KeyE: 'interact',
  };

  function canvasPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    const field = keyMap[event.code];
    if (field) {
      input[field] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter') input.queued.push('confirm');
    else if (event.code === 'KeyR') input.queued.push('retry');
    else if (event.code === 'KeyQ') input.queued.push('emp');
    else if (event.code === 'KeyM') input.queued.push('mute');
    else if (event.code === 'KeyP' || event.code === 'Escape') input.queued.push('pause');
    else if (event.code === 'Space') { input.queued.push('confirm'); event.preventDefault(); }
  });

  window.addEventListener('keyup', (event) => {
    const field = keyMap[event.code];
    if (field) input[field] = false;
  });

  window.addEventListener('blur', () => {
    input.up = false; input.down = false; input.left = false; input.right = false;
    input.sneak = false; input.interact = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPos(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = canvasPos(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.queued.push({ type: 'click', x: p.x, y: p.y });
  });

  // For scripted play (screenshots and the dev harness): pretend a key is
  // held, or queue a one-shot action, exactly as a real keypress would.
  input.press = function press(code) {
    const field = keyMap[code];
    if (field) input[field] = true;
  };
  input.release = function release(code) {
    const field = keyMap[code];
    if (field) input[field] = false;
  };
  input.queue = function queue(action) { input.queued.push(action); };

  return input;
}
