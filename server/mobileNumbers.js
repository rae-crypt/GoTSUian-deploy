const db = require('./config/db');

// One mobile number = one GoTSUian account, across passengers AND drivers.
// A number is checked against passengers' numbers, drivers' numbers and
// driver logins (a driver logs in with their number). Without this a fake
// account could reuse a real driver's or passenger's number, and the Call
// button would ring the wrong person.
//
// exceptAccountId skips the caller's own account (a passenger re-saving
// their profile with the number they already have). Resolves false if the
// check itself fails, the same fail-open choice as the old passenger check.
function isMobileTaken(mobile, exceptAccountId = 0) {
  return new Promise((resolve) => {
    db.query(
      `SELECT 1 FROM student WHERE contact_number = ? AND account_id <> ?
       UNION ALL
       SELECT 1 FROM tricycle_driver WHERE contact_number = ? AND account_id <> ?
       UNION ALL
       SELECT 1 FROM user_account WHERE username = ? AND account_id <> ?
       LIMIT 1`,
      [mobile, exceptAccountId, mobile, exceptAccountId, mobile, exceptAccountId],
      (err, rows) => resolve(!err && rows.length > 0)
    );
  });
}

const MOBILE_TAKEN_MESSAGE = 'This mobile number is already registered to another account.';

module.exports = { isMobileTaken, MOBILE_TAKEN_MESSAGE };
