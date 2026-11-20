// Menus: the title screen with its roster and save state, pause, game
// over (wasted / busted) and the story-complete screen. Buttons are plain
// DOM; the game loop owns the screens, this module only shows them.
export function createUI(callbacks) {
  const screens = {
    title: document.getElementById('screen-title'),
    paused: document.getElementById('screen-paused'),
    stats: document.getElementById('screen-stats'),
    over: document.getElementById('screen-over'),
    complete: document.getElementById('screen-complete'),
  };
  const hud = document.getElementById('hud');

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
    }
    if (hud) hud.classList.toggle('hidden', name === 'title');
    if (name === 'title' && callbacks.onTitle) callbacks.onTitle();
  }

  function bind(id, fn) {
    const node = document.getElementById(id);
    if (node) node.addEventListener('click', fn);
  }

  bind('btn-continue', () => callbacks.onContinue && callbacks.onContinue());
  bind('btn-new', () => callbacks.onNewGame && callbacks.onNewGame());
  bind('btn-resume', () => callbacks.onResume && callbacks.onResume());
  bind('btn-stats', () => callbacks.onStats && callbacks.onStats());
  bind('btn-stats-back', () => callbacks.onStatsBack && callbacks.onStatsBack());
  bind('btn-restart', () => callbacks.onRestart && callbacks.onRestart());
  bind('btn-again', () => callbacks.onRestart && callbacks.onRestart());
  bind('btn-title', () => showScreen('title'));
  bind('btn-howto', () => {
    const panel = document.getElementById('howto-panel');
    if (panel) panel.classList.toggle('hidden');
  });
  bind('btn-radio', () => callbacks.onRadio && callbacks.onRadio());
  bind('btn-camera', () => callbacks.onCamera && callbacks.onCamera());
  bind('btn-mute', () => callbacks.onMute && callbacks.onMute());

  return {
    showScreen,
    setOverTitle(text, sub) {
      const t = document.getElementById('over-title');
      const s = document.getElementById('over-sub');
      if (t) t.textContent = text;
      if (s) s.textContent = sub;
    },
    setSaveLine(text) {
      const node = document.getElementById('save-line');
      if (node) node.textContent = text;
      const cont = document.getElementById('btn-continue');
      if (cont) cont.disabled = !text;
    },
    setSettingsLine(text) {
      const node = document.getElementById('settings-line');
      if (node) node.textContent = text;
    },
    setStats(html) {
      const node = document.getElementById('stats-rows');
      if (node) node.innerHTML = html;
    },
  };
}
