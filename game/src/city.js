// Solstice Bay itself: a procedural sunset coastal city built from boxes,
// canvas textures and a seeded generator. Everything is placed from the
// seed, so the same seed rebuilds the same streets, buildings and palms.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';
import { range, pick } from './random.js';

const ROAD_LINES = [];
for (let v = -180; v <= 180; v += 60) ROAD_LINES.push(v);

function groundTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + WORLD.half) / (WORLD.half * 2)) * 1024;
  // Base land: warm sand-toned blocks.
  g.fillStyle = '#c9a97e';
  g.fillRect(0, 0, 1024, 1024);
  // Beach strip on the west, then water handled by its own plane.
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, 0, toPx(WORLD.beachX) - toPx(-WORLD.half), 1024);
  // Blocks: soft varied paving between roads.
  for (let ix = 0; ix < 7; ix += 1) {
    for (let iz = 0; iz < 7; iz += 1) {
      const shade = 150 + Math.floor(rng() * 40);
      g.fillStyle = `rgb(${shade + 20},${shade},${shade - 30})`;
      const x0 = toPx(-180 + ix * 60 + 8);
      const z0 = toPx(-180 + iz * 60 + 8);
      g.fillRect(x0, z0, toPx(52) - toPx(0), toPx(52) - toPx(0));
    }
  }
  // Roads: dark asphalt with a pale centre dash.
  g.fillStyle = PALETTE.road;
  for (const v of ROAD_LINES) {
    g.fillRect(toPx(v - WORLD.roadWidth / 2), 0, toPx(WORLD.roadWidth) - toPx(0), 1024);
    g.fillRect(0, toPx(v - WORLD.roadWidth / 2), 1024, toPx(WORLD.roadWidth) - toPx(0));
  }
  g.fillStyle = PALETTE.roadLine;
  for (const v of ROAD_LINES) {
    for (let d = -250; d < 260; d += 24) {
      g.fillRect(toPx(v) - 2, toPx(d), 4, 12);
      g.fillRect(toPx(d), toPx(v) - 2, 12, 4);
    }
  }
  // Crosswalks at the boulevard crossings.
  g.fillStyle = '#e8e2d0';
  for (const v of ROAD_LINES) {
    for (let k = -2; k <= 2; k += 1) {
      g.fillRect(toPx(-180 + k * 4) - 2, toPx(v - 9), 4, 18);
      g.fillRect(toPx(v - 9), toPx(120 + k * 4) - 2, 18, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = rng() < 0.55;
      g.fillStyle = lit ? '#ffd98a' : '#2c3542';
      g.fillRect(10 + col * 30, 12 + row * 24, 20, 14);
    }
  }
  // Ground-floor shopfront strip.
  g.fillStyle = '#3a2c22';
  g.fillRect(0, 232, 128, 24);
  g.fillStyle = '#ffd98a';
  g.fillRect(8, 236, 112, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(THREE_, rng) {
  const group = new THREE_.Group();
  const trunkH = range(rng, 5, 8);
  const trunk = new THREE_.Mesh(
    new THREE_.CylinderGeometry(0.18, 0.32, trunkH, 6),
    new THREE_.MeshLambertMaterial({ color: PALETTE.palmTrunk }),
  );
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE_.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE_.Mesh(new THREE_.ConeGeometry(0.55, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, trunkH + 0.4, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.9;
    leaf.rotation.x = -Math.sin(a) * 1.9;
    leaf.scale.set(1, 1, 0.25);
    group.add(leaf);
  }
  const nuts = new THREE_.Mesh(
    new THREE_.SphereGeometry(0.35, 6, 5),
    new THREE_.MeshLambertMaterial({ color: 0x8a6a3a }),
  );
  nuts.position.y = trunkH + 0.2;
  group.add(nuts);
  return group;
}

// Places the player must be able to stand on — the garage, the fare
// pickup, the drop-off and the safehouse. The generator keeps the ground
// around each of them clear of buildings.
const OPEN_GROUND = [
  { x: 30, z: -90 },
  { x: -160, z: 140 },
  { x: 150, z: 150 },
  { x: 140, z: -140 },
];

export function buildCity(THREE_, rng) {
  const group = new THREE_.Group();
  const colliders = [];
  const textures = PALETTE.building.map((b) => windowTexture(rng, b));

  // Ground plane with the painted street map.
  const ground = new THREE_.Mesh(
    new THREE_.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE_.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  group.add(ground);

  // Water: a flat blue plane west of the beach, slightly below the sand.
  const water = new THREE_.Mesh(
    new THREE_.PlaneGeometry(90, WORLD.half * 2),
    new THREE_.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WORLD.waterX - 40, -0.4, 0);
  group.add(water);

  // Buildings, one to three per block, taller toward Downtown.
  const boxGeo = new THREE_.BoxGeometry(1, 1, 1);
  for (let ix = 0; ix < 7; ix += 1) {
    for (let iz = 0; iz < 7; iz += 1) {
      const bx = -180 + ix * 60 + 30;
      const bz = -180 + iz * 60 + 30;
      if (bx < -150) continue; // beach blocks stay open
      const downtown = Math.abs(bx - 20) < 80 && Math.abs(bz + 30) < 90;
      const count = downtown ? 2 : 1 + Math.floor(rng() * 2);
      for (let k = 0; k < count; k += 1) {
        const w = range(rng, 16, 26);
        const d = range(rng, 16, 26);
        const h = downtown ? range(rng, 26, 72) : range(rng, 10, 30);
        const ox = bx + range(rng, -12, 12) - (k * 8);
        const oz = bz + range(rng, -12, 12) + (k * 6);
        // Skip a building whose footprint plus a margin would crowd one of
        // the spots the player must stand on.
        let crowdsSpot = false;
        for (const spot of OPEN_GROUND) {
          if (Math.abs(ox - spot.x) < w / 2 + 8 && Math.abs(oz - spot.z) < d / 2 + 8) {
            crowdsSpot = true;
            break;
          }
        }
        if (crowdsSpot) continue;
        // Tile the window pattern to fit the building instead of stretching
        // a single tile over it, so windows stay the same size on a low
        // shopfront and on a tall downtown tower.
        const picked = pick(rng, textures);
        const facade = picked.clone();
        facade.needsUpdate = true;
        facade.wrapS = THREE_.RepeatWrapping;
        facade.wrapT = THREE_.RepeatWrapping;
        facade.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        const mat = new THREE_.MeshLambertMaterial({ map: facade });
        const b = new THREE_.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(ox, h / 2, oz);
        group.add(b);
        // Flat roof cap so the top is not stretched windows.
        const roof = new THREE_.Mesh(
          new THREE_.BoxGeometry(w + 0.4, 0.6, d + 0.4),
          new THREE_.MeshLambertMaterial({ color: 0x5a4a3a }),
        );
        roof.position.set(ox, h + 0.3, oz);
        group.add(roof);
        colliders.push({ x: ox, z: oz, hx: w / 2, hz: d / 2 });
      }
    }
  }

  // Palms: a double row down Ocean Boulevard and a cluster at the marina.
  for (let z = -240; z <= 240; z += 28) {
    for (const x of [-186, -172]) {
      const palm = makePalm(THREE_, rng);
      palm.position.set(x + range(rng, -2, 2), 0, z + range(rng, -4, 4));
      group.add(palm);
    }
  }
  for (let i = 0; i < 10; i += 1) {
    const palm = makePalm(THREE_, rng);
    palm.position.set(range(rng, -190, -150), 0, range(rng, 150, 240));
    group.add(palm);
  }

  // The pier: planks out over the water, with the ferris wheel at its end.
  const pier = new THREE_.Mesh(
    new THREE_.BoxGeometry(70, 1, 10),
    new THREE_.MeshLambertMaterial({ color: 0x9a7a55 }),
  );
  pier.position.set(-225, 0.4, 40);
  group.add(pier);
  const wheel = new THREE_.Group();
  const rim = new THREE_.Mesh(
    new THREE_.TorusGeometry(16, 0.7, 8, 28),
    new THREE_.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x553300 }),
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE_.Mesh(
      new THREE_.CylinderGeometry(0.3, 0.3, 32, 5),
      new THREE_.MeshLambertMaterial({ color: 0xe8e2d0 }),
    );
    spoke.rotation.z = a;
    wheel.add(spoke);
    const cabin = new THREE_.Mesh(
      new THREE_.BoxGeometry(3, 2.4, 2.4),
      new THREE_.MeshLambertMaterial({ color: pick(rng, [0xd8405e, 0x3f8f5f, 0x3a7bd5, 0xf2c230]) }),
    );
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cabin);
  }
  const legs = new THREE_.Mesh(
    new THREE_.BoxGeometry(2, 26, 2),
    new THREE_.MeshLambertMaterial({ color: 0x8a7a66 }),
  );
  legs.position.set(0, -13, 0);
  wheel.add(legs);
  wheel.position.set(-252, 26, 40);
  group.add(wheel);

  // Streetlights down the boulevard.
  const poleMat = new THREE_.MeshLambertMaterial({ color: 0x2c2c30 });
  const lampMat = new THREE_.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (let z = -210; z <= 210; z += 60) {
    const pole = new THREE_.Mesh(new THREE_.CylinderGeometry(0.15, 0.15, 7, 5), poleMat);
    pole.position.set(-168, 3.5, z);
    group.add(pole);
    const lamp = new THREE_.Mesh(new THREE_.SphereGeometry(0.5, 8, 6), lampMat);
    lamp.position.set(-168, 7.2, z);
    group.add(lamp);
  }

  return {
    group,
    colliders,
    wheel,
    spawn: { x: 30, z: -72 },
    garage: { x: 30, z: -90 },
    pier: { x: -215, z: 40 },
    marina: { x: -190, z: 200 },
  };
}

// True when a circle of radius r at (x, z) overlaps any building.
export function hitsBuilding(city, x, z, r) {
  for (const c of city.colliders) {
    if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return c;
  }
  return null;
}

// Push a circle out of buildings and the city edge; returns true on a hit.
export function resolveCollisions(city, pos, r) {
  let hit = false;
  const c = hitsBuilding(city, pos.x, pos.z, r);
  if (c) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hx + r);
    else pos.z = c.z + Math.sign(dz || 1) * (c.hz + r);
    hit = true;
  }
  const lim = WORLD.half - 6;
  if (pos.x < -WORLD.half + 6) { pos.x = -WORLD.half + 6; hit = true; }
  if (pos.x > lim) { pos.x = lim; hit = true; }
  if (pos.z < -lim) { pos.z = -lim; hit = true; }
  if (pos.z > lim) { pos.z = lim; hit = true; }
  return hit;
}

// Nearest point on a road line, for spawning traffic and police.
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const v of ROAD_LINES) {
    const d1 = Math.abs(x - v);
    if (d1 < bestD) { bestD = d1; best = { x: v, z }; }
    const d2 = Math.abs(z - v);
    if (d2 < bestD) { bestD = d2; best = { x, z: v }; }
  }
  return best;
}

export function roadLines() {
  return ROAD_LINES;
}
