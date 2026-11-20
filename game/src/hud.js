// The HUD: mission banner, wanted stars, money, health and armour, the
// circular minimap, speed and car condition, weapon slots, radio, district
// name, dialogue bar and the police response list. DOM text is updated
// only when it changes, so a frame allocates nothing.
import { districtAt, WEAPONS } from './config.js';
import { roadLines } from './city.js';

function $(id) {
  return document.getElementById(id);
}

export function createHud() {
  const el = {
    money: $('hud-money'),
    rep: $('hud-rep'),
    day: $('hud-day'),
    stars: $('hud-stars'),
    health: $('hud-health'),
    armour: $('hud-armour'),
    missionTitle: $('hud-mission-title'),
    missionText: $('hud-mission-text'),
    missionBar: $('hud-mission-bar'),
    missionTimer: $('hud-mission-timer'),
    speed: $('hud-speed'),
    condition: $('hud-condition'),
    weapon: $('hud-weapon'),
    radio: $('hud-radio'),
    district: $('hud-district'),
    police: $('hud-police'),
    dialogue: $('hud-dialogue'),
    dialogueSpeaker: $('hud-dialogue-speaker'),
    dialogueText: $('hud-dialogue-text'),
    toast: $('hud-toast'),
    minimap: $('hud-minimap'),
  };
  const mapCtx = el.minimap ? el.minimap.getContext('2d') : null;
  const cache = new Map();
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let toastTimer = 0;

  function set(node, key, value) {
    if (!node) return;
    if (cache.get(key) !== value) {
      cache.set(key, value);
      node.textContent = value;
    }
  }

  function setBar(node, key, value) {
    if (!node) return;
    const v = `${Math.round(value * 100)}%`;
    if (cache.get(key) !== v) {
      cache.set(key, v);
      node.style.width = v;
    }
  }

  function setHtml(node, key, value) {
    if (!node) return;
    if (cache.get(key) !== value) {
      cache.set(key, value);
      node.innerHTML = value;
    }
  }

  function drawMinimap(G) {
    if (!mapCtx) return;
    const S = 190;
    const scale = S / 560;
    const toMap = (x, z) => [(x + 280) * scale, (z + 280) * scale];
    mapCtx.clearRect(0, 0, S, S);
    // Bright ground so the map reads in a screenshot, not black-on-dark.
    mapCtx.fillStyle = '#46586e';
    mapCtx.fillRect(0, 0, S, S);
    // Water on the west edge.
    mapCtx.fillStyle = '#54b0d6';
    mapCtx.fillRect(0, 0, (52) * scale, S);
    mapCtx.fillStyle = '#f2d89a';
    mapCtx.fillRect((52) * scale, 0, 14 * scale, S);
    // Roads: bright gold, wide enough to read at a glance.
    mapCtx.strokeStyle = '#f2c230';
    mapCtx.lineWidth = 6;
    for (const v of roadLines()) {
      const [x] = toMap(v, 0);
      const [, z] = toMap(0, v);
      mapCtx.beginPath();
      mapCtx.moveTo(x, 0);
      mapCtx.lineTo(x, S);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, z);
      mapCtx.lineTo(S, z);
      mapCtx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, mz, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    if (G.traffic) {
      for (const car of G.traffic.cars) dot(car.pos.x, car.pos.z, '#ffffff', 2.2);
      for (const ped of G.traffic.peds) {
        if (ped.down > 0) continue;
        dot(ped.pos.x, ped.pos.z, '#e8ecf2', 1.6);
      }
    }
    if (G.combat) {
      for (const e of G.combat.enemies) {
        if (!e.down) dot(e.pos.x, e.pos.z, '#ff7a3c', 2.8);
      }
    }
    if (G.police) {
      for (const car of G.police.cars) {
        const [mx, mz] = toMap(car.pos.x, car.pos.z);
        mapCtx.fillStyle = '#ff2e2e';
        mapCtx.beginPath();
        mapCtx.arc(mx, mz, 3.4, 0, Math.PI * 2);
        mapCtx.fill();
        mapCtx.strokeStyle = '#ffffff';
        mapCtx.lineWidth = 1;
        mapCtx.stroke();
      }
      for (const car of G.police.roadblocks) dot(car.pos.x, car.pos.z, '#ff2e2e', 2.6);
    }
    const target = G.missions ? G.missions.targetPos() : null;
    if (target && G.missions.state.active) {
      const [mx, mz] = toMap(target.x, target.z);
      const pulse = 5 + Math.sin(G.time * 4) * 2;
      mapCtx.strokeStyle = '#f2c230';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.moveTo(mx, mz - pulse);
      mapCtx.lineTo(mx + pulse, mz);
      mapCtx.lineTo(mx, mz + pulse);
      mapCtx.lineTo(mx - pulse, mz);
      mapCtx.closePath();
      mapCtx.stroke();
    }
    // Player arrow: white with a dark outline so it pops off the map.
    const [px, pz] = toMap(G.player.pos.x, G.player.pos.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(Math.PI - G.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#1b1f2a';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
  }

  return {
    showDialogue(lines) {
      dialogueQueue = [...lines];
      dialogueTimer = 0;
      this.advanceDialogue();
    },
    advanceDialogue() {
      if (dialogueQueue.length === 0) {
        if (el.dialogue) el.dialogue.classList.add('hidden');
        return;
      }
      const line = dialogueQueue.shift();
      const [speaker, ...rest] = line.split(':');
      if (el.dialogue) el.dialogue.classList.remove('hidden');
      set(el.dialogueSpeaker, 'speaker', speaker.trim());
      set(el.dialogueText, 'dialogue', rest.join(':').trim());
      dialogueTimer = 5;
    },
    showToast(text, dur) {
      if (!el.toast) return;
      el.toast.textContent = text;
      el.toast.classList.remove('hidden');
      toastTimer = dur || 3.5;
    },
    update(dt, G, confirmPressed) {
      if (dialogueTimer > 0) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0 || confirmPressed) this.advanceDialogue();
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0 && el.toast) el.toast.classList.add('hidden');
      }
      const p = G.player;
      set(el.money, 'money', `$${p.money.toLocaleString('en-US')}`);
      set(el.rep, 'rep', `REP ${p.rep}`);
      set(el.day, 'day', `DAY ${p.day}`);
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
      set(el.stars, 'stars', stars);
      setBar(el.health, 'health', Math.max(0, p.health) / 100);
      setBar(el.armour, 'armour', Math.max(0, p.armour) / 100);
      const cur = G.missions ? G.missions.current() : null;
      if (cur) {
        set(el.missionTitle, 'mtitle', cur.title);
        set(el.missionText, 'mtext', cur.text);
        setBar(el.missionBar, 'mbar', cur.progress || 0);
        set(el.missionTimer, 'mtimer', cur.timer > 0 ? `${Math.ceil(cur.timer)}s` : '');
      }
      const car = G.playerCar;
      set(el.speed, 'speed', car ? `${Math.round(Math.abs(car.speed) * 3.6)} km/h` : `${Math.round(Math.abs(p.speed || 0) * 3.6)} km/h`);
      set(el.condition, 'cond', car ? `CAR ${Math.max(0, Math.round(100 - car.damage))}%` : 'ON FOOT');
      // Weapon slots with ammo (top-10 covers show these as slots).
      setHtml(el.weapon, 'weaponslots',
        `<span class="wslot${p.weapon === 'pistol' ? ' on' : ''}">PISTOL · ${p.ammo.pistol || 0}</span>` +
        `<span class="wslot${p.weapon === 'smg' ? ' on' : ''}">SMG · ${p.ammo.smg || 0}</span>`);
      set(el.radio, 'radio', G.audio ? G.audio.stationName() : 'Tide FM 97.3');
      set(el.district, 'district', districtAt(p.pos.x, p.pos.z));
      if (el.police && G.policeBehaviours) {
        // Police response list: callsign + behaviour chip + distance.
        setHtml(el.police, 'police',
          G.policeBehaviours.map((b) => {
            const chip = b.kind === 'RAMMING' ? 'chip hot' : 'chip';
            return `<div class="police-row">${b.name ? `<span class="unit-name">${b.name}</span>` : ''}<span class="${chip}">${b.kind}</span><span>${b.dist ? `${b.dist}m` : ''}</span></div>`;
          }).join(''));
      }
      drawMinimap(G);
    },
  };
}
