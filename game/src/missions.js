// The story engine: seven jobs for Rae Calloway, each a short list of
// steps — go somewhere, deliver against a clock, tail a car, hold a spot,
// clear a fight, lose the heat. Steps drive the marker, the HUD banner
// and the dialogue; finishing a job pays money and reputation.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { makeCar } from './vehicles.js';

export function createMissions(THREE_, scene, G) {
  // The waypoint beacon: a glowing pillar the player can see across town.
  const beacon = new THREE_.Group();
  const pillar = new THREE_.Mesh(
    new THREE_.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
    new THREE_.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.13, side: THREE_.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const diamond = new THREE_.Mesh(
    new THREE_.OctahedronGeometry(1.7),
    new THREE_.MeshBasicMaterial({ color: 0xf2c230 }),
  );
  diamond.position.y = 11;
  beacon.add(diamond);
  const ring = new THREE_.Mesh(
    new THREE_.RingGeometry(4, 5.4, 24),
    new THREE_.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.8, side: THREE_.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  const state = {
    index: 0,
    step: 0,
    timer: 0,
    progress: 0,
    kills: 0,
    active: false,
    done: false,
    tailCar: null,
    tailSpotted: false,
    failTimer: 0,
  };

  function stepDef() {
    const m = MISSIONS[state.index];
    if (!m) return null;
    return m.steps[state.step] || null;
  }

  function targetPos() {
    const s = stepDef();
    if (!s) return null;
    if (state.tailCar) return { x: state.tailCar.pos.x, z: state.tailCar.pos.z };
    return { x: s.target[0], z: s.target[1] };
  }

  function placeBeacon() {
    const t = targetPos();
    if (!t || !state.active) {
      beacon.visible = false;
      return;
    }
    beacon.visible = true;
    beacon.position.set(t.x, 0, t.z);
  }

  function beginStep() {
    const s = stepDef();
    state.timer = s && s.time ? s.time : 0;
    state.progress = 0;
    state.kills = 0;
    clearEnemies(G.combat, G.scene);
    if (state.tailCar) {
      G.scene.remove(state.tailCar.group);
      state.tailCar = null;
    }
    if (s && s.type === 'tail') {
      const car = makeCar(THREE_, 'sedan', 0x2a2a2e);
      car.isTraffic = true;
      car.pos.set(0, 0, 40);
      car.heading = 0;
      car.cruise = 13;
      car.speed = 13;
      car.axis = 'z';
      car.line = 0;
      car.lane = 3.5;
      G.scene.add(car.group);
      state.tailCar = car;
    }
    if (s && s.type === 'fight') {
      const t = s.target;
      for (let i = 0; i < s.count; i += 1) {
        spawnEnemy(G.combat, THREE_, G.scene, t[0] + (i % 3) * 8 - 8, t[1] + Math.floor(i / 3) * 8 - 4, Math.random);
      }
    }
    placeBeacon();
  }

  function startMission(i) {
    state.index = i;
    state.step = 0;
    state.active = true;
    state.done = false;
    const m = MISSIONS[i];
    if (!m) return;
    if (G.hud) G.hud.showDialogue(m.intro);
    if (G.audio) G.audio.jingle();
    beginStep();
  }

  function nextStep() {
    const s = stepDef();
    if (s && s.reward) {
      G.player.money += s.reward;
      G.player.rep += 10;
      if (G.hud) G.hud.showToast(`Job paid: $${s.reward}`);
      if (G.audio) G.audio.jingle();
    }
    state.step += 1;
    const m = MISSIONS[state.index];
    if (!m || state.step >= m.steps.length) {
      finishMission();
      return;
    }
    beginStep();
  }

  function finishMission() {
    state.active = false;
    beacon.visible = false;
    clearEnemies(G.combat, G.scene);
    if (state.tailCar) {
      G.scene.remove(state.tailCar.group);
      state.tailCar = null;
    }
    G.player.day += 1;
    if (G.save) G.save();
    const next = state.index + 1;
    if (next >= MISSIONS.length) {
      state.done = true;
      if (G.ui) G.ui.showScreen('complete');
      return;
    }
    if (G.hud) G.hud.showToast(`${MISSIONS[state.index].title} — done. Next job unlocked.`);
    startMission(next);
  }

  function failStep(reason) {
    if (G.hud) G.hud.showToast(`${reason} — job restarted.`);
    startMission(state.index);
  }

  function update(dt) {
    if (!state.active) return;
    const s = stepDef();
    if (!s) return;
    const p = G.player.pos;
    const t = targetPos();
    const dist = t ? Math.hypot(t.x - p.x, t.z - p.z) : 9999;
    diamond.rotation.y += dt * 2;
    ring.scale.setScalar(1 + Math.sin(G.time * 3) * 0.12);
    if (state.tailCar) {
      const car = state.tailCar;
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      if (Math.abs(car.pos.x) > 240 || Math.abs(car.pos.z) > 240) {
        car.heading += Math.PI / 2;
      }
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.wheel.rotation.x += (car.speed * dt) / 0.38;
      placeBeacon();
    }
    switch (s.type) {
      case 'goto':
      case 'talk':
        if (dist < 7) nextStep();
        break;
      case 'deliver': {
        state.timer -= dt;
        state.progress = 1 - Math.max(0, state.timer) / s.time;
        if (dist < 7) nextStep();
        else if (state.timer <= 0) failStep('Too slow — the fare walked away');
        break;
      }
      case 'tail': {
        if (dist > 60) { failStep('Lost the runner'); break; }
        if (dist < 12) {
          state.progress = Math.max(0, state.progress - dt / s.time);
          if (!state.tailSpotted) {
            state.tailSpotted = true;
            if (G.hud) G.hud.showToast('Too close — he spotted you!');
          }
        } else if (dist <= 45) {
          state.tailSpotted = false;
          state.progress += dt / s.time;
        }
        if (state.progress >= 1) nextStep();
        break;
      }
      case 'fight':
        state.progress = state.kills / s.count;
        if (state.kills >= s.count) nextStep();
        break;
      case 'hold': {
        if (dist < 9) {
          state.timer -= dt;
          state.progress = 1 - Math.max(0, state.timer) / s.time;
          if (state.timer <= 0) nextStep();
        } else {
          state.progress = 0;
          state.timer = s.time;
        }
        break;
      }
      case 'escape':
        if (G.player.wanted === 0 && dist < 7) nextStep();
        else if (G.player.wanted === 0) state.progress = 0.5;
        break;
      default:
        break;
    }
  }

  return {
    state,
    startMission,
    update,
    stepDef,
    targetPos,
    placeBeacon,
    current() {
      const m = MISSIONS[state.index];
      if (!m) return null;
      const s = stepDef();
      return {
        title: m.title,
        giver: m.giver,
        text: s ? s.text : 'Job done',
        progress: state.progress,
        timer: state.timer,
        target: targetPos(),
      };
    },
    onKill() {
      state.kills += 1;
    },
  };
}
