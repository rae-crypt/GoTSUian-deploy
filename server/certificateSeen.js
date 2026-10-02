const db = require('./config/db');

// The "You earned a loyalty certificate!" popup used to remember that it had
// been shown only in the browser's localStorage, which some browsers wipe
// on close (private tabs, privacy browsers, in-app browsers), so it popped
// up again on every visit. loyalty_certificates.seen_at records it on the
// server instead: NULL until the owner has seen the popup for that
// certificate.

// Whether loyalty_certificates.seen_at is known to exist. Until it is, the
// loyalty endpoints leave it out and the browser falls back to localStorage,
// so a failed ALTER never breaks the loyalty card.
let seenColumnReady = false;

function hasCertificateSeenColumn() {
  return seenColumnReady;
}

// Run once at startup. Additions only, skipped when the column is already there.
function ensureCertificateSeenColumn() {
  db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loyalty_certificates' AND COLUMN_NAME = 'seen_at'`,
    (err, rows) => {
      if (err) return console.warn('Could not check loyalty_certificates.seen_at:', err.message);
      if (rows[0].c > 0) {
        seenColumnReady = true;
        return;
      }
      db.query(`ALTER TABLE loyalty_certificates ADD COLUMN seen_at TIMESTAMP NULL DEFAULT NULL AFTER granted_at`, (alterErr) => {
        if (alterErr) return console.warn('Could not add loyalty_certificates.seen_at:', alterErr.message);
        seenColumnReady = true;
      });
    }
  );
}

module.exports = { ensureCertificateSeenColumn, hasCertificateSeenColumn };
