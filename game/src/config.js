// Solstice Bay — every tuning number, name and story beat in one place.
// The city is a flat XZ plane, 520 units across, beach and water on the west.
// Roads run on a 60-unit grid; buildings fill the blocks between them.
export const WORLD = {
  half: 260,
  roadSpacing: 60,
  roadWidth: 14,
  beachX: -200,
  waterX: -228,
  groundY: 0,
};

export const STEP = 1 / 60;

export const PLAYER_TUNE = {
  walkSpeed: 6.5,
  runSpeed: 10,
  radius: 0.7,
  height: 1.8,
  health: 100,
  armour: 100,
};

export const CAR_TUNE = {
  sedan: { top: 34, accel: 16, brake: 30, grip: 2.6, color: 0xd8a24a },
  taxi: { top: 32, accel: 15, brake: 30, grip: 2.6, color: 0xf2c230 },
  pickup: { top: 30, accel: 13, brake: 26, grip: 2.4, color: 0x7a8ba0 },
  sports: { top: 46, accel: 24, brake: 34, grip: 3.1, color: 0xd8405e },
  police: { top: 40, accel: 22, brake: 34, grip: 3.0, color: 0xe8e8e8 },
};

export const WEAPONS = {
  fists: { name: 'Fists', range: 2.4, damage: 25, rate: 0.45, ammo: Infinity },
  pistol: { name: 'Pistol', range: 70, damage: 34, rate: 0.32, ammo: 120 },
  smg: { name: 'SMG', range: 55, damage: 18, rate: 0.09, ammo: 240 },
};

export const DISTRICTS = [
  { name: 'Ocean Boulevard', x0: -260, x1: -140, z0: -260, z1: 260 },
  { name: 'The Marina', x0: -260, x1: -140, z0: 60, z1: 260 },
  { name: 'Boardwalk', x0: -140, x1: -40, z0: 120, z1: 260 },
  { name: 'Old Town', x0: -140, x1: -40, z0: -260, z1: -60 },
  { name: 'Downtown', x0: -40, x1: 80, z0: -120, z1: 60 },
  { name: 'Civic Quarter', x0: -40, x1: 80, z0: 60, z1: 260 },
  { name: 'Harbor Heights', x0: 80, x1: 260, z0: -260, z1: -40 },
  { name: 'Palm Court', x0: 80, x1: 260, z0: -40, z1: 260 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solstice Bay';
}

// The story: Rae Calloway, getaway driver, comes home to buy back her
// brother's seized garage from the Marlow crew. Seven jobs, one per chapter.
export const MISSIONS = [
  {
    title: 'Ch.1 Homecoming',
    giver: 'Mara',
    intro: [
      'Mara: Rae! Three years and you walk in like the tide never left.',
      'Rae: The garage, Mara. Tell me Marlow hasn\'t sold it yet.',
      'Mara: Not yet. But his boys watch it day and night. Go see it yourself.',
    ],
    steps: [
      { type: 'goto', text: 'Drive to Calloway Garage', target: [30, -90], reward: 0 },
      { type: 'talk', text: 'Talk to Mara at the garage', target: [30, -90], reward: 400 },
    ],
  },
  {
    title: 'Ch.2 First Fare',
    giver: 'Deke',
    intro: [
      'Deke: You want work? My cabbie quit. Take the taxi, pick up the fare.',
      'Rae: A taxi. I used to outrun the whole SBPD. Now I drive tourists.',
      'Deke: Tourists pay, Rae. And they tip when you beat the light.',
    ],
    steps: [
      { type: 'goto', text: 'Pick up the fare on Ocean Boulevard', target: [-160, 140], reward: 0 },
      { type: 'deliver', text: 'Drop the fare at Palm Court — 90s', target: [150, 150], time: 90, reward: 600 },
    ],
  },
  {
    title: 'Ch.3 The Tail',
    giver: 'Mara',
    intro: [
      'Mara: Marlow\'s runner moves cash every night at dusk. Follow him.',
      'Rae: And if he spots me?',
      'Mara: Then he spots the best driver in Solstice Bay. Stay back. Stay patient.',
    ],
    steps: [
      { type: 'tail', text: 'Tail the Marlow runner — keep 15 to 45m, 40s', target: [0, 0], time: 40, reward: 800 },
    ],
  },
  {
    title: 'Ch.4 Bayfront Delivery',
    giver: 'Deke',
    intro: [
      'Deke: A package for the marina. No questions. SBPD is out tonight.',
      'Rae: Of course they are. That\'s when the bay pays best.',
    ],
    steps: [
      { type: 'deliver', text: 'Deliver the package to the marina — 100s', target: [-190, 200], time: 100, reward: 900 },
    ],
  },
  {
    title: 'Ch.5 Pier Shootout',
    giver: 'Mara',
    intro: [
      'Mara: Marlow\'s boys are shaking down the pier stalls. End it.',
      'Rae: Six of them? Mara, I drive. I don\'t do sieges.',
      'Mara: Tonight you do both. The pier is yours if you take it.',
    ],
    steps: [
      { type: 'fight', text: 'Clear the pier — defeat 6 Marlow crew', target: [-215, 40], count: 6, reward: 1200 },
    ],
  },
  {
    title: 'Ch.6 The Safehouse Heist',
    giver: 'Deke',
    intro: [
      'Deke: Marlow keeps the garage papers in his safehouse. Crack it.',
      'Rae: Papers, cash, and a four-star welcome. Fine. I\'m in.',
    ],
    steps: [
      { type: 'goto', text: 'Reach the Marlow safehouse', target: [140, -140], reward: 0 },
      { type: 'hold', text: 'Crack the safe — hold the spot 20s', target: [140, -140], time: 20, reward: 0 },
      { type: 'escape', text: 'Lose the heat, then reach the garage', target: [30, -90], reward: 1800 },
    ],
  },
  {
    title: 'Ch.7 Buy Back the Garage',
    giver: 'Rae',
    intro: [
      'Rae: This is it. Marlow himself, at the marina, with my brother\'s keys.',
      'Rae: One last job. Then the garage is ours again, and I\'m home for good.',
    ],
    steps: [
      { type: 'fight', text: 'Take the marina — defeat 8 Marlow crew', target: [-190, 200], count: 8, reward: 0 },
      { type: 'goto', text: 'Meet Mara at Calloway Garage', target: [30, -90], reward: 3000 },
    ],
  },
];

export const RADIO = [
  { name: 'Tide FM 97.3', mood: 'sunset drive', base: 220 },
  { name: 'Bay Static 88.1', mood: 'night cruise', base: 175 },
  { name: 'Neon Coast 104.9', mood: 'getaway', base: 262 },
];

export const PALETTE = {
  skyTop: '#2e4a7a',
  skyMid: '#e8805a',
  skyLow: '#f7b267',
  sun: '#ffd9a0',
  fog: '#e8956a',
  road: '#3a3f4a',
  roadLine: '#e8d27a',
  sidewalk: '#b8a88f',
  sand: '#e3c98f',
  water: '#2e7f9e',
  building: ['#e8d9b8', '#d9a679', '#c97e6b', '#7fa8a0', '#e0b48f', '#b7c4c9'],
  palmTrunk: '#8a6a4a',
  palmLeaf: '#3f8f5f',
};

export const SAVE_KEY = 'solstice-bay.save.v1';
export const BEST_KEY = 'solstice-bay.best.v1';
