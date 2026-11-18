// The city's other inhabitants: traffic cars that follow the road grid and
// pedestrians on the sidewalks who walk, scatter from a speeding car and
// get out of the way of a gunshot. All of them are seeded, so the streets
// look the same every time a shot is staged.
import * as THREE from 'three';
import { makeCar, makePerson, animateWalk, carForward, updateCar } from './vehicles.js';
import { nearestRoadPoint, roadLines, resolveCollisions } from './city.js';
import { range, pick, chance } from './random.js';

const CAR_COLORS = [0x7a9bb0, 0xc9c9c9, 0x8a5a4a, 0x5a7a5a, 0xd8b25a, 0x6a6a8a, 0xa0a0a0];
const SHIRTS = [0xe8e2d0, 0x7fa8a0, 0xd8405e, 0x3a7bd5, 0xf2c230, 0x8a5a8a];
const SKINS = [0xe8b88a, 0xc98d5a, 0x8a5a3a, 0xf0c8a0];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createTraffic(THREE_, scene, city, rng) {
  const cars = [];
  const lines = roadLines();
  for (let i = 0; i < 14; i += 1) {
    const kind = pick(rng, ['sedan', 'sedan', 'taxi', 'pickup']);
    const car = makeCar(THREE_, kind, pick(rng, CAR_COLORS));
    car.isTraffic = true;
    const axis = chance(rng, 0.5) ? 'x' : 'z';
    const line = pick(rng, lines);
    const along = range(rng, -230, 230);
    const lane = chance(rng, 0.5) ? 3.5 : -3.5;
    if (axis === 'x') {
      car.pos.set(along, 0, line + lane);
      car.heading = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.set(line + lane, 0, along);
      car.heading = lane > 0 ? Math.PI : 0;
    }
    car.speed = range(rng, 8, 14);
    car.cruise = car.speed;
    car.axis = axis;
    car.line = line;
    car.lane = lane;
    car.group.rotation.y = car.heading;
    scene.add(car.group);
    cars.push(car);
  }
  const peds = [];
  for (let i = 0; i < 18; i += 1) {
    const person = makePerson(THREE_, pick(rng, SHIRTS), 0x3a3f4a, pick(rng, SKINS));
    const rp = nearestRoadPoint(range(rng, -220, 220), range(rng, -220, 220));
    person.group.position.set(rp.x + range(rng, -9, 9), 0, rp.z + range(rng, -9, 9));
    person.group.rotation.y = range(rng, 0, Math.PI * 2);
    scene.add(person.group);
    peds.push({
      mesh: person,
      pos: person.group.position,
      heading: person.group.rotation.y,
      speed: range(rng, 1.1, 2.0),
      flee: 0,
      down: 0,
      walkPhase: range(rng, 0, 6),
    });
  }
  return { cars, peds };
}

function trafficInput(car, playerPos, dt) {
  // Slow down for the car ahead — including the player's.
  let throttle = 1;
  const f = carForward(car);
  const aheadX = car.pos.x + f.x * 10;
  const aheadZ = car.pos.z + f.z * 10;
  const dx = playerPos.x - aheadX;
  const dz = playerPos.z - aheadZ;
  if (dx * dx + dz * dz < 36) throttle = 0;
  return { throttle, steer: 0, handbrake: false };
}

export function updateTraffic(traffic, dt, G) {
  const { city } = G;
  for (const car of traffic.cars) {
    const input = trafficInput(car, G.playerCar ? G.playerCar.pos : G.player.pos, dt);
    // Keep traffic on its lane: steer gently back to the line.
    const f = carForward(car);
    let steer = 0;
    if (car.axis === 'x') {
      const want = car.line + car.lane;
      steer = Math.max(-1, Math.min(1, (want - car.pos.z) * 0.06)) * (f.x >= 0 ? 1 : -1);
      // At a cross street, sometimes turn.
      for (const v of roadLines()) {
        if (Math.abs(car.pos.x - v) < 0.6 && Math.random() < 0.3) {
          car.axis = 'z';
          car.line = v;
          car.lane = Math.random() < 0.5 ? 3.5 : -3.5;
          car.heading = car.lane > 0 ? Math.PI : 0;
        }
      }
    } else {
      const want = car.line + car.lane;
      steer = Math.max(-1, Math.min(1, (want - car.pos.x) * 0.06)) * (f.z >= 0 ? -1 : 1);
      for (const v of roadLines()) {
        if (Math.abs(car.pos.z - v) < 0.6 && Math.random() < 0.3) {
          car.axis = 'x';
          car.line = v;
          car.lane = Math.random() < 0.5 ? 3.5 : -3.5;
          car.heading = car.lane > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }
    car.speed = car.cruise * (input.throttle === 0 ? 0.2 : 1);
    car.heading += steer * 1.4 * dt;
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    if (car.pos.x > 250) car.pos.x = -250;
    if (car.pos.x < -250) car.pos.x = 250;
    if (car.pos.z > 250) car.pos.z = -250;
    if (car.pos.z < -250) car.pos.z = 250;
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.wheel.rotation.x += (car.speed * dt) / 0.38;
    // A traffic car that the player rams slows and honks by flashing.
    const pdx = car.pos.x - G.player.pos.x;
    const pdz = car.pos.z - G.player.pos.z;
    if (G.playerCar && pdx * pdx + pdz * pdz < 12) {
      car.speed = Math.max(0, car.speed - 20 * dt);
    }
  }

  for (const ped of traffic.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.mesh.group.visible = true;
        ped.mesh.group.position.set(
          G.player.pos.x + range(Math.random, -80, 80),
          0,
          G.player.pos.z + range(Math.random, -80, 80),
        );
        resolveCollisions(city, ped.mesh.group.position, 1);
      }
      continue;
    }
    const dx = ped.pos.x - G.player.pos.x;
    const dz = ped.pos.z - G.player.pos.z;
    const dist2 = dx * dx + dz * dz;
    const danger = (G.playerCar && Math.abs(G.playerCar.speed) > 14 && dist2 < 120) || G.gunshotAt > 0;
    let speed = ped.speed;
    if (danger || ped.flee > 0) {
      ped.flee = Math.max(ped.flee, 2.5);
      speed = 4.2;
      ped.heading = Math.atan2(dx, dz);
    } else if (Math.random() < dt * 0.05) {
      ped.heading += (Math.random() - 0.5) * 1.6;
    }
    if (ped.flee > 0) ped.flee -= dt;
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    resolveCollisions(city, ped.pos, 0.7);
    ped.mesh.group.rotation.y = ped.heading;
    animateWalk(ped.mesh, speed > 0.2, dt);
    // Hit by the player's car: knocked down, and the law notices.
    if (G.playerCar && Math.abs(G.playerCar.speed) > 3 && dist2 < 4.2) {
      ped.down = 6;
      ped.mesh.group.visible = false;
      if (G.onCrime) G.onCrime('hit-ped');
      if (G.stage) G.stage.spawnBurst(ped.pos.x, 1.2, ped.pos.z, 0xd8405e, 10, 4, 4);
    }
  }
}

// The nearest parked or traffic car to a point, for stealing (E).
export function nearestCar(traffic, x, z, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of traffic.cars) {
    const dx = car.pos.x - x;
    const dz = car.pos.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export { angleDiff };
