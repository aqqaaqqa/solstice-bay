// Solstice Bay — boot, the fixed-step loop and every system wired together.
// Built in this session for Ming's make.fun gta6-01 entry: a playable 3D
// open-world crime game in the browser, three.js, seven story jobs.
import * as THREE from 'three';
import { STEP, MISSIONS, RADIO } from './config.js';
import { createRandom } from './random.js';
import { buildCity, resolveCollisions } from './city.js';
import { createStage } from './render.js';
import { makeCar, makePerson, animateWalk, updateCar, carForward } from './vehicles.js';
import { createTraffic, updateTraffic, nearestCar } from './traffic.js';
import { createPolice, updatePolice, noteCrime } from './police.js';
import { createCombat, fireWeapon, updateEnemies, clearEnemies } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createUI } from './ui.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_WEAPON, ACTION_RADIO, ACTION_CAMERA } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, defaultSave, readBest, writeBest } from './save.js';
import { stageShot, shotInput } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const saveData = loadSave();

// The shared game object every system reads and writes.
const G = {
  THREE, time: 0, screen: 'title', firing: false, gunshotAt: 0,
  policeBehaviours: [], scriptInput: null, best: readBest(),
};
G.stage = createStage(canvas);
G.scene = G.stage.scene;
G.city = buildCity(THREE, rng);
G.scene.add(G.city.group);

G.player = {
  pos: new THREE.Vector3(G.city.spawn.x, 0, G.city.spawn.z),
  heading: Math.PI, speed: 0, onFoot: true,
  health: 100, armour: 100,
  money: saveData.money, rep: saveData.rep, day: saveData.day,
  wanted: 0, weapon: 'pistol', ammo: { pistol: 120, smg: 0 },
};
G.playerMesh = makePerson(THREE, 0x2a7a6a, 0x2c3242, 0xe8b88a);
G.playerMesh.group.position.copy(G.player.pos);
G.scene.add(G.playerMesh.group);

G.traffic = createTraffic(THREE, G.scene, G.city, rng);
G.police = createPolice(THREE, G.scene);
G.combat = createCombat();
G.hud = createHud();
G.audio = createAudio();
G.input = createInput(canvas);
G.playerCar = null;
G.parkedCars = [];

G.save = () => {
  writeSave({
    mission: G.missions.state.index, money: G.player.money, rep: G.player.rep,
    day: G.player.day, best: G.best, radio: G.radioIndex, camera: G.stage.cam.mode,
    muted: G.muted,
  });
  if (G.player.money > G.best) {
    G.best = G.player.money;
    writeBest(G.best);
  }
};
G.radioIndex = saveData.radio || 0;
G.muted = !!saveData.muted;
G.audio.setStation(G.radioIndex);
G.audio.setMuted(G.muted);
G.stage.cam.mode = saveData.camera || 'chase';

G.onCrime = (type) => {
  const p = G.player;
  if (type === 'shot-fired') {
    if (p.wanted < 2) p.wanted += 1;
  } else {
    p.wanted = Math.min(5, p.wanted + 1);
  }
  noteCrime(G.police, G.time);
};
G.onEnemyDown = () => { if (G.missions) G.missions.onKill(); };
G.onBusted = () => endRun('BUSTED', 'The SBPD took Rae in. The garage waits — and so does Marlow.');
G.onWasted = () => endRun('WASTED', 'Solstice Bay is not done with you yet.');

G.missions = createMissions(THREE, G.scene, G);

function parkPlayerCar(kind, x, z, heading) {
  const car = makeCar(THREE, kind);
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.group.rotation.y = heading;
  G.scene.add(car.group);
  G.parkedCars.push(car);
  return car;
}
G.parkPlayerCar = parkPlayerCar;

function enterCar(car) {
  if (!car || G.playerCar) return;
  const ti = G.traffic.cars.indexOf(car);
  if (ti >= 0) {
    G.traffic.cars.splice(ti, 1);
    G.onCrime('steal');
    G.hud.showToast('Car stolen — the SBPD noticed.');
  }
  const pi = G.parkedCars.indexOf(car);
  if (pi >= 0) G.parkedCars.splice(pi, 1);
  G.playerCar = car;
  car.isPlayer = true;
  G.player.onFoot = false;
  G.playerMesh.group.visible = false;
  G.audio.blip();
}
G.enterCar = enterCar;

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  const f = carForward(car);
  G.player.pos.set(car.pos.x - f.z * 2.4, 0, car.pos.z + f.x * 2.4);
  resolveCollisions(G.city, G.player.pos, 0.7);
  G.player.heading = car.heading;
  G.player.onFoot = true;
  G.playerMesh.group.visible = true;
  G.playerMesh.group.position.copy(G.player.pos);
  G.parkedCars.push(car);
  G.playerCar = null;
}
G.exitCar = exitCar;

function nearestEnterable() {
  const p = G.player.pos;
  let best = nearestCar(G.traffic, p.x, p.z, 5.5);
  let bestD = best ? (best.pos.x - p.x) ** 2 + (best.pos.z - p.z) ** 2 : Infinity;
  for (const car of G.parkedCars) {
    const d = (car.pos.x - p.x) ** 2 + (car.pos.z - p.z) ** 2;
    if (d < bestD && d < 30) { bestD = d; best = car; }
  }
  return best;
}

function endRun(title, sub) {
  if (G.screen === 'over') return;
  G.screen = 'over';
  G.save();
  G.audio.busted();
  G.ui.setOverTitle(title, sub);
  G.ui.showScreen('over');
  if (status) status.textContent = `${title}. ${sub}`;
}

function startPlay(missionIndex) {
  G.player.health = 100;
  G.player.armour = 100;
  G.player.wanted = 0;
  G.player.pos.set(G.city.spawn.x, 0, G.city.spawn.z);
  G.player.heading = Math.PI;
  if (G.playerCar) exitCar();
  G.playerMesh.group.visible = true;
  G.playerMesh.group.position.copy(G.player.pos);
  clearEnemies(G.combat, G.scene);
  G.missions.startMission(missionIndex);
  G.screen = 'play';
  G.ui.showScreen('play');
  G.audio.ensure();
  G.audio.setRadio(true);
  if (status) status.textContent = 'Playing Solstice Bay.';
}

G.ui = createUI({
  onContinue: () => startPlay(Math.min(saveData.mission, MISSIONS.length - 1)),
  onNewGame: () => {
    const fresh = defaultSave();
    Object.assign(saveData, fresh);
    G.player.money = fresh.money;
    G.player.rep = fresh.rep;
    G.player.day = fresh.day;
    G.player.ammo = { pistol: 120, smg: 0 };
    G.player.weapon = 'pistol';
    startPlay(0);
  },
  onResume: () => { G.screen = 'play'; G.ui.showScreen('play'); },
  onRestart: () => startPlay(G.missions.state.index),
  onRadio: () => {
    G.radioIndex = (G.radioIndex + 1) % RADIO.length;
    G.audio.setStation(G.radioIndex);
    G.audio.blip();
    refreshSettings();
  },
  onCamera: () => {
    G.stage.cam.mode = G.stage.cam.mode === 'chase' ? 'classic' : 'chase';
    refreshSettings();
  },
  onMute: () => {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    refreshSettings();
  },
  onTitle: () => { refreshSettings(); refreshSaveLine(); },
});

function refreshSettings() {
  G.ui.setSettingsLine(`${RADIO[G.radioIndex].name} · ${G.stage.cam.mode === 'chase' ? 'Chase' : 'Classic'} camera · Sound ${G.muted ? 'off' : 'on'}`);
}
function refreshSaveLine() {
  const s = loadSave();
  if (s.mission > 0 || s.money > 250) {
    G.ui.setSaveLine(`Ch.${s.mission + 1} · $${s.money.toLocaleString('en-US')} · Day ${s.day} — the garage is still Marlow's.`);
  } else {
    G.ui.setSaveLine('');
  }
}

// Rae's sedan waits a few steps past the garage, facing the street so she
// can walk straight to it from where she spawns.
parkPlayerCar('sedan', G.city.garage.x, G.city.garage.z + 13, Math.PI);
parkPlayerCar('pickup', -60, 120, 0);
parkPlayerCar('taxi', 120, 60, Math.PI / 2);

// One fixed step of the whole game.
function stepWorld(dt, scripted) {
  G.time += dt;
  const input = scripted || null;
  const camDelta = input ? { yaw: 0, pitch: 0 } : G.input.takeCamDelta();
  G.stage.cam.yaw += camDelta.yaw;
  G.stage.cam.yaw = Math.max(-1.2, Math.min(1.2, G.stage.cam.yaw));
  G.stage.cam.pitch = Math.max(-2, Math.min(3, G.stage.cam.pitch + camDelta.pitch));
  const actions = input ? 0 : G.input.takeActions();
  const click = input ? null : G.input.takeClick();
  let confirm = !!(actions & ACTION_CONFIRM);

  if (G.screen === 'title') {
    if (confirm) { startPlay(Math.min(saveData.mission, MISSIONS.length - 1)); return; }
    // Ambient title: traffic rolls, the wheel turns, camera orbits the bay.
    updateTraffic(G.traffic, dt, G);
    G.city.wheel.rotation.z += dt * 0.12;
    const a = G.time * 0.05;
    G.stage.camera.position.set(Math.sin(a) * 190, 55, Math.cos(a) * 190);
    G.stage.camera.lookAt(-60, 8, 0);
    G.stage.updateParticles(dt);
    return;
  }
  if (G.screen !== 'play') {
    if (G.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      G.screen = 'play';
      G.ui.showScreen('play');
    } else if (G.screen === 'over' && confirm) {
      startPlay(G.missions.state.index);
    }
    return;
  }

  if (actions & ACTION_PAUSE) {
    G.screen = 'paused';
    G.ui.showScreen('paused');
    return;
  }
  if (actions & ACTION_ENTER) {
    if (G.playerCar) exitCar();
    else {
      const car = nearestEnterable();
      if (car) enterCar(car);
    }
  }
  if (actions & ACTION_WEAPON) {
    const owned = ['fists', 'pistol'];
    if (G.player.rep >= 20) owned.push('smg');
    const i = owned.indexOf(G.player.weapon);
    G.player.weapon = owned[(i + 1) % owned.length];
    G.audio.blip();
  }
  if (actions & ACTION_RADIO) {
    G.radioIndex = (G.radioIndex + 1) % RADIO.length;
    G.audio.setStation(G.radioIndex);
  }
  if (actions & ACTION_CAMERA) {
    G.stage.cam.mode = G.stage.cam.mode === 'chase' ? 'classic' : 'chase';
  }

  const p = G.player;
  const throttle = input ? input.throttle : G.input.throttle();
  const steer = input ? input.steer : G.input.steer();
  G.firing = input ? false : (G.input.firing() || click !== null);

  if (G.playerCar) {
    const car = G.playerCar;
    const hit = updateCar(car, { throttle, steer, handbrake: input ? input.handbrake : G.input.handbrake() }, dt, G.city);
    if (hit && Math.abs(car.speed) > 12) {
      G.stage.addShake(0.35);
      G.stage.spawnBurst(car.pos.x, 1, car.pos.z, 0xffc860, 8, 4, 3);
    }
    p.pos.copy(car.pos);
    p.heading = car.heading;
    p.speed = car.speed;
    if (car.damage >= 100) {
      G.stage.spawnBurst(car.pos.x, 1.5, car.pos.z, 0xff6a3c, 40, 9, 9);
      G.stage.addShake(1);
      G.audio.gunshot();
      exitCar();
      p.health = Math.max(1, p.health - 25);
    }
  } else {
    const run = input ? false : G.input.sprint();
    const speed = run ? 10 : 6.5;
    const move = throttle;
    const turn = steer;
    p.heading += turn * 2.6 * dt;
    const mx = Math.sin(p.heading) * move * speed;
    const mz = Math.cos(p.heading) * move * speed;
    p.pos.x += mx * dt;
    p.pos.z += mz * dt;
    p.speed = Math.abs(move) * speed;
    resolveCollisions(G.city, p.pos, 0.7);
    p.pos.y = 0;
    G.playerMesh.group.position.copy(p.pos);
    G.playerMesh.group.rotation.y = p.heading;
    animateWalk(G.playerMesh, Math.abs(move) > 0.1, dt);
  }

  updateTraffic(G.traffic, dt, G);
  G.policeBehaviours = updatePolice(G.police, dt, G);
  G.gunshotAt = G.combat.gunshotAt;
  fireWeapon(G.combat, dt, G);
  updateEnemies(G.combat, dt, G);
  G.missions.update(dt);
  G.city.wheel.rotation.z += dt * 0.12;
  if (p.armour < 100 && p.health > 0) p.armour = Math.min(100, p.armour + dt * 1.5);
  if (p.health <= 0) { G.onWasted(); return; }

  const target = G.playerCar ? G.playerCar.pos : p.pos;
  G.stage.updateCamera(target, p.heading, p.speed, dt, !G.playerCar);
  G.stage.updateParticles(dt);
  G.audio.engine(G.playerCar ? Math.abs(G.playerCar.speed) / 46 : Math.abs(p.speed) / 10, !!G.playerCar);
  G.audio.update(dt);
  G.hud.update(dt, G, confirm);
  if (status && G.missions.current()) status.textContent = G.missions.current().text;
}

function runShot(name) {
  const staged = stageShot(name, G);
  G.ui.showScreen(staged.screen === 'title' ? 'title' : 'play');
  if (staged.screen === 'title') {
    G.playerMesh.group.position.copy(G.player.pos);
    G.playerMesh.group.rotation.y = G.player.heading;
    G.stage.camera.position.set(-120, 18, 130);
    G.stage.camera.lookAt(-170, 4, 40);
  } else {
    for (let i = 0; i < staged.steps; i += 1) {
      stepWorld(STEP, shotInput(G, name));
      if (G.screen !== 'play') break;
    }
    const target = G.playerCar ? G.playerCar.pos : G.player.pos;
    G.stage.updateCamera(target, G.player.heading, G.player.speed, 1, !G.playerCar);
    G.hud.update(0, G, false);
  }
  let painted = 0;
  function paint() {
    G.stage.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;
  const MAX_FRAME = 0.25;
  refreshSaveLine();
  refreshSettings();
  G.ui.showScreen('title');
  if (status) status.textContent = 'Solstice Bay. Press Space or click to start.';
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      stepWorld(STEP, null);
      accumulator -= STEP;
      if (G.screen === 'paused' || G.screen === 'over' || G.screen === 'complete') {
        accumulator = 0;
        break;
      }
    }
    if (G.screen === 'title') {
      // Title ambient already stepped in the loop above; just render.
    }
    G.stage.render();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
