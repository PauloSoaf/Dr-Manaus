/**
 * Catalogue for the Kenney Car Kit -> DR-MANAUS vehicle pipeline (see scripts/assets/build-vehicles.mjs).
 * Scales are fixed by the seated-hero fit, not by real-world length.
 */

export const PACK = {
  pack: 'Kenney Car Kit 3.1',
  author: 'Kenney (www.kenney.nl)',
  url: 'https://kenney.nl/assets/car-kit',
  licence: 'CC0 1.0',
};

// Seated hero (game metres, character root at the feet, facing +Z).
export const HERO = {
  pelvisUp: 0.654,
  headTopAbovePelvis: 1.55 - 0.654, // 0.896
  wheelUp: 0.43,
  wheelForward: 0.35,
  wheelRadius: 0.2,
  wheelTiltDeg: 25, // disc plane lean from vertical, top edge towards the driver
  seatXFraction: 0.36, // of body width; driver on the LEFT (+X), Brazil drives on the right
  roofClearance: 0.05,
  doorOpenAngle: 1.15,
};

/** Palette strips (colormap.png is 16 columns x 4 rows of 32x128 px strips; id = col + 16*row). */
export const STRIPS = {
  glass: [48, 49],
  lights: { head: [50, 51], tail: [52, 53], bar: [54, 55] },
  paintFamilies: [18, 20, 22, 24, 26, 28, 30], // flat/gradient pairs (peach, cream, green, yellow, orange, red, blue)
  white: [44, 45],
};

export const VEHICLES = [
  { id: 'hatch', src: 'hatchback-sports', label: 'Hatch compacto', category: 'hatch_compacto', scale: 1.55, mass: 1150, traffic: 1.4, drive: 'front' },
  { id: 'sedan', src: 'sedan', label: 'Sedã popular', category: 'sedan_popular', scale: 1.55, mass: 1250, traffic: 1.4, drive: 'front' },
  { id: 'sedan_exec', src: 'sedan-sports', label: 'Sedã executivo', category: 'sedan_executivo', scale: 1.55, mass: 1500, traffic: 0.6, drive: 'rear' },
  { id: 'suv', src: 'suv', label: 'SUV', category: 'suv', scale: 1.6, mass: 1900, traffic: 0.9, drive: 'all' },
  { id: 'pickup', src: 'truck', label: 'Picape', category: 'picape', scale: 1.6, mass: 2000, traffic: 0.6, drive: 'all' },
  { id: 'sports', src: 'race', label: 'Esportivo', category: 'esportivo', scale: 1.55, mass: 1150, traffic: 0.25, drive: 'rear', openCockpit: true },
  { id: 'taxi', src: 'taxi', label: 'Táxi', category: 'taxi', scale: 1.55, mass: 1300, traffic: 0.6, drive: 'front' },
  { id: 'security', src: 'police', label: 'Carro de segurança', category: 'carro_de_seguranca', scale: 1.55, mass: 1450, traffic: 0.25, drive: 'rear', fixedLivery: true },
  { id: 'van', src: 'van', label: 'Van', category: 'van', scale: 1.6, mass: 1900, traffic: 0.5, drive: 'rear' },
  { id: 'cargo', src: 'delivery', label: 'Utilitário de carga', category: 'utilitario_de_carga', scale: 1.65, mass: 3000, traffic: 0.4, drive: 'rear' },
  { id: 'luxury', src: 'suv-luxury', label: 'Carro de luxo', category: 'carro_de_luxo', scale: 1.6, mass: 1900, traffic: 0.3, drive: 'all' },
  { id: 'future', src: 'race-future', label: 'Conceito futurista', category: 'conceito_futurista', scale: 1.55, mass: 1200, traffic: 0.05, drive: 'rear', openCockpit: true },
  { id: 'flatbed', src: 'truck-flat', label: 'Caminhonete de carroceria', category: 'caminhonete_carroceria', scale: 1.65, mass: 3200, traffic: 0.3, drive: 'rear', paintStrips: [44, 45] },
  { id: 'ambulance', src: 'ambulance', label: 'Ambulância', category: 'ambulancia', scale: 1.65, mass: 3500, traffic: 0.05, drive: 'rear', fixedLivery: true },
  { id: 'firetruck', src: 'firetruck', label: 'Caminhão de bombeiros', category: 'caminhao_bombeiros', scale: 1.7, mass: 9000, traffic: 0.03, drive: 'rear', fixedLivery: true },
  { id: 'garbage', src: 'garbage-truck', label: 'Caminhão de lixo', category: 'caminhao_lixo', scale: 1.7, mass: 11000, traffic: 0.08, drive: 'rear' },
];

export const MISSING_CATEGORIES = ['Carro antigo'];

export const DERIVATION = 'uniform scale ×{scale}; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting';
