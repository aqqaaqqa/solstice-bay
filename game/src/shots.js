// The screenshot scenes behind ?shot=start|play|chase|end. Each one sets
// up a real game state — a mission in progress, a wanted level, police on
// the road — then drives the simulation forward with an autopilot that
// follows the road grid (Manhattan legs along road lines), so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { MISSIONS } from './config.js';
import { clearEnemies } from './combat.js';

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
  G.shotMode = null;
  G.shotDialogue = null;
  G.shotEnemyPins = null;

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
    return { screen: 'title', steps: 0, saveLine: 'Ch.3 · $31,420 · Day 3 — the garage is still Marlow\'s.' };
  }

  // 'play': Ch.5 Pier Shootout, staged as an on-foot beach shootout.
  // Rae stands on the open sand just east of the pier, facing west down
  // the pier axis: the ferris wheel sits ahead, the sea to the left, and
  // no palm or building stands between her and the Marlow crew. z=70
  // sits between the boulevard palm rows (z=56, 84), so no trunk blocks
  // the frame the way the old driving shot's did. The player does not
  // move (shotInput returns no throttle on foot), so the frame is the
  // staged one; the crew are pinned (see pinShotEnemies) instead of
  // spawning on the pier slab, where they would stand sunk to the waist
  // in the planks.
  if (name === 'play') {
    G.missions.startMission(4);
    G.screen = 'play';
    p.pos.set(-186, 0, 70);
    p.heading = -Math.PI / 2;
    p.onFoot = true;
    G.playerMesh.group.visible = true;
    G.playerMesh.group.position.copy(p.pos);
    G.playerMesh.group.rotation.y = p.heading;
    // 4 stars: 4 police flank in shot mode and the helicopter shows.
    p.wanted = 4;
    G.police.lastCrimeAt = G.time;
    G.hud.showDialogue(['Rae: Six of them? Mara, I drive. I don\'t do sieges.']);
    G.shotDialogue = ['Rae: Six of them? Mara, I drive. I don\'t do sieges.'];
    G.shotMode = 'play';
    // Pin the 6 Marlow crew to fixed offsets ahead of the player so the
    // framing reproduces: every pin is within 15 units, so they hold
    // their ground and shoot instead of walking in (combat.js only
    // advances them past 16 units), and none sits on the pier slab.
    // Offsets are {fwd, right} relative to the player, as in dressShot.
    G.shotEnemyPins = [
      { fwd: 11, right: -3.5 },
      { fwd: 13, right: 2.5 },
      { fwd: 12, right: 4.5 },
      { fwd: 14, right: -1 },
      { fwd: 10.5, right: 0.5 },
      { fwd: 13.5, right: -4 },
    ];
    pinShotEnemies(G);
    // 1s of standing firefight: the crew hold position and shoot, the
    // police flank in shot mode, then runShot fires one staged shot so
    // the shutter falls on a fresh muzzle flash (fireAtEnd). Kept to 1s
    // so the crew's (random-timed) return fire only nicks the player —
    // a longer run leaves health anywhere from 69–94% between takes.
    return { screen: 'play', steps: 60, fireAtEnd: true };
  }

  if (name === 'chase' || name === 'stats' || name === 'garage') {
    // 'stats' is the same Ch.6 chase drive, but the shot ends on the
    // STATS screen over the action instead of on the road. Steal a
    // traffic car first, for real, so the stats are non-zero and
    // plausible (a fresh profile shows 0 cars stolen, 0.0 km).
    if (name === 'stats') {
      const victim = G.traffic.cars[0];
      if (victim) {
        G.enterCar(victim);
        G.exitCar();
      }
    }
    // 'garage' stages the shop state: Engine Tune already owned (so the
    // tuned top speed shows in the stat bars), Armour Plating selected,
    // Nitro Kit locked, no purchase made in the shot itself.
    if (name === 'garage') {
      G.player.tune = 1;
      G.player.plating = false;
      G.player.respray = 0;
      G.player.gear = { bodyarmour: false, ammo: false, flare: false };
      G.garage.tab = 'workshop';
      G.garage.selected = 'armour';
    }
    G.missions.startMission(5);
    // Jump the heist to its escape step: wanted 4, run for the garage.
    G.missions.state.step = 2;
    G.screen = 'play';
    // Far south end of Ocean Boulevard, heading north: a ~400-unit
    // straight with the sea/beach on the left and the ferris wheel ahead
    // on the left. ~5s of full throttle reaches top speed (~166 km/h)
    // well before the shutter, with no turn, wall or roadblock in the way
    // (the roadblock stays 46 units ahead and re-spawns ahead).
    // NOTE: the car runs 2 units WEST of the road centre (x=-182, not
    // -180): the boulevard has four buildings jutting into the road — west
    // faces -179.3 (z -82..-63), -176.8 (z 25..43), -174 (z 193..212) and
    // -179.5 (z 198..221) — and the road centreline is blocked by the
    // first of them (a centreline start wedges the car against the wall at
    // 11 km/h with a yellow burst). At x=-182 the car clears all four
    // (0.4–0.6 units on the two tight ones, deterministic per seed) while
    // staying on the asphalt and clear of the west palm row. The leg below
    // must match the lane, or the autopilot steers back to the centreline.
    G.parkPlayerCar('sports', -182, -230, 0);
    G.enterCar(G.parkedCars[G.parkedCars.length - 1]);
    p.wanted = 4;
    G.police.lastCrimeAt = G.time;
    G.hud.showDialogue(['Mara: Four stars, Rae! Lose them before the garage or don\'t come home.']);
    G.shotDialogue = ['Mara: Four stars, Rae! Lose them before the garage or don\'t come home.'];
    // Straight down the boulevard — ignore the escape target (the
    // garage, east) until after the shutter. The leg follows the west
    // lane (x=-182), matching the parked start above.
    G.shotLegs = [{ x: -182, z: 230 }];
    G.shotLeg = 0;
    G.shotMode = 'chase';
    dressShot(G, {
      cars: [
        { fwd: 28, right: -3.5 },
        { fwd: 45, right: -3.5 },
        { fwd: 36, right: 3.5 },
        { fwd: 60, right: 3.5 },
      ],
      peds: [
        { fwd: 20, right: -11 },
        { fwd: 30, right: -11 },
        { fwd: 24, right: 11 },
        { fwd: 42, right: 11 },
      ],
    });
    // 5s of full throttle: top speed, and the shutter falls at z≈-44
    // with the ferris wheel ahead, not at the empty north edge of the map.
    // For 'stats' the shutter is the STATS screen over this same frame
    // (runShot pauses and opens it after the drive); for 'garage' it is
    // the GARAGE screen instead. (With the staged tune owned, the garage
    // run tops out ~190 km/h and ends ~25 units further north.)
    return { screen: 'play', steps: 300, statsAtEnd: name === 'stats', garageAtEnd: name === 'garage' };
  }

  // 'end': finale drive — Ch.7, "Meet Mara at Calloway Garage". Rae drives
  // SOUTH down Ocean Boulevard, the opposite direction to the chase shot:
  // the sea and beach are on the right of frame, the pier and ferris
  // wheel ahead-right, palms and buildings on the left. 4 stars so the
  // helicopter is in frame and the police flank the player (see police.js
  // shot mode). The marina fight is jumped past (same step-jump pattern
  // as the chase shot) and its crew cleared, since they would chase the
  // car and body-block it at the start.
  G.missions.startMission(6);
  // Jump the finale to its drive-home step: the marina fight is done.
  G.missions.state.step = 1;
  G.screen = 'play';
  // North end of Ocean Boulevard, heading south (-z): a ~400-unit straight
  // with the sea/beach on the right and the pier + ferris wheel
  // ahead-right. Start just south of the building that juts into the
  // boulevard at z≈198–221 (its west face reaches x=-179.5, so a start
  // north of it wedges the car against the wall at 9 km/h) and run a
  // short 2.5s burst: top speed (~165 km/h) is reached in ~1.9s, and the
  // shutter falls at z≈119 with the ferris wheel ~80 units ahead-right,
  // well before the next jutting building at z≈-63. The roadblock stays
  // 46 units ahead and re-spawns ahead.
  G.parkPlayerCar('sports', -180, 190, Math.PI);
  G.enterCar(G.parkedCars[G.parkedCars.length - 1]);
  p.wanted = 4;
  G.police.lastCrimeAt = G.time;
  G.hud.showDialogue(['Mara: The garage is ours again, Rae. Bring her home.']);
  G.shotDialogue = ['Mara: The garage is ours again, Rae. Bring her home.'];
  // Straight down the boulevard — ignore the garage (east) until after
  // the shutter.
  G.shotLegs = [{ x: -180, z: -230 }];
  G.shotLeg = 0;
  G.shotMode = 'end';
  // The marina crew spawns with the fight step; the fight is done, so clear
  // them — they chase the player and body-block the car at the start
  // (holding their fire is not enough: they surround the car and it
  // never gets past 9 km/h).
  clearEnemies(G.combat, G.scene);
  dressShot(G, {
    cars: [
      { fwd: 28, right: -3.5 },
      { fwd: 45, right: -3.5 },
      { fwd: 36, right: 3.5 },
      { fwd: 60, right: 3.5 },
    ],
    peds: [
      { fwd: 20, right: -11 },
      { fwd: 30, right: -11 },
      { fwd: 24, right: 11 },
      { fwd: 42, right: 11 },
    ],
  });
  return { screen: 'play', steps: 150 };
}

export function shotInput(G, name) {
  if (name === 'play' || name === 'chase' || name === 'end' || name === 'stats' || name === 'garage') {
    const cur = G.missions.current();
    return autopilot(G, cur ? cur.target : null);
  }
  return { throttle: 0, steer: 0, handbrake: false };
}

// Tag a few traffic cars / pedestrians with a fixed offset ({fwd, right}
// in units) relative to the player car. pinShotActors re-applies those
// offsets at the end of every step, so the dressed actors are guaranteed
// in frame at the shutter however the sim moves. Shot mode only — normal
// play never sets shotPin, so this is a no-op there.
function dressShot(G, { cars, peds }) {
  cars.forEach((pin, i) => {
    const car = G.traffic.cars[i];
    if (car) car.shotPin = pin;
  });
  peds.forEach((pin, i) => {
    const ped = G.traffic.peds[i];
    if (ped) ped.shotPin = pin;
  });
  pinShotActors(G);
}

// Re-pin the Marlow crew to their shot offsets relative to the player
// after every step, so the staged shootout framing reproduces however
// the sim moves them. Shot mode only — normal play never sets
// shotEnemyPins, so this is a no-op there. Positions only: updateEnemies
// already turned each one to face the player before this runs.
export function pinShotEnemies(G) {
  if (!G.shotMode || !G.shotEnemyPins || !G.combat) return;
  const p = G.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  G.combat.enemies.forEach((e, i) => {
    const pin = G.shotEnemyPins[i % G.shotEnemyPins.length];
    if (!pin || e.down) return;
    e.pos.set(p.pos.x + fx * pin.fwd + rx * pin.right, 0, p.pos.z + fz * pin.fwd + rz * pin.right);
    e.mesh.group.position.copy(e.pos);
  });
}

export function pinShotActors(G) {
  if (!G.shotMode || !G.traffic) return;
  const car = G.playerCar;
  const px = car ? car.pos.x : G.player.pos.x;
  const pz = car ? car.pos.z : G.player.pos.z;
  const h = car ? car.heading : G.player.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const rx = Math.cos(h);
  const rz = -Math.sin(h);
  const at = (fwd, right) => ({ x: px + fx * fwd + rx * right, z: pz + fz * fwd + rz * right });
  for (const c of G.traffic.cars) {
    if (!c.shotPin) continue;
    const p = at(c.shotPin.fwd, c.shotPin.right);
    c.pos.set(p.x, 0, p.z);
    c.heading = h;
    c.group.rotation.y = h;
    c.speed = car ? Math.abs(car.speed) : 0;
  }
  for (const pd of G.traffic.peds) {
    if (!pd.shotPin) continue;
    const p = at(pd.shotPin.fwd, pd.shotPin.right);
    pd.pos.set(p.x, 0, p.z);
    pd.mesh.group.position.set(p.x, 0, p.z);
    // Face the road.
    pd.mesh.group.rotation.y = pd.shotPin.right < 0 ? Math.PI / 2 : -Math.PI / 2;
    pd.heading = pd.mesh.group.rotation.y;
  }
}

export { MISSIONS };
