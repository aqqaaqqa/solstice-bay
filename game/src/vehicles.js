// Cars and people as low-poly box builds, plus the arcade driving model.
// A car's forward is +Z of its group; heading rotates it, so forward is
// (sin heading, 0, cos heading). No physics engine: grip, drift and damage
// are a few lines of tuned arithmetic.
import * as THREE from 'three';
import { CAR_TUNE } from './config.js';
import { resolveCollisions } from './city.js';

const glassMat = new THREE.MeshLambertMaterial({ color: 0x22303c });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makeCar(THREE_, kind, colorHex) {
  const tune = CAR_TUNE[kind] || CAR_TUNE.sedan;
  const color = colorHex !== undefined ? colorHex : tune.color;
  const group = new THREE_.Group();
  const bodyMat = new THREE_.MeshLambertMaterial({ color });
  const low = kind === 'sports';
  const bodyH = low ? 0.5 : 0.62;
  const bodyY = low ? 0.5 : 0.58;
  group.add(box(2.0, bodyH, 4.4, bodyMat, 0, bodyY, 0));
  group.add(box(1.7, 0.55, 2.1, glassMat, 0, bodyY + bodyH / 2 + 0.26, -0.25));
  group.add(box(2.02, 0.18, 0.9, bodyMat, 0, bodyY + 0.1, 1.75));
  // Headlights and taillights.
  const lampMat = new THREE_.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 });
  group.add(box(0.42, 0.16, 0.1, lampMat, -0.65, bodyY + 0.08, 2.22));
  group.add(box(0.42, 0.16, 0.1, lampMat, 0.65, bodyY + 0.08, 2.22));
  const tailMat = new THREE_.MeshLambertMaterial({ color: 0xc03030, emissive: 0x550000 });
  group.add(box(0.5, 0.14, 0.1, tailMat, -0.65, bodyY + 0.08, -2.22));
  group.add(box(0.5, 0.14, 0.1, tailMat, 0.65, bodyY + 0.08, -2.22));
  if (kind === 'taxi') {
    group.add(box(0.9, 0.28, 0.4, new THREE_.MeshLambertMaterial({ color: 0x222222 }), 0, bodyY + bodyH / 2 + 0.68, -0.25));
  }
  if (kind === 'sports') {
    group.add(box(1.9, 0.08, 0.5, chromeMat, 0, bodyY + 0.62, -2.05));
  }
  if (kind === 'pickup') {
    group.add(box(1.8, 0.5, 1.4, bodyMat, 0, bodyY + 0.35, -1.2));
  }
  let lightRed = null;
  let lightBlue = null;
  if (kind === 'police') {
    group.add(box(1.1, 0.22, 0.5, new THREE_.MeshLambertMaterial({ color: 0x222222 }), 0, bodyY + bodyH / 2 + 0.62, -0.25));
    lightRed = box(0.45, 0.2, 0.45, new THREE_.MeshLambertMaterial({ color: 0xff2020, emissive: 0xaa0000 }), -0.28, bodyY + bodyH / 2 + 0.75, -0.25);
    lightBlue = box(0.45, 0.2, 0.45, new THREE_.MeshLambertMaterial({ color: 0x2060ff, emissive: 0x0022aa }), 0.28, bodyY + bodyH / 2 + 0.75, -0.25);
    group.add(lightRed);
    group.add(lightBlue);
    group.add(box(2.02, 0.3, 1.6, new THREE_.MeshLambertMaterial({ color: 0x222831 }), 0, bodyY + 0.05, 0.6));
  }
  const wheels = [];
  const wheelGeo = new THREE_.CylinderGeometry(0.38, 0.38, 0.32, 10);
  for (const [wx, wz, front] of [[-0.95, 1.45, true], [0.95, 1.45, true], [-0.95, -1.45, false], [0.95, -1.45, false]]) {
    const pivot = new THREE_.Group();
    pivot.position.set(wx, 0.38, wz);
    const wheel = new THREE_.Mesh(wheelGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ pivot, wheel, front });
  }
  return {
    kind, group, wheels, lightRed, lightBlue, bodyMat,
    tune,
    pos: group.position,
    heading: 0,
    speed: 0,
    steer: 0,
    damage: 0,
    dmgCooldown: 0,
    isPlayer: false,
    isPolice: kind === 'police',
    isTraffic: false,
    driver: null,
  };
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

// Arcade driving: throttle toward top speed, steering that bites harder
// the slower you go, handbrake drift, building collisions that cost speed.
export function updateCar(car, input, dt, city) {
  const t = car.tune;
  // The garage tune (+15%) lifts top speed and acceleration on any car.
  const boost = car.tuneBoost || 1;
  const target = input.throttle * t.top * boost;
  const rate = input.throttle > 0 ? t.accel * boost : t.brake;
  if (car.speed < target) car.speed = Math.min(target, car.speed + rate * dt);
  else if (car.speed > target) car.speed = Math.max(target, car.speed - t.brake * dt);
  if (input.handbrake) car.speed *= Math.max(0, 1 - 1.6 * dt);
  const steerTarget = input.steer * (input.handbrake ? 1.5 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = t.grip * (input.handbrake ? 1.7 : 1);
  car.heading += car.steer * grip * (car.speed / t.top) * dt * (car.speed >= 0 ? 1 : -1);
  const f = carForward(car);
  car.pos.x += f.x * car.speed * dt;
  car.pos.z += f.z * car.speed * dt;
  const hit = resolveCollisions(city, car.pos, 2.1);
  if (hit && Math.abs(car.speed) > 4) {
    // One wall scrape costs a little condition, then a short grace period:
    // sliding along a wall must not shred the car in a single second.
    if ((car.dmgCooldown || 0) <= 0) {
      // Garage armour plating halves wall-hit damage.
      const dmg = Math.min(12, Math.abs(car.speed) * 0.4);
      car.damage = Math.min(100, car.damage + (car.plating ? dmg / 2 : dmg));
      car.dmgCooldown = 0.6;
    }
    car.speed *= 0.45;
  }
  if (car.dmgCooldown > 0) car.dmgCooldown -= dt;
  car.group.rotation.y = car.heading;
  for (const w of car.wheels) {
    w.wheel.rotation.x += (car.speed * dt) / 0.38;
    if (w.front) w.pivot.rotation.y = car.steer * 0.42;
  }
  return hit;
}

export function makePerson(THREE_, shirt, pants, skin) {
  const group = new THREE_.Group();
  const torso = box(0.62, 0.72, 0.36, new THREE_.MeshLambertMaterial({ color: shirt }), 0, 1.12, 0);
  const head = box(0.42, 0.42, 0.42, new THREE_.MeshLambertMaterial({ color: skin }), 0, 1.72, 0);
  const legL = box(0.24, 0.72, 0.26, new THREE_.MeshLambertMaterial({ color: pants }), -0.17, 0.38, 0);
  const legR = box(0.24, 0.72, 0.26, new THREE_.MeshLambertMaterial({ color: pants }), 0.17, 0.38, 0);
  const armL = box(0.18, 0.62, 0.2, new THREE_.MeshLambertMaterial({ color: shirt }), -0.42, 1.12, 0);
  const armR = box(0.18, 0.62, 0.2, new THREE_.MeshLambertMaterial({ color: shirt }), 0.42, 1.12, 0);
  legL.geometry.translate(0, -0.36, 0);
  legR.geometry.translate(0, -0.36, 0);
  legL.position.y = 0.74;
  legR.position.y = 0.74;
  armL.geometry.translate(0, -0.31, 0);
  armR.geometry.translate(0, -0.31, 0);
  armL.position.y = 1.42;
  armR.position.y = 1.42;
  group.add(torso, head, legL, legR, armL, armR);
  return { group, legL, legR, armL, armR, phase: 0 };
}

export function animateWalk(person, moving, dt) {
  if (!moving) {
    person.legL.rotation.x *= 0.8;
    person.legR.rotation.x *= 0.8;
    person.armL.rotation.x *= 0.8;
    person.armR.rotation.x *= 0.8;
    return;
  }
  person.phase += dt * 11;
  const s = Math.sin(person.phase);
  person.legL.rotation.x = s * 0.7;
  person.legR.rotation.x = -s * 0.7;
  person.armL.rotation.x = -s * 0.5;
  person.armR.rotation.x = s * 0.5;
}
