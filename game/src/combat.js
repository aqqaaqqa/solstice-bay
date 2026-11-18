// Combat: fists, pistol and SMG as hitscan against the nearest target in
// front of the player, plus the armed Marlow crew the missions spawn. A
// shot is loud: it raises the wanted level and scatters pedestrians.
import * as THREE from 'three';
import { makePerson } from './vehicles.js';
import { WEAPONS } from './config.js';

function combatAngleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createCombat() {
  return { enemies: [], cooldown: 0, gunshotAt: 0 };
}

export function spawnEnemy(combat, THREE_, scene, x, z, rng) {
  const person = makePerson(THREE_, 0x2a2a2e, 0x222831, 0xc98d5a);
  person.group.position.set(x, 0, z);
  person.group.rotation.y = rng() * Math.PI * 2;
  scene.add(person.group);
  const enemy = {
    mesh: person,
    pos: person.group.position,
    health: 100,
    shootTimer: 1 + rng() * 1.5,
    down: false,
  };
  combat.enemies.push(enemy);
  return enemy;
}

function nearestInFront(list, px, pz, heading, maxRange, maxAngle) {
  let best = null;
  let bestD = maxRange;
  for (const e of list) {
    if (e.down) continue;
    const dx = e.pos.x - px;
    const dz = e.pos.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ang = Math.abs(combatAngleDiff(Math.atan2(dx, dz), heading));
    if (ang > maxAngle && d > 3) continue;
    bestD = d;
    best = e;
  }
  return best;
}

export function fireWeapon(combat, dt, G) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  const weapon = WEAPONS[G.player.weapon] || WEAPONS.fists;
  if (!G.firing || combat.cooldown > 0) return;
  if (weapon.ammo !== Infinity) {
    if ((G.player.ammo[G.player.weapon] || 0) <= 0) {
      G.player.weapon = 'fists';
      return;
    }
    G.player.ammo[G.player.weapon] -= 1;
  }
  combat.cooldown = weapon.rate;
  combat.gunshotAt = 1.2;
  const p = G.player;
  const heading = p.heading;
  const mx = p.pos.x + Math.sin(heading) * 1.2;
  const mz = p.pos.z + Math.cos(heading) * 1.2;
  if (G.stage) G.stage.muzzle(mx, 1.5, mz);
  if (G.audio) {
    if (p.weapon === 'fists') G.audio.punch();
    else G.audio.gunshot();
  }
  if (p.weapon === 'fists') {
    const target = nearestInFront(combat.enemies, p.pos.x, p.pos.z, heading, weapon.range, 1.1);
    if (target) {
      target.health -= weapon.damage;
      if (G.stage) G.stage.spawnBurst(target.pos.x, 1.4, target.pos.z, 0xffd98a, 6, 3, 3);
      if (target.health <= 0) killEnemy(combat, target, G);
    }
    return;
  }
  const target = nearestInFront(combat.enemies, p.pos.x, p.pos.z, heading, weapon.range, 0.45);
  if (target) {
    target.health -= weapon.damage;
    if (G.stage) G.stage.spawnBurst(target.pos.x, 1.4, target.pos.z, 0xd8405e, 8, 4, 4);
    if (target.health <= 0) killEnemy(combat, target, G);
  } else {
    // A miss still kicks up dust where the shot lands.
    if (G.stage) {
      G.stage.spawnBurst(
        p.pos.x + Math.sin(heading) * weapon.range * 0.5,
        0.6,
        p.pos.z + Math.cos(heading) * weapon.range * 0.5,
        0xc9b896, 4, 2, 2,
      );
    }
  }
  if (G.onCrime) G.onCrime('shot-fired');
}

function killEnemy(combat, enemy, G) {
  enemy.down = true;
  enemy.mesh.group.visible = false;
  G.player.money += 25;
  if (G.stage) G.stage.spawnBurst(enemy.pos.x, 1.2, enemy.pos.z, 0xffc860, 16, 6, 6);
  if (G.onEnemyDown) G.onEnemyDown(enemy);
}

export function updateEnemies(combat, dt, G) {
  if (combat.gunshotAt > 0) combat.gunshotAt -= dt;
  for (const e of combat.enemies) {
    if (e.down) continue;
    const dx = G.player.pos.x - e.pos.x;
    const dz = G.player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    e.mesh.group.rotation.y = Math.atan2(dx, dz);
    if (dist > 16) {
      e.pos.x += (dx / dist) * 3.4 * dt;
      e.pos.z += (dz / dist) * 3.4 * dt;
      e.mesh.phase = (e.mesh.phase || 0) + dt * 10;
      const s = Math.sin(e.mesh.phase);
      e.mesh.legL.rotation.x = s * 0.6;
      e.mesh.legR.rotation.x = -s * 0.6;
    } else {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.4 + Math.random() * 0.9;
        G.player.health = Math.max(0, G.player.health - (6 + Math.floor(Math.random() * 4)));
        if (G.stage) {
          G.stage.muzzle(e.pos.x, 1.5, e.pos.z);
          G.stage.addShake(0.25);
        }
        if (G.audio) G.audio.gunshot();
      }
    }
  }
}

export function clearEnemies(combat, scene) {
  for (const e of combat.enemies) scene.remove(e.mesh.group);
  combat.enemies = [];
}
