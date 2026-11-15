// World layout. Must match STATIONS / OBSTACLES in src/sim/sim.js (front of buildings is +z).
export const MOD = {
  power:   { x: -14, z: -8, r: 3.6 },
  med:     { x: -3,  z: -8, r: 3.6 },
  water:   { x: 6,   z: -9, r: 3.6 },
  green:   { x: 15,  z: -8, r: 5 },
  shelter: { x: 24,  z: -4, r: 3 },
};
export const ST = {
  shield: [-15.5, -2.6], lowpower: [-12.5, -2.6], comms: [-8, -8.5], medbay: [-3, -2.8], recycler: [6, -3.8],
  greenhouse: [15, -1.8], shelter: [24, 0.8], panel0: [-24, 4], panel1: [-24, 8], panel2: [-24, 12], storage: [8, 5],
  leak_power: [-11, -3.4], leak_med: [-0.8, -3.4], leak_water: [8.2, -4], leak_green: [18, -2.2],
};
export const SHIELD_C = { x: 1, z: -1, r: 33 };
export const MODULE_IDS = ['power', 'med', 'water', 'green'];
