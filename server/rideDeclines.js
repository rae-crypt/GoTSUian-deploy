const db = require('./config/db');

// A driver's Decline used to set the whole ride to 'Declined', which took it
// away from every other driver and told the passenger it was declined.
// Declining now means "not me": one row here per driver per ride, the ride
// stays Pending, and it only leaves that driver's list.

// Whether ride_declines is known to exist. Until it is, the pending list
// skips the "not declined by me" filter and the decline endpoint refuses,
// so a failed CREATE can never break the pending list itself.
let declinesTableReady = false;

function hasDeclinesTable() {
  return declinesTableReady;
}

// Run once at startup. Additions only, skipped when the table is already there.
function ensureRideDeclinesTable() {
  db.query(
    `CREATE TABLE IF NOT EXISTS ride_declines (
       ride_id INT NOT NULL,
       driver_account_id INT NOT NULL,
       declined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (ride_id, driver_account_id),
       FOREIGN KEY (ride_id) REFERENCES rides(ride_id) ON DELETE CASCADE,
       FOREIGN KEY (driver_account_id) REFERENCES user_account(account_id) ON DELETE CASCADE
     )`,
    (err) => {
      if (err) return console.warn('Could not create ride_declines:', err.message);
      declinesTableReady = true;
    }
  );
}

module.exports = { ensureRideDeclinesTable, hasDeclinesTable };
