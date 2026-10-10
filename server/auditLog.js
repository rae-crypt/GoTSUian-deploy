const db = require('./config/db');

// Audit log (2026-10-10). One row per security-relevant action: logins
// (including failed and refused ones), registrations, password changes, and
// every admin decision (driver approval, password reset, fare change,
// complaint status, warning/violation, suspension lift, loyalty grant). The
// admin reads it in the Activity log panel.
//
// Passwords, temporary passwords and OTP codes are never written here.
//
// Writing a row is fire-and-forget: a failed insert is only warned about, so
// logging can never block or break the login or action it describes.

// Whether audit_log is known to exist. Until it is, logAudit does nothing
// and the admin list comes back empty, so a failed CREATE can't break logins.
let auditTableReady = false;

// Run once at startup. Additions only, skipped when the table is already there.
// account_id is the passenger/driver (user_account); admin_id is the admin
// (administrator, a separate table). Both are empty for a failed login on a
// username that doesn't exist; `username` keeps what was typed.
function ensureAuditLogTable() {
  db.query(
    `CREATE TABLE IF NOT EXISTS audit_log (
       log_id INT AUTO_INCREMENT PRIMARY KEY,
       account_id INT NULL,
       admin_id INT NULL,
       role VARCHAR(20) NULL,
       username VARCHAR(150) NULL,
       action VARCHAR(50) NOT NULL,
       target_type VARCHAR(30) NULL,
       target_id INT NULL,
       details VARCHAR(255) NULL,
       ip_address VARCHAR(45) NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_audit_created (created_at),
       FOREIGN KEY (account_id) REFERENCES user_account(account_id) ON DELETE SET NULL,
       FOREIGN KEY (admin_id) REFERENCES administrator(admin_id) ON DELETE SET NULL
     )`,
    (err) => {
      if (err) return console.warn('Could not create audit_log:', err.message);
      auditTableReady = true;
    }
  );
}

function hasAuditTable() {
  return auditTableReady;
}

// The logged-in person behind a request (from the JWT), for actions taken
// while signed in.
function actorFromRequest(req) {
  const user = (req && req.user) || {};
  return {
    accountId: user.accountId || null,
    adminId: user.adminId || null,
    role: user.role || null
  };
}

function logAudit(req, entry) {
  if (!auditTableReady) return;
  const {
    accountId = null, adminId = null, role = null, username = null,
    action, targetType = null, targetId = null, details = null
  } = entry;
  const ip = req && req.ip ? String(req.ip).slice(0, 45) : null;

  db.query(
    `INSERT INTO audit_log (account_id, admin_id, role, username, action, target_type, target_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      accountId, adminId, role,
      username ? String(username).slice(0, 150) : null,
      action, targetType, targetId,
      details ? String(details).slice(0, 255) : null,
      ip
    ],
    (err) => {
      if (err) console.warn('Could not write audit log:', err.message);
    }
  );
}

module.exports = { ensureAuditLogTable, hasAuditTable, actorFromRequest, logAudit };
