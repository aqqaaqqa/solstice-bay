// Keyboard, mouse and one-shot actions. Held keys are read every frame;
// presses (confirm, pause, enter car, weapon, radio, camera) are queued as
// flags and taken once, so a press between frames is never lost or doubled.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_WEAPON = 8;
export const ACTION_RADIO = 16;
export const ACTION_CAMERA = 32;
export const ACTION_HORN = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let camYawDelta = 0;
  let camPitchDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let clicked = false;
  let clickX = 0;
  let clickY = 0;

  const press = (code) => {
    switch (code) {
      case 'Space': case 'Enter': actions |= ACTION_CONFIRM; break;
      case 'KeyP': case 'Escape': actions |= ACTION_PAUSE; break;
      case 'KeyE': actions |= ACTION_ENTER; break;
      case 'KeyQ': actions |= ACTION_WEAPON; break;
      case 'KeyR': actions |= ACTION_RADIO; break;
      case 'KeyC': actions |= ACTION_CAMERA; break;
      case 'KeyH': actions |= ACTION_HORN; break;
      default: break;
    }
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    press(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); dragging = false; });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clicked = true;
    clickX = event.clientX;
    clickY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    camYawDelta += (event.clientX - lastX) * 0.005;
    camPitchDelta += (event.clientY - lastY) * 0.01;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  const has = (...codes) => codes.some((c) => keys.has(c));

  return {
    keys,
    // -1..1 forward/back for driving and walking.
    throttle() {
      return (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 0.7 : 0);
    },
    // -1 left, 1 right.
    steer() {
      return (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    strafe() {
      return (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    },
    sprint() { return has('ShiftLeft', 'ShiftRight'); },
    handbrake() { return has('Space'); },
    firing() { return has('KeyJ') || has('Mouse0'); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeCamDelta() {
      const d = { yaw: camYawDelta, pitch: camPitchDelta };
      camYawDelta = 0;
      camPitchDelta = 0;
      return d;
    },
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    // Test / autopilot helper: pretend keys are held.
    setKey(code, down) {
      if (down) keys.add(code);
      else keys.delete(code);
    },
  };
}
