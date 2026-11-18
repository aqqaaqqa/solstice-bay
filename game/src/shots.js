// The screenshot scenes behind ?shot=start|play|chase|end. Each one sets
// up a real game state — a mission in progress, a wanted level, police on
// the road — then drives the simulation forward with an autopilot that
// follows the road grid (Manhattan legs along road lines), so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { MISSIONS } from './config.js';

function snapRoad(v) {
  const s = Math.round(v / 60) * 60;
  return Math.max(-180, Math.min(180, s));
}

// Legs from the car's position to a point on the road grid near the target:
// along the nearest vertical road, then along the nearest horizontal road.
function routeLegs(from, to) {
  const rx = snapRoad(from.x);
  const rz = snapRoad(to.z);
  const fx = snapRoad(to.x);
  const legs = [];
  if (Math.abs(from.x - rx) > 2) legs.push({ x: rx, z: from.z });
  legs.push({ x: rx, z: rz });
  if (Math.abs(fx - rx) > 2) legs.push({ x: fx, z: rz });
  return legs;
}

function autopilot(G, target) {
  const car = G.playerCar;
  if (!car || !target) return { throttle: 0, steer: 0, handbrake: false };
  if (!G.shotLegs) G.shotLegs = routeLegs(car.pos, target);
  let leg = G.shotLegs[G.shotLeg || 0];
  if (!leg) return { throttle: 0.4, steer: 0, handbrake: false };
  const dx = leg.x - car.pos.x;
  const dz = leg.z - car.pos.z;
  if (Math.hypot(dx, dz) < 10) {
    G.shotLeg = (G.shotLeg || 0) + 1;
    leg = G.shotLegs[G.shotLeg];
    if (!leg) return { throttle: 0.4, steer: 0, handbrake: false };
  }
  const want = Math.atan2(leg.x - car.pos.x, leg.z - car.pos.z);
  let steer = want - car.heading;
  while (steer > Math.PI) steer -= Math.PI * 2;
  while (steer < -Math.PI) steer += Math.PI * 2;
  // Slow for a hard turn so the car does not clip a building corner.
  const throttle = Math.abs(steer) > 0.7 ? 0.45 : 1;
  return { throttle, steer: Math.max(-1, Math.min(1, steer * 1.8)), handbrake: false };
}

export function stageShot(name, G) {
  const p = G.player;
  // A mid-story save state for the shots: chapter 3, decent money, day 3.
  p.money = 31420;
  p.rep = 35;
  p.day = 3;
  p.health = 100;
  p.armour = 60;
  p.wanted = 0;
  p.ammo = { pistol: 96, smg: 180 };
  p.weapon = 'pistol';
  G.shotLegs = null;
  G.shotLeg = 0;

  if (name === 'start') {
    G.missions.state.index = 0;
    G.missions.state.step = 0;
    G.missions.state.active = false;
    G.screen = 'title';
    // Rae's sports car parked on Ocean Boulevard at sunset, city behind it.
    G.parkPlayerCar('sports', -180, 60, 0);
    p.pos.set(-176, 0, 60);
    p.heading = 0;
    p.onFoot = true;
    G.playerMesh.group.visible = true;
    G.ui.showScreen('title');
    G.ui.setSaveLine('Ch.3 · $31,420 · Day 3 — the garage is still Marlow\'s.');
    return { screen: 'title', steps: 0 };
  }

  if (name === 'play') {
    G.missions.startMission(1);
    G.screen = 'play';
    // On the boulevard road itself, heading north up Ocean Boulevard.
    G.parkPlayerCar('sports', -180, -40, 0);
    G.enterCar(G.parkedCars[G.parkedCars.length - 1]);
    p.wanted = 0;
    G.hud.showDialogue([]);
    return { screen: 'play', steps: 360 };
  }

  if (name === 'chase') {
    G.missions.startMission(5);
    // Jump the heist to its escape step: wanted 4, run for the garage.
    G.missions.state.step = 2;
    G.screen = 'play';
    G.parkPlayerCar('sports', -120, -120, Math.PI / 2);
    G.enterCar(G.parkedCars[G.parkedCars.length - 1]);
    p.wanted = 4;
    G.police.lastCrimeAt = G.time;
    G.hud.showDialogue(['Mara: Four stars, Rae! Lose them before the garage or don\'t come home.']);
    return { screen: 'play', steps: 300 };
  }

  // 'end': dusk shootout on the pier, chapter 5. Rae stands east of the
  // pier facing west into the sunset, the crew walking in from the pier.
  G.missions.startMission(4);
  G.screen = 'play';
  if (G.playerCar) G.exitCar();
  p.pos.set(-195, 0, 40);
  p.heading = -Math.PI / 2;
  p.onFoot = true;
  p.health = 100;
  p.wanted = 2;
  p.weapon = 'pistol';
  G.playerMesh.group.visible = true;
  G.playerMesh.group.position.copy(p.pos);
  // Hold the crew at a distance so they are walking in, not already
  // gunning the player down when the shutter falls.
  for (const e of G.combat.enemies) {
    const dx = e.pos.x - p.pos.x;
    const dz = e.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const push = 26 / d;
    e.pos.x = p.pos.x + dx * push;
    e.pos.z = p.pos.z + dz * push;
  }
  G.hud.showDialogue(['Rae: Six of them on my pier? Tonight the pier fights back.']);
  return { screen: 'play', steps: 180 };
}

export function shotInput(G, name) {
  if (name === 'play' || name === 'chase') {
    const cur = G.missions.current();
    return autopilot(G, cur ? cur.target : null);
  }
  return { throttle: 0, steer: 0, handbrake: false };
}

export { MISSIONS };
