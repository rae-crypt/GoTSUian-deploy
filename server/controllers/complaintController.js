const db = require('../config/db');
const { emitComplaintUpdated, emitViolationIssued } = require('../socket');

// Categories mirror rules.html's Code of Conduct — passengers report the
// "For Drivers" violations, drivers report the "For Students / Passengers"
// ones, since each side can only actually witness the other's misconduct.
const CATEGORIES_AGAINST_DRIVER = ['Reckless driving', 'Overcharging', 'Rude behavior', 'Refused service', 'Unsafe vehicle', 'Cancelled without reason', 'Other'];
const CATEGORIES_AGAINST_PASSENGER = ['No-show', 'Rude behavior', 'Refused to pay', 'Fake booking', 'Misuse of Shared ride', 'Other'];

// PASSENGER/DRIVER files a complaint, optionally against a specific person
// and/or tied to a specific ride. Resolving it later (see updateComplaintStatus
// / issueViolation) is entirely up to the admin.
exports.createComplaint = (req, res) => {
  const filed_by_account_id = req.user.accountId;
  const { against_account_id, ride_id, category, description } = req.body;
  const validCategories = req.user.role === 'driver' ? CATEGORIES_AGAINST_PASSENGER : CATEGORIES_AGAINST_DRIVER;

  if (!category || !validCategories.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'A description is required.' });
  }

  db.query(
    `INSERT INTO complaints (filed_by_account_id, against_account_id, ride_id, category, description)
     VALUES (?, ?, ?, ?, ?)`,
    [filed_by_account_id, against_account_id || null, ride_id || null, category, description.trim()],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Complaint submitted' });
    }
  );
};

// The filer's own complaints, newest first, with the target's name (if any)
// so they can see who/what they reported.
exports.getMyComplaints = (req, res) => {
  const filed_by_account_id = req.user.accountId;

  db.query(
    `SELECT c.complaint_id, c.category, c.description, c.status, c.admin_notes,
            c.ride_id, c.created_at,
            COALESCE(
              CONCAT(s.first_name, ' ', s.last_name),
              CONCAT(td.first_name, ' ', td.last_name)
            ) AS against_name
     FROM complaints c
     LEFT JOIN student s ON s.account_id = c.against_account_id
     LEFT JOIN tricycle_driver td ON td.account_id = c.against_account_id
     WHERE c.filed_by_account_id = ?
     ORDER BY c.created_at DESC`,
    [filed_by_account_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ complaints: rows });
    }
  );
};

// A driver/passenger's own warning/violation history, for their Profile page.
exports.getMyViolations = (req, res) => {
  const account_id = req.user.accountId;

  db.query(
    `SELECT violation_id, severity, reason, escalated, created_at
     FROM violations
     WHERE account_id = ?
     ORDER BY created_at DESC`,
    [account_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ violations: rows, count: rows.length });
    }
  );
};

// ADMIN — every complaint filed, with both parties' names and the ride route.
exports.listComplaints = (req, res) => {
  db.query(
    `SELECT c.complaint_id, c.category, c.description, c.status, c.admin_notes,
            c.created_at, c.against_account_id,
            COALESCE(CONCAT(fs.first_name, ' ', fs.last_name), CONCAT(ftd.first_name, ' ', ftd.last_name)) AS filed_by_name,
            COALESCE(CONCAT(as_.first_name, ' ', as_.last_name), CONCAT(atd.first_name, ' ', atd.last_name)) AS against_name,
            r.pickup_location, r.dropoff_location
     FROM complaints c
     LEFT JOIN student fs ON fs.account_id = c.filed_by_account_id
     LEFT JOIN tricycle_driver ftd ON ftd.account_id = c.filed_by_account_id
     LEFT JOIN student as_ ON as_.account_id = c.against_account_id
     LEFT JOIN tricycle_driver atd ON atd.account_id = c.against_account_id
     LEFT JOIN rides r ON r.ride_id = c.ride_id
     ORDER BY FIELD(c.status, 'Pending', 'Reviewed', 'Resolved'), c.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ complaints: rows });
    }
  );
};

// ADMIN — mark a complaint Reviewed/Resolved and optionally leave notes.
exports.updateComplaintStatus = (req, res) => {
  const { complaintId } = req.params;
  const { status, admin_notes } = req.body;

  if (!['Pending', 'Reviewed', 'Resolved'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Pending, Reviewed, or Resolved.' });
  }

  db.query(
    `UPDATE complaints SET status = ?, admin_notes = ?, resolved_by_admin_id = ? WHERE complaint_id = ?`,
    [status, admin_notes || null, status === 'Resolved' ? req.user.adminId : null, complaintId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Complaint not found' });
      res.status(200).json({ message: `Complaint marked as ${status}` });

      db.query(`SELECT filed_by_account_id FROM complaints WHERE complaint_id = ?`, [complaintId], (err2, rows) => {
        if (!err2 && rows[0]) emitComplaintUpdated(rows[0].filed_by_account_id);
      });
    }
  );
};

// Shared insert used by both the direct-Violation path and the
// possibly-escalated-Warning path below — also resolves the linked
// complaint (if any) the same way for both.
function insertViolationRow(res, { account_id, issued_by_admin_id, complaint_id, severity, reason, escalated, message }) {
  db.query(
    `INSERT INTO violations (account_id, issued_by_admin_id, complaint_id, severity, reason, escalated)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [account_id, issued_by_admin_id, complaint_id || null, severity, reason, escalated],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const responseBody = { message, escalated, finalSeverity: severity };
      emitViolationIssued(account_id);

      if (!complaint_id) {
        return res.status(201).json(responseBody);
      }

      db.query(
        `UPDATE complaints SET status = 'Resolved', resolved_by_admin_id = ? WHERE complaint_id = ?`,
        [issued_by_admin_id, complaint_id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          responseBody.message += ' and complaint resolved';
          res.status(201).json(responseBody);

          db.query(`SELECT filed_by_account_id FROM complaints WHERE complaint_id = ?`, [complaint_id], (err3, rows) => {
            if (!err3 && rows[0]) emitComplaintUpdated(rows[0].filed_by_account_id);
          });
        }
      );
    }
  );
}

// ADMIN — issue a warning or violation against an account. `complaint_id` is
// optional: an admin can issue one standalone (e.g. a pattern they noticed),
// or tied to a specific complaint, which also marks that complaint Resolved.
// A Warning auto-escalates to a Violation if the account already has a prior
// Warning on record — repeat offenses (of any kind) are treated as serious,
// matching the Code of Conduct's stated policy.
exports.issueViolation = (req, res) => {
  const { account_id, severity, reason, complaint_id } = req.body;
  const issued_by_admin_id = req.user.adminId;

  if (!account_id) return res.status(400).json({ error: 'An account to issue this against is required.' });
  if (!['Warning', 'Violation'].includes(severity)) {
    return res.status(400).json({ error: 'Severity must be "Warning" or "Violation".' });
  }
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'A reason is required.' });
  const trimmedReason = reason.trim();

  if (severity === 'Violation') {
    return insertViolationRow(res, {
      account_id, issued_by_admin_id, complaint_id, severity: 'Violation',
      reason: trimmedReason, escalated: false, message: 'Violation issued'
    });
  }

  db.query(
    `SELECT COUNT(*) AS c FROM violations WHERE account_id = ? AND severity = 'Warning'`,
    [account_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const priorWarnings = rows[0].c;

      if (priorWarnings >= 1) {
        return insertViolationRow(res, {
          account_id, issued_by_admin_id, complaint_id, severity: 'Violation',
          reason: trimmedReason, escalated: true,
          message: 'This is their 2nd warning — automatically escalated to a Violation'
        });
      }

      insertViolationRow(res, {
        account_id, issued_by_admin_id, complaint_id, severity: 'Warning',
        reason: trimmedReason, escalated: false, message: 'Warning issued'
      });
    }
  );
};
