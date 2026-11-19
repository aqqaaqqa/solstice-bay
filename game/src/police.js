// The SBPD: a wanted level from 0 to 5 stars, pursuit cars that chase and
// ram, roadblocks from 3 stars, a helicopter with a spotlight from 4, and
// being busted on foot or wasted at zero health. Heat decays when the
// police lose sight of the player and no new crime happens.
import * as THREE from 'three';
import { makeCar, updateCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { range } from './random.js';

function policeAngleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPolice(THREE_, scene) {
  const heliGroup = new THREE_.Group();
  const bodyMat = new THREE_.MeshLambertMaterial({ color: 0x22303c });
  const body = new THREE_.Mesh(new THREE_.BoxGeometry(3.2, 1.4, 6), bodyMat);
  heliGroup.add(body);
  const tail = new THREE_.Mesh(new THREE_.BoxGeometry(0.8, 0.8, 5), bodyMat);
  tail.position.set(0, 0.3, -5);
  heliGroup.add(tail);
  const rotor = new THREE_.Mesh(new THREE_.BoxGeometry(11, 0.12, 0.6), new THREE_.MeshLambertMaterial({ color: 0x181818 }));
  rotor.position.y = 1.1;
  heliGroup.add(rotor);
  const cone = new THREE_.Mesh(
    new THREE_.ConeGeometry(5, 42, 16, 1, true),
    new THREE_.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.11, side: THREE_.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -21;
  heliGroup.add(cone);
  heliGroup.visible = false;
  scene.add(heliGroup);
  return {
    cars: [],
    roadblocks: [],
    heli: heliGroup,
    heliRotor: rotor,
    bustTimer: 0,
    ramCooldown: 0,
    decayTimer: 0,
    lastCrimeAt: 0,
    roadblockFor: 0,
    time: 0,
  };
}

function spawnPoliceCar(police, G) {
  const THREE_ = G.THREE;
  const car = makeCar(THREE_, 'police');
  const rp = nearestRoadPoint(
    G.player.pos.x + range(Math.random, -90, 90),
    G.player.pos.z + range(Math.random, -90, 90),
  );
  car.pos.set(rp.x, 0, rp.z);
  car.heading = Math.atan2(G.player.pos.x - rp.x, G.player.pos.z - rp.z);
  car.group.rotation.y = car.heading;
  car.isPolice = true;
  G.scene.add(car.group);
  police.cars.push(car);
  return car;
}

function spawnRoadblock(police, G) {
  const THREE_ = G.THREE;
  const fwd = G.playerCar
    ? { x: Math.sin(G.playerCar.heading), z: Math.cos(G.playerCar.heading) }
    : { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
  for (const side of [-4, 4]) {
    const car = makeCar(THREE_, 'police');
    const px = G.player.pos.x + fwd.x * 46 - fwd.z * side;
    const pz = G.player.pos.z + fwd.z * 46 + fwd.x * side;
    car.pos.set(px, 0, pz);
    car.heading = Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
    car.group.rotation.y = car.heading;
    car.isPolice = true;
    car.speed = 0;
    G.scene.add(car.group);
    police.roadblocks.push(car);
  }
}

export function policeCountFor(wanted) {
  return Math.min(4, wanted);
}

export function updatePolice(police, dt, G) {
  police.time += dt;
  const wanted = G.player.wanted;
  const playerPos = G.player.pos;

  // Keep the right number of pursuit cars on the road.
  while (police.cars.length < policeCountFor(wanted)) spawnPoliceCar(police, G);
  while (police.cars.length > policeCountFor(wanted)) {
    const car = police.cars.pop();
    G.scene.remove(car.group);
  }
  // Roadblocks appear once per wanted level from 3 stars.
  if (wanted >= 3 && police.roadblockFor !== wanted) {
    police.roadblockFor = wanted;
    spawnRoadblock(police, G);
  }
  if (wanted < 3) {
    for (const car of police.roadblocks) G.scene.remove(car.group);
    police.roadblocks = [];
    police.roadblockFor = 0;
  } else {
    // A roadblock the player has left far behind moves up ahead again:
    // a chase should always have a blockade to drive at.
    const fwd = G.playerCar
      ? { x: Math.sin(G.playerCar.heading), z: Math.cos(G.playerCar.heading) }
      : { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
    for (const car of police.roadblocks) {
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      const ahead = (car.pos.x - playerPos.x) * fwd.x + (car.pos.z - playerPos.z) * fwd.z;
      if (d > 90 || ahead < -20) {
        const side = car.pos.x > playerPos.x ? 4 : -4;
        car.pos.set(playerPos.x + fwd.x * 46 - fwd.z * side, 0, playerPos.z + fwd.z * 46 + fwd.x * side);
        car.heading = Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
        car.group.rotation.y = car.heading;
      }
    }
  }
  if (police.ramCooldown > 0) police.ramCooldown -= dt;

  // Shot mode (see shots.js): pin the pursuit to the frame instead of
  // letting it chase freely. The chase camera looks forward past the
  // player car, so police behind the player are behind the camera and
  // invisible — flank them alongside the player instead, matching the
  // player's speed so nobody rams (a ram would halve the player's speed
  // and spray a burst over the player car). The helicopter moves from
  // behind the player to ahead-and-to-the-side, up in the sky where the
  // forward camera can see it. Normal play never sets G.shotMode, so
  // none of this runs outside a staged shot.
  if (G.shotMode === 'chase' || G.shotMode === 'play' || G.shotMode === 'end') {
    const fwd = G.playerCar
      ? { x: Math.sin(G.playerCar.heading), z: Math.cos(G.playerCar.heading) }
      : { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
    const right = { x: fwd.z, z: -fwd.x };
    const speed = G.playerCar ? Math.abs(G.playerCar.speed) : 0;
    const flank = [
      { f: 8, r: -5.5 },
      { f: 4, r: 5.5 },
      { f: 0, r: -5.5 },
      { f: -2, r: 5.5 },
    ];
    const shotBehaviours = [];
    police.cars.forEach((car, i) => {
      const off = flank[i % flank.length];
      car.pos.set(
        playerPos.x + fwd.x * off.f + right.x * off.r,
        0,
        playerPos.z + fwd.z * off.f + right.z * off.r,
      );
      car.heading = G.playerCar ? G.playerCar.heading : G.player.heading;
      car.group.rotation.y = car.heading;
      car.speed = speed;
      const flash = Math.floor(police.time * 6) % 2 === 0;
      if (car.lightRed) car.lightRed.visible = flash;
      if (car.lightBlue) car.lightBlue.visible = !flash;
      const dist = Math.round(Math.hypot(off.f, off.r));
      shotBehaviours.push({ kind: dist < 25 ? 'RAMMING' : 'PURSUING', dist });
    });
    const heliOn = wanted >= 4;
    police.heli.visible = heliOn;
    if (heliOn) {
      // West side (the beach/sea) in both directions: the east side is
      // buildings, and on a southbound run the helicopter would sit over
      // them and be hidden behind one. For a northbound run this is the
      // same position as before (right.x * -14 is -14 when facing north),
      // so the chase and play shots are unchanged.
      police.heli.position.set(
        playerPos.x + fwd.x * 42 - 14,
        19,
        playerPos.z + fwd.z * 42,
      );
      police.heli.rotation.y = Math.atan2(playerPos.x - police.heli.position.x, playerPos.z - police.heli.position.z);
      police.heliRotor.rotation.y += dt * 22;
      shotBehaviours.push({ kind: 'SPOTLIGHT ON YOU', dist: 0 });
    }
    if (wanted >= 3) shotBehaviours.push({ kind: 'ROADBLOCK AHEAD', dist: 46 });
    if (G.audio) G.audio.siren(wanted > 0);
    return shotBehaviours;
  }

  const behaviours = [];
  for (const car of police.cars) {
    const dx = playerPos.x - car.pos.x;
    const dz = playerPos.z - car.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    const steer = Math.max(-1, Math.min(1, policeAngleDiff(wantHeading, car.heading) * 1.6));
    const throttle = dist > 6 ? 1 : 0.4;
    updateCar(car, { throttle, steer, handbrake: false }, dt, G.city);
    // Light bar flash.
    const flash = Math.floor(police.time * 6) % 2 === 0;
    if (car.lightRed) car.lightRed.visible = flash;
    if (car.lightBlue) car.lightBlue.visible = !flash;
    // Ramming: contact costs the player car condition or health.
    if (dist < 4.2 && police.ramCooldown <= 0) {
      police.ramCooldown = 1.1;
      if (G.playerCar) {
        G.playerCar.damage = Math.min(100, G.playerCar.damage + 9);
        G.playerCar.speed *= 0.6;
      } else {
        G.player.health = Math.max(0, G.player.health - 12);
      }
      if (G.stage) {
        G.stage.spawnBurst(playerPos.x, 1.4, playerPos.z, 0xffc860, 8, 3, 3);
        G.stage.addShake(0.5);
      }
      if (G.audio) G.audio.punch();
    }
    behaviours.push({
      kind: dist < 25 ? 'RAMMING' : 'PURSUING',
      dist: Math.round(dist),
    });
  }

  // Helicopter: follows from 4 stars, spotlight on the player.
  const heliOn = wanted >= 4;
  police.heli.visible = heliOn;
  if (heliOn) {
    police.heli.position.set(playerPos.x + 12, 42, playerPos.z - 10);
    police.heli.rotation.y = Math.atan2(playerPos.x - police.heli.position.x, playerPos.z - police.heli.position.z);
    police.heliRotor.rotation.y += dt * 22;
    behaviours.push({ kind: 'SPOTLIGHT ON YOU', dist: 0 });
  }
  if (wanted >= 3) behaviours.push({ kind: 'ROADBLOCK AHEAD', dist: 46 });

  // Busted: on foot, a police car sits on the player while they crawl.
  const nearest = police.cars.reduce((m, c) => Math.min(m, Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z)), Infinity);
  if (!G.playerCar && wanted > 0 && nearest < 4.5 && Math.abs(G.player.speed || 0) < 1.2) {
    police.bustTimer += dt;
    if (police.bustTimer > 2.5 && G.onBusted) G.onBusted();
  } else {
    police.bustTimer = 0;
  }

  // Heat decay: no crime for a while and no police close by.
  if (wanted > 0) {
    if (nearest > 45 && police.time - police.lastCrimeAt > 25) {
      police.decayTimer += dt;
      if (police.decayTimer > 6) {
        police.decayTimer = 0;
        G.player.wanted = Math.max(0, wanted - 1);
      }
    } else {
      police.decayTimer = 0;
    }
  }

  if (G.audio) G.audio.siren(wanted > 0);
  return behaviours;
}

export function noteCrime(police, when) {
  police.lastCrimeAt = when;
}
