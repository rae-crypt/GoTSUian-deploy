const db = require('./config/db');

// "Book for someone else": a passenger can set a pickup away from their own
// location (picked from the place search) for another person, such as their
// child at school. That person's name and phone number are kept on the ride
// so the driver knows who to pick up and can call them first:
// rides.booked_for_name / rides.booked_for_contact, both NULL for an
// ordinary booking. The account holder still owns the ride (payment,
// cancelling, chat, reports).

// Whether both columns are known to exist. Until they are, rides are saved
// and listed without them, so a failed ALTER never breaks booking.
let bookedForReady = false;

function hasBookedForColumns() {
  return bookedForReady;
}

// Run once at startup. Additions only, skipped for a column already there.
function ensureBookedForColumns() {
  db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides'
       AND COLUMN_NAME IN ('booked_for_name', 'booked_for_contact')`,
    (err, rows) => {
      if (err) return console.warn('Could not check rides.booked_for_* columns:', err.message);
      const present = new Set(rows.map(r => r.name));
      const missing = [];
      if (!present.has('booked_for_name')) missing.push('ADD COLUMN booked_for_name VARCHAR(100) NULL DEFAULT NULL');
      if (!present.has('booked_for_contact')) missing.push('ADD COLUMN booked_for_contact VARCHAR(15) NULL DEFAULT NULL');
      if (!missing.length) {
        bookedForReady = true;
        return;
      }
      db.query(`ALTER TABLE rides ${missing.join(', ')}`, (alterErr) => {
        if (alterErr) return console.warn('Could not add rides.booked_for_* columns:', alterErr.message);
        bookedForReady = true;
      });
    }
  );
}

module.exports = { ensureBookedForColumns, hasBookedForColumns };
