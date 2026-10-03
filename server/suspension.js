const db = require('./config/db');

// Account suspension: a passenger or driver who gets a Violation (issued
// directly, or a 2nd Warning auto-escalated, see complaintController.js) is
// suspended on the spot. While suspended they can't log in, every API call
// with their old token is refused (see authMiddleware.js), and any open tab
// is logged out. Only the admin can lift it.
//
// user_account.suspended_at (NULL = not suspended) and
// user_account.suspension_reason (the Violation's reason).

const SUSPENDED_MESSAGE = 'Your account has been suspended because of a violation of the GoTSUian Code of Conduct. Please contact the TODA admin.';

// Whether both columns are known to exist. Until they are, nobody counts as
// suspended, so a failed ALTER never locks anyone out or breaks a request.
let suspensionReady = false;

function hasSuspensionColumns() {
  return suspensionReady;
}

// Run once at startup. Additions only, skipped for a column already there.
function ensureSuspensionColumns() {
  db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_account'
       AND COLUMN_NAME IN ('suspended_at', 'suspension_reason')`,
    (err, rows) => {
      if (err) return console.warn('Could not check user_account suspension columns:', err.message);
      const present = new Set(rows.map(r => r.name));
      const missing = [];
      if (!present.has('suspended_at')) missing.push('ADD COLUMN suspended_at DATETIME NULL DEFAULT NULL');
      if (!present.has('suspension_reason')) missing.push('ADD COLUMN suspension_reason VARCHAR(255) NULL DEFAULT NULL');
      if (!missing.length) {
        suspensionReady = true;
        return;
      }
      db.query(`ALTER TABLE user_account ${missing.join(', ')}`, (alterErr) => {
        if (alterErr) return console.warn('Could not add user_account suspension columns:', alterErr.message);
        suspensionReady = true;
      });
    }
  );
}

// cb(err, { suspended_at, suspension_reason } | null)
function getSuspension(accountId, cb) {
  if (!suspensionReady || !accountId) return cb(null, null);
  db.query(
    `SELECT suspended_at, suspension_reason FROM user_account WHERE account_id = ? AND suspended_at IS NOT NULL`,
    [accountId],
    (err, rows) => cb(err, rows && rows[0] ? rows[0] : null)
  );
}

// Every suspended account, as a Map of account_id -> { suspended_at, suspension_reason },
// for the admin's passenger/driver lists.
function getSuspensionMap(cb) {
  if (!suspensionReady) return cb(null, new Map());
  db.query(
    `SELECT account_id, suspended_at, suspension_reason FROM user_account WHERE suspended_at IS NOT NULL`,
    (err, rows) => {
      if (err) return cb(err, new Map());
      cb(null, new Map(rows.map(r => [String(r.account_id), r])));
    }
  );
}

// Suspends the account, takes it offline and cancels any ride request it
// still has waiting for a driver (a ride already accepted or under way is
// left alone, so nobody is stranded mid-trip). cb(err, suspended:boolean)
function suspendAccount(accountId, reason, cb) {
  if (!suspensionReady) return cb(null, false);
  db.query(
    `UPDATE user_account SET suspended_at = NOW(), suspension_reason = ? WHERE account_id = ?`,
    [(reason || '').slice(0, 255), accountId],
    (err, result) => {
      if (err) return cb(err, false);
      if (!result.affectedRows) return cb(null, false);
      db.query(`UPDATE student SET is_online = FALSE WHERE account_id = ?`, [accountId], () => {});
      db.query(`UPDATE tricycle_driver SET is_online = FALSE WHERE account_id = ?`, [accountId], () => {});
      db.query(
        `UPDATE rides SET status = 'Cancelled' WHERE passenger_account_id = ? AND status = 'Pending'`,
        [accountId],
        () => cb(null, true)
      );
    }
  );
}

// Admin lifts a suspension. Past warnings/violations stay on record, so the
// next Violation suspends them again. cb(err, lifted:boolean)
function liftSuspension(accountId, cb) {
  if (!suspensionReady) return cb(null, false);
  db.query(
    `UPDATE user_account SET suspended_at = NULL, suspension_reason = NULL WHERE account_id = ? AND suspended_at IS NOT NULL`,
    [accountId],
    (err, result) => cb(err, Boolean(result && result.affectedRows))
  );
}

module.exports = {
  SUSPENDED_MESSAGE,
  ensureSuspensionColumns,
  hasSuspensionColumns,
  getSuspension,
  getSuspensionMap,
  suspendAccount,
  liftSuspension
};
