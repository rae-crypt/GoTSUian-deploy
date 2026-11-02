const db = require('./config/db');

// Ending a ride as Failed needs a reason (IT expert review, 2026-10-04): a
// driver could otherwise drop a passenger mid-trip and the ride would just
// disappear. The driver picks a reason and writes a short explanation; both
// are kept on the ride (rides.failed_reason / rides.failed_note, NULL for any
// other ride), the passenger is shown them, and the admin gets a Complaints
// entry to review (see updateRideStatus in rideController.js). The driver can
// also attach an optional photo afterwards (rides.failed_photo_path, see
// uploadFailedRidePhoto); only the admin can view it.

// Wording revised after the final defense (panel, 2026-11-02): "Passenger
// misbehaved" -> "Passenger misconduct" (the Code of Conduct term). Rides
// failed before that keep their old saved text.
// TO CHANGE: the reason names; keep FAILED_RIDE_REASONS in client/js/app.js
// and PASSENGER_REASONS below the same, or the server refuses the reason.
const FAILED_REASONS = [
  'Tricycle broke down',
  'Passenger asked to get off early',
  'Passenger misconduct',
  'Road blocked or unsafe',
  'Other'
];

// Reasons that point at the passenger: the admin's Complaints entry is then
// filed against them, so the admin can warn them if it holds up.
const PASSENGER_REASONS = ['Passenger asked to get off early', 'Passenger misconduct'];

// Whether both columns are known to exist. Until they are, a Failed ride
// still needs a reason and still reaches the admin; only storing it on the
// ride waits.
let failureColumnsReady = false;

function hasFailureColumns() {
  return failureColumnsReady;
}

// Run once at startup. Additions only, skipped for a column already there.
function ensureFailureColumns() {
  db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides'
       AND COLUMN_NAME IN ('failed_reason', 'failed_note', 'failed_photo_path')`,
    (err, rows) => {
      if (err) return console.warn('Could not check rides.failed_* columns:', err.message);
      const present = new Set(rows.map(r => r.name));
      const missing = [];
      if (!present.has('failed_reason')) missing.push('ADD COLUMN failed_reason VARCHAR(50) NULL DEFAULT NULL');
      if (!present.has('failed_note')) missing.push('ADD COLUMN failed_note VARCHAR(255) NULL DEFAULT NULL');
      if (!present.has('failed_photo_path')) missing.push('ADD COLUMN failed_photo_path VARCHAR(255) NULL DEFAULT NULL');
      if (!missing.length) {
        failureColumnsReady = true;
        return;
      }
      db.query(`ALTER TABLE rides ${missing.join(', ')}`, (alterErr) => {
        if (alterErr) return console.warn('Could not add rides.failed_* columns:', alterErr.message);
        failureColumnsReady = true;
      });
    }
  );
}

module.exports = { FAILED_REASONS, PASSENGER_REASONS, ensureFailureColumns, hasFailureColumns };
