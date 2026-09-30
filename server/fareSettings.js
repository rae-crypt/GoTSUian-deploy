const db = require('./config/db');

// Distance-based fare, from Tarlac City Ordinance IX-4-001-2024 (the
// tricycle fare sticker): the senior citizen / student row for one
// passenger is ₱20 for the first kilometre and ₱5 for every additional
// kilometre. A started kilometre counts as a whole one, the usual reading of
// "sa bawat karagdagang kilometro". The admin can change both figures (see
// adminController's fare settings), e.g. to the regular row, ₱25 + ₱5.
const DEFAULT_FARE_SETTINGS = {
  first_km_fare: 20,
  per_km_fare: 5,
  basis: 'City Ordinance IX-4-001-2024 (student rate, 1 passenger)'
};

let current = { ...DEFAULT_FARE_SETTINGS };
// Whether rides.distance_km is known to exist. createRide only writes that
// column once it is, so a failed ALTER can never break booking itself.
let distanceColumnReady = false;

function hasDistanceColumn() {
  return distanceColumnReady;
}

function toSettings(row) {
  return {
    first_km_fare: Number(row.first_km_fare),
    per_km_fare: Number(row.per_km_fare),
    basis: row.basis || DEFAULT_FARE_SETTINGS.basis,
    updated_at: row.updated_at || null
  };
}

function getFareSettings() {
  return current;
}

// Road distance in km → fare in whole pesos. The distance is rounded to the
// 10 m first, so floating-point noise (2.0000001 km) can't tip a trip into
// an extra kilometre.
function computeFare(distanceKm, settings = current) {
  const km = Math.round(distanceKm * 100) / 100;
  const extraKm = Math.max(0, Math.ceil(km - 1));
  return Math.round(settings.first_km_fare + settings.per_km_fare * extraKm);
}

function saveFareSettings({ first_km_fare, per_km_fare, basis }, callback) {
  db.query(
    `UPDATE fare_settings SET first_km_fare = ?, per_km_fare = ?, basis = ? WHERE id = 1`,
    [first_km_fare, per_km_fare, basis],
    (err) => {
      if (err) return callback(err);
      loadFareSettings(callback);
    }
  );
}

function loadFareSettings(callback = () => {}) {
  db.query(`SELECT * FROM fare_settings WHERE id = 1`, (err, rows) => {
    if (err) return callback(err);
    if (rows.length) current = toSettings(rows[0]);
    callback(null, current);
  });
}

// Run once at startup. Additions only, and each step is skipped when already
// done: the one-row fare_settings table (seeded with the ordinance rates),
// and rides.distance_km so every ride keeps the distance it was priced on.
// Until this finishes, or if the database refuses it, fares use
// DEFAULT_FARE_SETTINGS, so booking never stops working because of it.
function ensureFareSchema() {
  db.query(
    `CREATE TABLE IF NOT EXISTS fare_settings (
       id TINYINT PRIMARY KEY,
       first_km_fare DECIMAL(8,2) NOT NULL,
       per_km_fare DECIMAL(8,2) NOT NULL,
       basis VARCHAR(255) NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     )`,
    (err) => {
      if (err) return console.warn('Could not create fare_settings:', err.message);
      db.query(
        `INSERT IGNORE INTO fare_settings (id, first_km_fare, per_km_fare, basis) VALUES (1, ?, ?, ?)`,
        [DEFAULT_FARE_SETTINGS.first_km_fare, DEFAULT_FARE_SETTINGS.per_km_fare, DEFAULT_FARE_SETTINGS.basis],
        (seedErr) => {
          if (seedErr) return console.warn('Could not seed fare_settings:', seedErr.message);
          loadFareSettings((loadErr) => {
            if (loadErr) console.warn('Could not load fare_settings:', loadErr.message);
          });
        }
      );
    }
  );

  db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND COLUMN_NAME = 'distance_km'`,
    (err, rows) => {
      if (err) return console.warn('Could not check rides.distance_km:', err.message);
      if (rows[0].c > 0) {
        distanceColumnReady = true;
        return;
      }
      db.query(`ALTER TABLE rides ADD COLUMN distance_km DECIMAL(6,2) NULL AFTER extra_km`, (alterErr) => {
        if (alterErr) return console.warn('Could not add rides.distance_km:', alterErr.message);
        distanceColumnReady = true;
      });
    }
  );
}

module.exports = {
  DEFAULT_FARE_SETTINGS,
  getFareSettings,
  computeFare,
  saveFareSettings,
  ensureFareSchema,
  hasDistanceColumn
};
