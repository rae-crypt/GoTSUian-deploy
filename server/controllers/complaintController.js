const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { hasEvidenceColumn } = require('../complaintEvidence');
const { emitComplaintUpdated, emitComplaintFiled, emitViolationIssued, emitAccountSuspended, emitAvailabilityChanged, emitNewPendingRide } = require('../socket');
const { suspendAccount, getSuspension, SUSPENDED_MESSAGE } = require('../suspension');
const { hasFailureColumns } = require('../rideFailures');

// Categories mirror rules.html's Code of Conduct — passengers report the
// "For Drivers" violations, drivers report the "For Students / Passengers"
// ones, since each side can only actually witness the other's misconduct.
const CATEGORIES_AGAINST_DRIVER = ['Reckless driving', 'Overcharging', 'Rude behavior', 'Refused service', 'Unsafe vehicle', 'Cancelled without reason', 'Other'];
const CATEGORIES_AGAINST_PASSENGER = ['No-show', 'Rude behavior', 'Refused to pay', 'Fake booking', 'Other'];

// PASSENGER/DRIVER files a complaint, optionally against a specific person
// and/or tied to a specific ride. Resolving it later (see updateComplaintStatus
// / issueViolation) is entirely up to the admin.
// A photo as proof is REQUIRED (IT expert review, 2026-10-04: no sanction on
// "he said, she said"). It arrives in the same multipart request as the
// report (evidencePhotoUpload in complaintRoutes.js), so a report is never
// saved without its proof, and a rejected report never leaves a stray file.
exports.createComplaint = (req, res) => {
  const filed_by_account_id = req.user.accountId;
  const { against_account_id, ride_id, category, description } = req.body;
  const validCategories = req.user.role === 'driver' ? CATEGORIES_AGAINST_PASSENGER : CATEGORIES_AGAINST_DRIVER;
  const reject = (status, error) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(status).json({ error });
  };

  if (!category || !validCategories.includes(category)) {
    return reject(400, `Category must be one of: ${validCategories.join(', ')}`);
  }
  if (!description || !description.trim()) {
    return reject(400, 'A description is required.');
  }
  if (!req.file) {
    return reject(400, 'Attach a photo as proof (a screenshot or a photo of what happened).');
  }
  if (!hasEvidenceColumn()) {
    return reject(503, 'Reports cannot be saved yet. Please try again in a minute.');
  }

  const save = () => db.query(
    `INSERT INTO complaints (filed_by_account_id, against_account_id, ride_id, category, description, evidence_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [filed_by_account_id, against_account_id || null, ride_id || null, category, description.trim(),
     `uploads/complaints/${req.file.filename}`],
    (err, result) => {
      if (err) return reject(500, err.message);
      res.status(201).json({ message: 'Complaint submitted', complaintId: result.insertId });
      emitComplaintFiled();
    }
  );

  // A report about a ride: only by someone on that ride, and only until 24
  // hours after the ride ended (IT expert review, 2026-10-06). The same
  // window hides the button on both history pages (report_open).
  if (!ride_id) return save();
  db.query(
    `SELECT passenger_account_id, driver_account_id,
            (status NOT IN ('Completed', 'Cancelled', 'Failed', 'Declined')
               OR updated_at > NOW() - INTERVAL 24 HOUR) AS report_open
     FROM rides WHERE ride_id = ?`,
    [ride_id],
    (err, rows) => {
      if (err) return reject(500, err.message);
      const ride = rows[0];
      if (!ride) return reject(404, 'Ride not found.');
      const me = String(filed_by_account_id);
      if (me !== String(ride.passenger_account_id) && me !== String(ride.driver_account_id)) {
        return reject(403, 'You can only report a ride you were part of.');
      }
      if (!Number(ride.report_open)) {
        return reject(400, 'Reports for a ride can only be filed within 24 hours after it ends.');
      }
      save();
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
            c.created_at, c.against_account_id, c.ride_id,
            ${hasEvidenceColumn() ? 'c.evidence_path IS NOT NULL' : 'FALSE'} AS has_evidence,
            ${hasFailureColumns() ? 'r.failed_photo_path IS NOT NULL' : 'FALSE'} AS has_failed_photo,
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

// REPORTER attaches an optional photo to a report they just filed (sent
// separately, after the report, so filing never waits on an upload). Only
// the person who filed it; a new photo replaces the old one.
exports.uploadComplaintEvidence = (req, res) => {
  const { complaintId } = req.params;
  const discard = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  if (!req.file) return res.status(400).json({ error: 'Choose a photo to attach.' });
  if (!hasEvidenceColumn()) {
    discard();
    return res.status(503).json({ error: 'Photos cannot be saved yet. Please try again in a minute.' });
  }

  db.query(`SELECT filed_by_account_id, evidence_path FROM complaints WHERE complaint_id = ?`, [complaintId], (err, rows) => {
    if (err) { discard(); return res.status(500).json({ error: err.message }); }
    const complaint = rows[0];
    if (!complaint || String(complaint.filed_by_account_id) !== String(req.user.accountId)) {
      discard();
      return res.status(403).json({ error: 'You can only add a photo to your own report.' });
    }
    const relativePath = `uploads/complaints/${req.file.filename}`;
    db.query(`UPDATE complaints SET evidence_path = ? WHERE complaint_id = ?`, [relativePath, complaintId], (err2) => {
      if (err2) { discard(); return res.status(500).json({ error: err2.message }); }
      if (complaint.evidence_path) fs.unlink(path.join(__dirname, '..', complaint.evidence_path), () => {});
      res.status(200).json({ message: 'Photo attached' });
    });
  });
};

// ADMIN — the photo attached to a report.
exports.getComplaintEvidence = (req, res) => {
  const { complaintId } = req.params;
  if (!hasEvidenceColumn()) return res.status(404).json({ error: 'No photo for this report' });

  db.query(`SELECT evidence_path FROM complaints WHERE complaint_id = ?`, [complaintId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length || !rows[0].evidence_path) return res.status(404).json({ error: 'No photo for this report' });
    const filePath = path.join(__dirname, '..', rows[0].evidence_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'The photo is missing from the server' });
    res.sendFile(filePath);
  });
};

// ADMIN — a ride's in-app chat, read-only, to check a report against what
// the passenger and driver actually wrote to each other. Disclosed in the
// Privacy Policy (rules.html#privacy).
exports.getRideChatForAdmin = (req, res) => {
  const { rideId } = req.params;
  db.query(
    `SELECT m.message, m.created_at,
            CASE WHEN m.sender_account_id = r.driver_account_id THEN 'Driver' ELSE 'Passenger' END AS sender_role,
            COALESCE(CONCAT(s.first_name, ' ', s.last_name), CONCAT(td.first_name, ' ', td.last_name)) AS sender_name
     FROM messages m
     JOIN rides r ON r.ride_id = m.ride_id
     LEFT JOIN student s ON s.account_id = m.sender_account_id
     LEFT JOIN tricycle_driver td ON td.account_id = m.sender_account_id
     WHERE m.ride_id = ?
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [rideId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ messages: rows });
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

      const responseBody = { message, escalated, finalSeverity: severity, suspended: false };
      emitViolationIssued(account_id);

      // A Violation suspends the account straight away (see suspension.js).
      const afterSuspension = (next) => {
        if (severity !== 'Violation') return next();
        suspendAccount(account_id, reason, (suspErr, suspended) => {
          if (suspErr) console.warn('Could not suspend account', account_id, suspErr.message);
          if (!suspended) return next();
          responseBody.suspended = true;
          responseBody.message += ' — account suspended';
          emitAccountSuspended(account_id, SUSPENDED_MESSAGE);
          emitAvailabilityChanged();
          emitNewPendingRide();
          // Tells the admin page which list to open for "Lift suspension".
          db.query(`SELECT role FROM user_account WHERE account_id = ?`, [account_id], (roleErr, rows) => {
            responseBody.role = !roleErr && rows[0] ? (rows[0].role === 'driver' ? 'driver' : 'passenger') : null;
            next();
          });
        });
      };

      afterSuspension(() => {
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
      });
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

  // An account that's already suspended is at the top of the ladder; the
  // admin lifts the suspension first (the Complaints list can still show
  // an Issue Warning button for it, so this is checked here too).
  getSuspension(account_id, (suspErr, suspension) => {
    if (!suspErr && suspension) {
      return res.status(409).json({ error: 'This account is already suspended. Lift the suspension first if you need to issue another warning.' });
    }
    issueOnActiveAccount();
  });

  function issueOnActiveAccount() {
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
  }
};
