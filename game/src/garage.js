// Solstice Garage — the tuning shop: priced upgrades and gear, cash
// deduction, owned/locked states, and effects that apply to the car Rae
// is driving. Tune and plating follow her into any car she takes;
// respray stays with the car it was painted on. Reached from the pause
// menu only — no key, no trigger zone.
import { GARAGE_PRICE } from './config.js';

export const PAINTS = [
  { name: 'Sunset Gold', hex: 0xd8a24a },
  { name: 'Marina Teal', hex: 0x2e7f9e },
  { name: 'Marlow Black', hex: 0x2a2a2e },
  { name: 'Bay White', hex: 0xe8e2d0 },
];

// Prices are charged from G.player.money, the same pot the HUD shows.
// The staged $31,420 buys the tune + armour + a respray and still leaves
// change; a real mid-game wallet (~$2,000–4,000) buys one or two items.
export const GARAGE_ITEMS = [
  { id: 'repair', section: 'upgrades', name: 'FULL REPAIR', price: 250,
    short: 'Bodywork back to 100%.',
    desc: 'Bodywork back to 100%. No questions asked.' },
  { id: 'respray', section: 'upgrades', name: 'RESPRAY', price: 400,
    short: 'New paint — Gold, Teal, Black, White.',
    desc: 'New paint — cycles Sunset Gold, Marina Teal, Marlow Black, Bay White.' },
  { id: 'tune', section: 'upgrades', name: 'ENGINE TUNE', price: 4000, once: true,
    short: '+15% top speed and acceleration.',
    desc: '+15% top speed and acceleration, on every car you drive.' },
  { id: 'armour', section: 'upgrades', name: 'ARMOUR PLATING', price: 3000, once: true,
    short: 'Half damage from crashes, every car.',
    desc: 'Every car you drive takes half damage from crashes and blasts.' },
  { id: 'nitro', section: 'upgrades', name: 'NITRO KIT', price: 2500, locked: true,
    short: 'Nitrous boost — unlocks at LV 6.',
    desc: 'Nitrous boost — $2,500, unlocks at LV 6. Not for sale yet.' },
  { id: 'smg', section: 'gear', name: 'SMG', owned: true,
    short: 'Already in Rae\u2019s kit.',
    desc: 'Already in Rae\u2019s kit. Close quarters, 240-round mags.' },
  { id: 'bodyarmour', section: 'gear', name: 'BODY ARMOUR', price: 350, once: true,
    short: 'Full vest — armour back to 100%.',
    desc: 'Full vest — restores Rae\u2019s armour to 100%.' },
  { id: 'ammo', section: 'gear', name: 'AMMO, ALL GUNS', price: 200,
    short: 'Full mags, pistol and SMG.',
    desc: 'Full mags for the pistol and the SMG.' },
  { id: 'flare', section: 'gear', name: 'FLARE CHARGES', price: 600, once: true,
    short: 'Signal flares for getaways.',
    desc: 'Signal flares — light up the bay, or a getaway.' },
];

const CAR_NAMES = {
  sedan: 'RAE\u2019S SEDAN',
  sports: 'RAE\u2019S SPORTS COUPE',
  taxi: 'DEKE\u2019S CAB',
  pickup: 'RAE\u2019S PICKUP',
  police: 'SBPD CRUISER',
};

const money = (n) => `$${n.toLocaleString('en-US')}`;

export function createGarage(G) {
  const garage = {
    tab: 'workshop',
    selected: 'armour',
  };

  function car() { return G.playerCar; }

  function owned(item) {
    if (item.id === 'tune') return !!G.player.tune;
    if (item.id === 'armour') return !!G.player.plating;
    if (item.id === 'smg') return true;
    if (item.id === 'bodyarmour' || item.id === 'flare') return !!G.player.gear[item.id];
    return false;
  }

  function buy(id) {
    const item = GARAGE_ITEMS.find((i) => i.id === id);
    if (!item || item.locked || item.owned) return false;
    if (item.once && owned(item)) return false;
    if ((item.id === 'repair' || item.id === 'respray') && !car()) return false;
    if (item.id === 'repair' && car().damage === 0) return false;
    if (G.player.money < item.price) {
      G.hud.showToast('Not enough cash for that.');
      G.audio.blip();
      return false;
    }
    G.player.money -= item.price;
    if (item.id === 'repair') {
      car().damage = 0;
    } else if (item.id === 'respray') {
      const paint = PAINTS[G.player.respray % PAINTS.length];
      if (car().bodyMat) car().bodyMat.color.setHex(paint.hex);
      car().paint = paint.name;
      G.player.respray = (G.player.respray + 1) % PAINTS.length;
    } else if (item.id === 'tune') {
      G.player.tune = 1;
      if (car()) car().tuneBoost = 1.15;
    } else if (item.id === 'armour') {
      G.player.plating = true;
      if (car()) car().plating = true;
    } else if (item.id === 'bodyarmour') {
      G.player.armour = 100;
      G.player.gear.bodyarmour = true;
    } else if (item.id === 'ammo') {
      G.player.ammo.pistol = 120;
      G.player.ammo.smg = 240;
    } else if (item.id === 'flare') {
      G.player.gear.flare = true;
    }
    G.hud.showToast(`${item.name} fitted — ${money(item.price)}`);
    G.audio.blip();
    G.save();
    return true;
  }

  function fundHtml() {
    const p = G.player;
    const pct = Math.min(100, Math.round((p.money / GARAGE_PRICE) * 100));
    return `<div class="garage-fundline"><span>CASH <b>${money(p.money)}</b></span>` +
      `<span>REP ${p.rep} · DAY ${p.day}</span></div>` +
      `<div class="garage-fundline"><span>GARAGE ${money(p.money)} / ${money(GARAGE_PRICE)}</span>` +
      `<span>${pct}%</span></div>` +
      `<div class="garage-bar-wrap"><div class="garage-bar" style="width:${pct}%"></div></div>`;
  }

  function statsHtml() {
    const c = car();
    const tune = c ? c.tune : { top: 34, accel: 16, grip: 2.6 };
    const boost = (c && c.tuneBoost) || 1;
    const topKmh = Math.round(tune.top * boost * 3.6);
    const acc = Math.round(tune.accel * boost);
    const armour = c && c.plating ? 100 : 50;
    const handling = Math.round((tune.grip / 3.1) * 100);
    const bar = (label, value, pct, tag) =>
      `<div class="garage-stat"><div class="garage-stat-head"><span>${label}</span>` +
      `<b>${value}${tag ? ` <span class="garage-tag">${tag}</span>` : ''}</b></div>` +
      `<div class="garage-bar-wrap"><div class="garage-bar" style="width:${pct}%"></div></div></div>`;
    return `<div class="garage-stats">` +
      bar('TOP SPEED', `${topKmh} km/h`, Math.min(100, (topKmh / 190) * 100), boost > 1 ? '+15% TUNED' : '') +
      bar('ACCELERATION', String(acc), Math.min(100, (acc / 28) * 100), boost > 1 ? '+15%' : '') +
      bar('ARMOUR', `${armour}%`, armour, c && c.plating ? 'PLATED' : '') +
      bar('HANDLING', `${handling}%`, handling, '') +
      `</div>`;
  }

  function carName() {
    const c = car();
    return CAR_NAMES[(c && c.kind) || 'sedan'];
  }

  function showroomHtml() {
    const c = car();
    const paint = c && c.paint ? c.paint : 'Factory paint';
    const cond = c ? `${Math.max(0, Math.round(100 - c.damage))}% condition` : 'On foot — no car in the bay';
    return `<div class="garage-showroom"><div class="garage-carname">${carName()}</div>` +
      `<div class="garage-cardesc">${paint} · ${cond}</div>` +
      `<div class="garage-line">Mara keeps her tuned and gassed. Bring her home in one piece and the bay is yours.</div></div>`;
  }

  function sectionHtml(title, section) {
    const rows = GARAGE_ITEMS.filter((i) => i.section === section).map((item) => {
      const isOwned = owned(item);
      const noCar = (item.id === 'repair' || item.id === 'respray') && !car();
      const noDamage = item.id === 'repair' && car() && car().damage === 0;
      let label = item.price !== undefined ? `BUY ${money(item.price)}` : 'OWNED ✓';
      let disabled = '';
      if (item.locked) { label = 'LOCKED · LV 6'; disabled = 'disabled'; }
      else if (isOwned) { label = 'OWNED ✓'; disabled = 'disabled'; }
      else if (noCar) { label = 'NO CAR'; disabled = 'disabled'; }
      else if (noDamage) { label = 'NO DAMAGE'; disabled = 'disabled'; }
      else if (G.player.money < item.price) { disabled = 'disabled'; }
      const sel = garage.selected === item.id ? ' sel' : '';
      return `<div class="garage-row${sel}" data-select="${item.id}">` +
        `<span class="garage-name">${item.name}</span>` +
        `<span class="garage-effect">${item.short || item.desc}</span>` +
        `<button class="garage-buy" data-buy="${item.id}" ${disabled}>${label}</button></div>`;
    }).join('');
    return `<div class="garage-sec">${title}</div>${rows}`;
  }

  function descHtml() {
    const sel = GARAGE_ITEMS.find((i) => i.id === garage.selected) || GARAGE_ITEMS[0];
    return `<div class="garage-desc"><b>${sel.name}</b> — ${sel.desc}</div>`;
  }

  function rowsHtml() {
    const tabs = `<div class="garage-tabs">` +
      `<button class="garage-tab${garage.tab === 'workshop' ? ' on' : ''}" data-tab="workshop">WORKSHOP</button>` +
      `<button class="garage-tab${garage.tab === 'showroom' ? ' on' : ''}" data-tab="showroom">SHOWROOM</button></div>`;
    const body = garage.tab === 'showroom'
      ? showroomHtml()
      : sectionHtml('CAR UPGRADES', 'upgrades') + sectionHtml('WEAPONS & GEAR', 'gear') + descHtml();
    return fundHtml() + statsHtml() + tabs + body;
  }

  garage.buy = buy;
  garage.rowsHtml = rowsHtml;
  garage.carName = carName;
  return garage;
}
