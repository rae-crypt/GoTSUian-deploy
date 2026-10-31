const db = require('./config/db');

// ACTIVITY LOG (audit log, 2026-11-01) — one row per thing a passenger,
// driver or the admin did, shown to the admin as plain sentences ("Jane Doe
// booked a ride from ... to ..."). The admin is not techy, so each row keeps
// a ready-to-read sentence instead of codes; the IP address and browser are
// kept too but never shown.
//
// Never saved here: passwords, OTP codes, chat message text, GPS location
// pings, place searches. Rows are only ever added: there is no edit or
// delete anywhere in the system, so the log can be trusted.
//
// Logging must never get in the way: every function here swallows its own
// errors (a console warning only), and the real action has already been
// answered before anything is logged.

// Whether activity_log is known to exist. Until it is, logging is skipped
// and the admin's list comes back empty instead of failing.
let activityTableReady = false;

function hasActivityTable() {
  return activityTableReady;
}

// Run once at startup. Additions only, skipped when the table is already
// there. No foreign keys on purpose: a log row should outlive the account
// or ride it talks about.
function ensureActivityLogTable() {
  db.query(
    `CREATE TABLE IF NOT EXISTS activity_log (
       log_id INT AUTO_INCREMENT PRIMARY KEY,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       actor_role ENUM('passenger', 'driver', 'admin', 'unknown') NOT NULL,
       actor_account_id INT NULL,
       actor_admin_id INT NULL,
       actor_name VARCHAR(150) NOT NULL,
       action VARCHAR(40) NOT NULL,
       message VARCHAR(500) NOT NULL,
       icon VARCHAR(10) NOT NULL DEFAULT 'person',
       needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
       ride_id INT NULL,
       link_type VARCHAR(20) NULL,
       ip_address VARCHAR(64) NULL,
       user_agent VARCHAR(255) NULL,
       INDEX idx_activity_created (created_at),
       INDEX idx_activity_role (actor_role)
     )`,
    (err) => {
      if (err) return console.warn('Could not create activity_log:', err.message);
      activityTableReady = true;
    }
  );
}

// A passenger's or driver's full name, or null.
function accountName(accountId, cb) {
  if (!accountId) return cb(null);
  db.query(
    `SELECT COALESCE(CONCAT(s.first_name, ' ', s.last_name), CONCAT(td.first_name, ' ', td.last_name)) AS name
     FROM user_account ua
     LEFT JOIN student s ON s.account_id = ua.account_id
     LEFT JOIN tricycle_driver td ON td.account_id = ua.account_id
     WHERE ua.account_id = ?`,
    [accountId],
    (err, rows) => cb(!err && rows[0] ? rows[0].name : null)
  );
}

// Who and where of a ride, for sentences like "accepted Jane Doe's ride".
function rideDetails(rideId, cb) {
  if (!rideId) return cb(null);
  db.query(
    `SELECT r.ride_id, r.pickup_location, r.dropoff_location, r.fare, r.ride_type, r.pool_id,
            CONCAT(s.first_name, ' ', s.last_name) AS passenger,
            CONCAT(td.first_name, ' ', td.last_name) AS driver
     FROM rides r
     LEFT JOIN student s ON s.account_id = r.passenger_account_id
     LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
     WHERE r.ride_id = ?`,
    [rideId],
    (err, rows) => cb(!err && rows[0] ? rows[0] : null)
  );
}

// "TSU San Isidro main gate" stays as is; a long typed address is cut so
// one entry never fills the admin's whole screen.
// TO CHANGE: how many letters of a place name are shown.
const PLACE_MAX_LENGTH = 60;
function place(text) {
  const s = String(text || '').trim();
  return s.length > PLACE_MAX_LENGTH ? `${s.slice(0, PLACE_MAX_LENGTH - 1)}…` : s;
}

function peso(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? `₱${Number.isInteger(n) ? n : n.toFixed(2)}` : '';
}

// Saves one entry. `entry`:
//   role      'passenger' | 'driver' | 'admin' | 'unknown' (failed logins)
//   accountId passenger/driver account (their name is looked up)
//   adminId   admin who did it (always shown as "Admin")
//   name      shown name, when it is already known (skips the lookup)
//   action    short code for counting/filtering, e.g. 'ride_booked'
//   text      the sentence after the name, or (c) => sentence when it needs
//             looked-up details: c.passenger / c.driver / c.pickup_location
//             / c.dropoff_location / c.fare (from rideId) and c.subject (the
//             name of subjectAccountId)
//   icon      'ride' | 'star' | 'person' | 'alert' | 'gear'
//   attention true = pink row under "Needs attention"
//   rideId    ride it is about (optional)
//   subjectAccountId  the person it was done TO, e.g. the driver the admin
//             approved (optional)
//   link      'complaint' | 'driver' = a button that opens that admin panel
function logActivity(req, entry) {
  if (!activityTableReady) return;
  try {
    const role = entry.role === 'student' ? 'passenger' : entry.role;
    const finish = (name, ctx) => {
      let text = typeof entry.text === 'function' ? entry.text(ctx) : entry.text;
      if (!text) return;
      text = String(text).slice(0, 500);
      const ip = req ? String(req.ip || '').slice(0, 64) : null;
      const agent = req && req.get ? String(req.get('user-agent') || '').slice(0, 255) : null;
      db.query(
        `INSERT INTO activity_log (actor_role, actor_account_id, actor_admin_id, actor_name, action, message, icon, needs_attention, ride_id, link_type, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [role, entry.accountId || null, entry.adminId || null, String(name || 'Someone').slice(0, 150),
         entry.action, text, entry.icon || 'person', Boolean(entry.attention), entry.rideId || null,
         entry.link || null, ip || null, agent || null],
        (err) => { if (err) console.warn('Could not save activity log entry:', err.message); }
      );
    };
    const withName = (cb) => {
      if (entry.name) return cb(entry.name);
      if (role === 'admin') return cb('Admin');
      if (role === 'unknown') return cb('Someone');
      accountName(entry.accountId, (name) => cb(name || (role === 'driver' ? 'A driver' : 'A passenger')));
    };
    withName((name) => {
      if (typeof entry.text !== 'function') return finish(name, {});
      rideDetails(entry.rideId, (ride) => {
        accountName(entry.subjectAccountId, (subject) => {
          finish(name, {
            ...(ride || {}),
            passenger: (ride && ride.passenger) || 'a passenger',
            driver: (ride && ride.driver) || 'a driver',
            subject: subject || 'an account'
          });
        });
      });
    });
  } catch (error) {
    console.warn('Could not save activity log entry:', error.message);
  }
}

// Wrong-password tries per account (or per unknown username), last 15
// minutes, kept in memory only. A restart starts the count again, which is
// fine: it only decides when an entry turns pink.
// TO CHANGE: FAILED_LOGIN_ALERT_AT = how many tries before it needs attention.
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_ALERT_AT = 3;
const failedLogins = new Map();

function countFailedLogin(key) {
  const now = Date.now();
  const tries = (failedLogins.get(key) || []).filter((t) => now - t <= FAILED_LOGIN_WINDOW_MS);
  tries.push(now);
  failedLogins.set(key, tries);
  if (failedLogins.size > 1000) failedLogins.clear();
  return tries.length;
}

function ordinal(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

// A wrong password. `who` is the account's owner name when the account
// exists ("on Jane Doe's account"), or null for a username that isn't
// registered. What was typed is never saved.
function logFailedLogin(req, { kind, who, key }) {
  const tries = countFailedLogin(`${kind}:${String(key || '').toLowerCase()}`);
  const target = kind === 'admin' ? 'the admin account'
    : who ? `${who}'s account` : `a ${kind} account that doesn't exist`;
  logActivity(req, {
    role: 'unknown',
    action: 'login_failed',
    icon: 'alert',
    attention: tries >= FAILED_LOGIN_ALERT_AT,
    text: `typed the wrong password on ${target}${tries > 1 ? ` (${ordinal(tries)} try in 15 minutes)` : ''}.`
  });
}

// ADMIN'S LIST — newest first, LIST_PAGE_SIZE at a time ("Show older
// activity" passes the last log_id it has as `before`).
// TO CHANGE: LIST_PAGE_SIZE = how many entries load at once.
const LIST_PAGE_SIZE = 50;

function listActivity({ who, q, before, since }, cb) {
  if (!activityTableReady) return cb(null, { entries: [], hasMore: false, summary: null });

  const where = [];
  const params = [];
  if (['passenger', 'driver', 'admin'].includes(who)) {
    where.push('actor_role = ?');
    params.push(who);
  } else if (who === 'attention') {
    where.push('needs_attention = TRUE');
  }
  const search = String(q || '').trim().slice(0, 100);
  if (search) {
    where.push('(actor_name LIKE ? OR message LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (Number(before) > 0) {
    where.push('log_id < ?');
    params.push(Number(before));
  }

  db.query(
    `SELECT log_id, created_at, actor_role, actor_name, action, message, icon, needs_attention, link_type
     FROM activity_log
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY log_id DESC
     LIMIT ?`,
    [...params, LIST_PAGE_SIZE + 1],
    (err, rows) => {
      if (err) return cb(err);
      const hasMore = rows.length > LIST_PAGE_SIZE;
      const entries = rows.slice(0, LIST_PAGE_SIZE).map((r) => ({
        ...r,
        needs_attention: Boolean(r.needs_attention)
      }));

      // The 4 numbers at the top, for "today" as the admin's own browser
      // counts it (`since` = their local midnight). Only on the first page.
      const sinceDate = since ? new Date(since) : null;
      if (Number(before) > 0 || !sinceDate || Number.isNaN(sinceDate.getTime())) {
        return cb(null, { entries, hasMore, summary: null });
      }
      db.query(
        `SELECT
           SUM(action = 'ride_booked') AS booked,
           SUM(action = 'ride_completed') AS finished,
           SUM(action = 'ride_cancelled') AS cancelled,
           SUM(needs_attention) AS attention
         FROM activity_log WHERE created_at >= ?`,
        [sinceDate],
        (err2, sumRows) => {
          const s = !err2 && sumRows[0] ? sumRows[0] : {};
          cb(null, {
            entries,
            hasMore,
            summary: {
              booked: Number(s.booked) || 0,
              finished: Number(s.finished) || 0,
              cancelled: Number(s.cancelled) || 0,
              attention: Number(s.attention) || 0
            }
          });
        }
      );
    }
  );
}

module.exports = {
  ensureActivityLogTable,
  hasActivityTable,
  logActivity,
  logFailedLogin,
  listActivity,
  place,
  peso
};
