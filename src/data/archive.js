// RED SOL - embedded ARCHIVED data. Nothing in this file is live.
// Every item says where it comes from. Items marked real:false are game-made variations.
export const DATA_STATUS = 'ARCHIVED';

export const FLARE_VARIANTS = [
  {
    id: 'x9_2024', intensity: 3, real: true,
    title: 'X9.0 solar flare',
    date: '3 Oct 2024',
    source: 'NASA Solar Dynamics Observatory (SDO)',
    blurb: 'On 3 October 2024 NASA\'s SDO saw a very powerful X9.0 solar flare.',
  },
  {
    id: 'rad_2024', intensity: 3, real: true,
    title: 'Radiation surge on Mars',
    date: '20 May 2024',
    source: 'NASA JPL, Curiosity rover RAD instrument',
    blurb: 'On 20 May 2024 Curiosity measured a radiation surge of about 8,100 micrograys. That is like about 30 chest X-rays.',
  },
  {
    id: 'x_class', intensity: 2, real: false,
    title: 'Strong solar flare',
    date: 'Game-made',
    source: 'Game-made, based on how X-class flares work (NASA)',
    blurb: 'A strong flare. Real X-class flares are the biggest kind the Sun makes.',
  },
  {
    id: 'm_class', intensity: 1, real: false,
    title: 'Medium solar flare',
    date: 'Game-made',
    source: 'Game-made, based on how M-class flares work (NASA)',
    blurb: 'A medium flare. Smaller than an X-class flare, but crew still need protecting.',
  },
];

export const FACTS = {
  storm: {
    title: 'Dust storm',
    text: 'In 2018 a huge dust storm covered all of Mars. It blocked the sunlight that Opportunity\'s solar panels needed, and the rover stopped talking to Earth.',
    source: 'NASA JPL', date: '2018', real: true,
  },
  flare: {
    title: 'Solar flare',
    text: 'The Sun sometimes throws out bursts of energy and particles. Mars has no thick air to block them, so astronauts need shielding.',
    source: 'NASA', real: true,
  },
  geomag: {
    title: 'Geomagnetic storm',
    text: 'On 10 May 2024 Earth had a G5 geomagnetic storm, the strongest in about 20 years. Storms like this can disturb radio links.',
    source: 'NOAA Space Weather Prediction Center', date: '10 May 2024', real: true,
  },
  devil: {
    title: 'Dust devil',
    text: 'On Mars, wind and dust devils sometimes blew the dust off the solar panels of the Spirit and Opportunity rovers.',
    source: 'NASA JPL', real: true,
  },
  meteor: {
    title: 'Space rock',
    text: 'Small space rocks hit Mars often. Mars has thin air, so less of them burn up on the way down.',
    source: 'NASA', real: true,
  },
  clog: {
    title: 'Water recycler',
    text: 'Space stations recycle almost all of their water. If the recycler stops, the crew must fix it fast.',
    source: 'NASA', real: true,
  },
  delay: {
    title: 'Radio delay',
    text: 'A radio message needs about 3 to 22 minutes to travel one way between Mars and Earth. In the game, 1 second = 1 minute.',
    source: 'NASA', real: true,
  },
  sol: {
    title: 'Sol',
    text: 'A sol is one Mars day. It lasts about 24 hours and 39 minutes.',
    source: 'NASA', real: true,
  },
  dose: {
    title: 'Radiation dose',
    text: 'Radiation dose is how much space radiation your body soaks up. A little is okay. A lot makes astronauts sick.',
    source: 'NASA', real: true,
  },
  greenhouse: {
    title: 'Greenhouse',
    text: 'Plants need light, water and warmth. On Mars they must grow inside a protected greenhouse.',
    source: 'Canadian Space Agency, food production toolkit', real: true,
  },
};

// Used by the Data Credits screen and the submission text.
export const DATASETS = [
  { name: 'Curiosity RAD radiation surge, 20 May 2024', agency: 'NASA JPL', url: 'https://www.jpl.nasa.gov/',
    why: 'Shows kids a real radiation reading on Mars (about 8,100 micrograys, like about 30 chest X-rays). Used for the big radiation surge event.' },
  { name: 'X9.0 solar flare, 3 Oct 2024', agency: 'NASA Solar Dynamics Observatory', url: 'https://sdo.gsfc.nasa.gov/',
    why: 'A real, very strong flare. Used as the model for the strongest flare event.' },
  { name: '2018 global Mars dust storm / Opportunity rover', agency: 'NASA JPL', url: 'https://www.jpl.nasa.gov/',
    why: 'Real example of dust blocking solar power. Used for the dust storm event and the solar panel trade-off.' },
  { name: 'G5 geomagnetic storm, 10 May 2024', agency: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/',
    why: 'Real space-weather storm that disturbs radio links. Used for the Earth radio-delay event.' },
  { name: 'Earth to Mars radio delay (3 to 22 minutes one way)', agency: 'NASA', url: 'https://www.nasa.gov/',
    why: 'Makes players feel why a Mars crew cannot wait for Earth to decide.' },
  { name: 'DONKI space weather database', agency: 'NASA CCMC', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    why: 'Where real flares are recorded. Inspired the flare event types. Not connected live in this game.' },
  { name: 'Food production toolkit', agency: 'Canadian Space Agency', url: 'https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/',
    why: 'Inspired the greenhouse: plants need light, water and care.' },
];

export const ASSET_CREDITS = [
  'All 3D models, textures and sounds are made by code inside the game (no downloaded art).',
  'Text uses fonts already on your device (no font files are downloaded).',
  'Built with Three.js (MIT licence).',
  'Built with AI assistance (Claude).',
  'This is an independent student project. It is not made or endorsed by NASA.',
];
