const db = require('./config/db');

// ACTUAL KM DRIVEN (panel recommendation, 2026-11-02). rides.distance_km is
// the ESTIMATE the fare is priced on (OSRM road route at booking, fastest
// car route). rides.actual_km is what the tricycle really travelled with the
// passenger on board: the driver's phone already sends its GPS every few
// seconds during a trip (PUT /rides/driver/location), and from Picked Up to
// Completed the distance between those points is added up here. The fare is
// never changed by it; it is for the record (history, admin, Activity Log).

// Whether rides.actual_km is known to exist. Until it is, nothing is added
// and nothing reads it, so a failed ALTER can never break a trip.
let actualKmColumnReady = false;

function hasActualKmColumn() {
  return actualKmColumnReady;
}

// Run once at startup. Additions only, skipped when the column is there.
function ensureActualKmColumn() {
  db.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND COLUMN_NAME = 'actual_km'`,
    (err, rows) => {
      if (err) return console.warn('Could not check rides.actual_km:', err.message);
      if (rows[0].c > 0) {
        actualKmColumnReady = true;
        return;
      }
      db.query(`ALTER TABLE rides ADD COLUMN actual_km DECIMAL(7,3) NULL`, (alterErr) => {
        if (alterErr) return console.warn('Could not add rides.actual_km:', alterErr.message);
        actualKmColumnReady = true;
      });
    }
  );
}

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Phone GPS wobbles even when standing still, and now and then jumps far
// away for one reading. So a step is only counted once the tricycle has
// moved at least MIN_STEP_KM from the last counted point, and a step that
// would mean driving faster than MAX_SPEED_KMH is treated as a GPS jump and
// skipped. A gap longer than MAX_GAP_S (phone asleep, no signal) starts
// counting again from the new point instead of drawing a straight line.
// TO CHANGE: MIN_STEP_KM (0.02 = 20 m), MAX_SPEED_KMH (80), MAX_GAP_S (120).
const MIN_STEP_KM = 0.02;
const MAX_SPEED_KMH = 80;
const MAX_GAP_S = 120;

// Last counted point per driver, in memory. After a server restart the
// first reading just becomes the new starting point (at most one step lost).
const lastPoint = new Map();

function recordDrivenDistance(accountId, lat, lng) {
  if (!actualKmColumnReady) return;
  const point = [Number(lat), Number(lng)];
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
  const now = Date.now();
  const prev = lastPoint.get(accountId);

  if (!prev || (now - prev.at) / 1000 > MAX_GAP_S) {
    lastPoint.set(accountId, { point, at: now });
    return;
  }
  const stepKm = haversineKm(prev.point, point);
  if (stepKm < MIN_STEP_KM) return; // still near the last point: wait
  const hours = (now - prev.at) / 3600000;
  lastPoint.set(accountId, { point, at: now });
  if (hours <= 0 || stepKm / hours > MAX_SPEED_KMH) return; // GPS jump

  // Every ride this driver has on board right now (a Shared trip moves all
  // its students together, so each of them gets the step).
  db.query(
    `UPDATE rides SET actual_km = COALESCE(actual_km, 0) + ?
     WHERE driver_account_id = ? AND status IN ('Picked Up', 'In Progress')`,
    [Math.round(stepKm * 1000) / 1000, accountId],
    (err) => { if (err) console.warn('Could not add driven distance:', err.message); }
  );
  if (lastPoint.size > 1000) lastPoint.clear();
}

module.exports = { ensureActualKmColumn, hasActualKmColumn, recordDrivenDistance };
