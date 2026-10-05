// Place names outside Tarlac that a passenger might type as a pickup or
// drop-off: every Philippine province except Tarlac, the cities, the towns
// right around Tarlac, and a few well-known destinations. Typing one gets
// the "outside Tarlac" error and no suggestions at all (IT expert review,
// 2026-10-06), not even Tarlac shops that carry the name ("Pampanga's Famous
// Nathaniel's, Tarlac City"), which read as if Pampanga were allowed.
//
// Left out on purpose: names that are also everyday Tarlac street or shop
// names (Rizal, Quezon, Aurora, Isabela, Antique, Palawan as in Palawan
// Express), and any name that is also a Tarlac town or barangay (San Jose,
// Concepcion, San Juan...), removed automatically below.
const TARLAC_BARANGAYS = require('./data/tarlac-barangays.json');

const PROVINCES = [
  'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Apayao', 'Basilan', 'Bataan',
  'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan',
  'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu', 'Cotabato',
  'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental',
  'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo',
  'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte', 'Maguindanao',
  'Marinduque', 'Masbate', 'Misamis Occidental', 'Misamis Oriental', 'Mountain Province',
  'Negros Occidental', 'Negros Oriental', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya',
  'Occidental Mindoro', 'Oriental Mindoro', 'Mindoro', 'Pampanga', 'Pangasinan', 'Quirino', 'Romblon',
  'Samar', 'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato', 'Southern Leyte', 'Sultan Kudarat',
  'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte',
  'Zamboanga del Sur', 'Zamboanga Sibugay'
];

const CITIES_AND_AREAS = [
  // Metro Manila and the big regions
  'Metro Manila', 'NCR', 'Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig', 'Pasay', 'Caloocan',
  'Marikina', 'Mandaluyong', 'Muntinlupa', 'Paranaque', 'Parañaque', 'Las Pinas', 'Las Piñas',
  'Valenzuela', 'Navotas', 'Malabon', 'Pateros', 'Cubao', 'Ortigas', 'BGC', 'Bonifacio Global City',
  'NAIA', 'Visayas', 'Mindanao',
  // Central and Northern Luzon
  'Angeles', 'Mabalacat', 'Clark', 'San Fernando', 'Subic', 'Olongapo', 'Balanga', 'Malolos',
  'Meycauayan', 'San Jose del Monte', 'Cabanatuan', 'Gapan', 'Palayan', 'Munoz', 'Muñoz',
  'San Jose City', 'Dagupan', 'Urdaneta', 'Alaminos', 'Baguio', 'Santiago City', 'Cauayan', 'Ilagan',
  'Tuguegarao', 'Vigan', 'Laoag', 'Baler',
  // Towns just across Tarlac's borders
  'Porac', 'Magalang', 'Arayat', 'Floridablanca', 'Lubao', 'Guagua', 'Bacolor', 'Mexico Pampanga',
  'Bayambang', 'Malasiqui', 'Villasis', 'Rosales', 'Tayug', 'Cuyapo', 'Guimba', 'Nampicuan', 'Talugtug',
  'Iba', 'Botolan',
  // Southern Luzon, Visayas, Mindanao
  'Lipa', 'Tanauan', 'Lucena', 'Antipolo', 'Calamba', 'Binan', 'Biñan', 'San Pablo', 'Cavite City',
  'Dasmarinas', 'Dasmariñas', 'Bacoor', 'Imus', 'Tagaytay', 'Naga City', 'Legazpi', 'Iloilo City',
  'Bacolod', 'Cebu City', 'Lapu-Lapu', 'Mandaue', 'Tacloban', 'Dumaguete', 'Cagayan de Oro', 'Davao',
  'Davao City', 'Zamboanga', 'Zamboanga City', 'General Santos', 'Butuan', 'Iligan', 'Puerto Princesa',
  'Cotabato City', 'Koronadal', 'Tagum', 'Boracay'
];

const TARLAC_TOWNS = ['Anao', 'Bamban', 'Camiling', 'Capas', 'Concepcion', 'Gerona', 'La Paz', 'Mayantoc',
  'Moncada', 'Paniqui', 'Pura', 'Ramos', 'San Clemente', 'San Jose', 'San Manuel', 'Santa Ignacia',
  'Tarlac', 'Tarlac City', 'Victoria'];

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const TARLAC_NAMES = new Set([...TARLAC_TOWNS, ...TARLAC_BARANGAYS.map(row => row[0])].map(normalize));

// The final list, also served to the page (GET /api/rides/outside-places)
// so the warning shows the moment a name is typed.
const OUTSIDE_PLACE_NAMES = [...new Set([...PROVINCES, ...CITIES_AND_AREAS].map(normalize))]
  .filter(name => !TARLAC_NAMES.has(name));

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole words only, so "cebu" doesn't catch "Cebuana Lhuillier" and "iba"
// doesn't catch "Ibarra".
const OUTSIDE_PATTERN = new RegExp(`(^|[^a-z0-9])(${OUTSIDE_PLACE_NAMES.map(escapeRegExp).join('|')})(?=$|[^a-z0-9])`);

function namesPlaceOutsideTarlac(text) {
  return OUTSIDE_PATTERN.test(normalize(text));
}

module.exports = { OUTSIDE_PLACE_NAMES, namesPlaceOutsideTarlac };
