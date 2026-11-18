// The three.js stage: renderer, sunset sky and lights, the chase camera,
// and a small particle pool for smoke, sparks and explosions.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyLow);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,230,170,1)');
  grad.addColorStop(0.4, 'rgba(255,190,110,0.85)');
  grad.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const POOL = 320;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 140, 560);

  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x7a5a4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.5);
  sun.position.set(-180, 90, 60);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fb0d8, 0.35);
  fill.position.set(120, 80, -120);
  scene.add(fill);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(180, 180, 1);
  sunSprite.position.set(-480, 55, -60);
  scene.add(sunSprite);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
  camera.position.set(40, 20, 40);

  // Particle pool: one Points cloud, dead particles parked far below.
  const positions = new Float32Array(POOL * 3);
  const colors = new Float32Array(POOL * 3);
  for (let i = 0; i < POOL; i += 1) positions[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < POOL; i += 1) parts.push({ life: 0, vx: 0, vy: 0, vz: 0 });
  let cursor = 0;

  const flash = new THREE.PointLight(0xffc860, 0, 30);
  scene.add(flash);

  const cam = { yaw: 0, pitch: 0, dist: 12, height: 4.6, shake: 0, mode: 'chase' };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function spawnBurst(x, y, z, color, count, spread, up) {
    const col = new THREE.Color(color);
    for (let n = 0; n < count; n += 1) {
      const i = cursor;
      cursor = (cursor + 1) % POOL;
      const p = parts[i];
      p.life = 0.5 + Math.random() * 0.7;
      p.vx = (Math.random() - 0.5) * spread;
      p.vy = Math.random() * up;
      p.vz = (Math.random() - 0.5) * spread;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function updateParticles(dt) {
    let any = false;
    for (let i = 0; i < POOL; i += 1) {
      const p = parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      positions[i * 3] += p.vx * dt;
      positions[i * 3 + 1] += p.vy * dt;
      positions[i * 3 + 2] += p.vz * dt;
      p.vy -= 2 * dt;
      if (p.life <= 0) positions[i * 3 + 1] = -999;
    }
    if (any) geo.attributes.position.needsUpdate = true;
    if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 60);
  }

  // Follow the player (on foot or in a car) with a chase camera that sits
  // behind the heading and lifts a little with speed. On foot the camera
  // comes in closer, so the player is properly in frame.
  function updateCamera(target, heading, speed, dt, onFoot) {
    const wantDist = onFoot ? 9 : cam.mode === 'classic' ? 17 : 12 + Math.min(4, Math.abs(speed) * 0.08);
    const wantHeight = onFoot ? 3.4 : cam.mode === 'classic' ? 7.5 : 4.6 + Math.min(1.6, Math.abs(speed) * 0.03);
    cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 3);
    cam.height += (wantHeight - cam.height) * Math.min(1, dt * 3);
    const a = heading + Math.PI + cam.yaw;
    const cx = target.x + Math.sin(a) * cam.dist;
    const cz = target.z + Math.cos(a) * cam.dist;
    const cy = target.y + cam.height + cam.pitch;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 5);
    if (cam.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * cam.shake;
      camera.position.y += (Math.random() - 0.5) * cam.shake;
      cam.shake = Math.max(0, cam.shake - dt * 2.2);
    }
    camera.lookAt(target.x + Math.sin(heading) * 6, target.y + 1.6, target.z + Math.cos(heading) * 6);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, cam,
    resize, render, updateCamera, updateParticles, spawnBurst,
    muzzle(x, y, z) {
      flash.position.set(x, y, z);
      flash.intensity = 14;
    },
    addShake(amount) { cam.shake = Math.min(1.2, cam.shake + amount); },
  };
}
