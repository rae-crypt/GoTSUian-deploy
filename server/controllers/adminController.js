const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { emitDriverAccountStatus } = require('../socket');

// Excludes visually-ambiguous characters (0/O, 1/l/I) since this gets read
// aloud or copied over a phone call, not typed by the person who generated it.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generateTempPassword(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[crypto.randomInt(TEMP_PASSWORD_CHARS.length)];
  }
  return out;
}

// LIST ALL DRIVERS — the admin dashboard's driver management table shows
// every driver (not just pending ones) so the admin can also review
// already-approved or rejected accounts, not only act on new ones.
exports.listDrivers = (req, res) => {
  const sql = `
    SELECT driver_id, account_id, first_name, last_name, driver_license_no,
           contact_number, account_status,
           license_document_path IS NOT NULL AS has_license_file
    FROM tricycle_driver
    ORDER BY FIELD(account_status, 'Pending', 'Active', 'Rejected'), driver_id DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ drivers: rows });
  });
};

// SERVE A DRIVER'S LICENSE DOCUMENT — admin-only (mounted behind
// authMiddleware + requireAdmin in adminRoutes.js), since this is a
// government ID and must never be reachable as a public static file.
exports.getDriverLicenseFile = (req, res) => {
  const { driverId } = req.params;

  db.query(`SELECT license_document_path FROM tricycle_driver WHERE driver_id = ?`, [driverId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length || !rows[0].license_document_path) {
      return res.status(404).json({ error: 'No license document on file for this driver' });
    }

    const filePath = path.join(__dirname, '..', rows[0].license_document_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'License file is missing from the server' });
    }
    res.sendFile(filePath);
  });
};

// DASHBOARD SUMMARY CARDS — total bookings ever made, total registered
// drivers, passengers who have made at least one ride ("active"), and rides
// still waiting for a driver right now.
exports.getStats = (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM rides) AS totalBookings,
      (SELECT COUNT(*) FROM tricycle_driver) AS registeredDrivers,
      (SELECT COUNT(DISTINCT passenger_account_id) FROM rides) AS activePassengers,
      (SELECT COUNT(*) FROM rides WHERE status = 'Pending') AS pendingRequests
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows[0]);
  });
};
// LIST ALL PASSENGERS — every registered student, with how many rides
// they've made, when they last booked, and whether they're actually
// logged in right now (is_online, same login/logout-flipped flag pattern
// as tricycle_driver — see loginStudent/logoutStudent in authController.js).
exports.listPassengers = (req, res) => {
  const sql = `
    SELECT s.account_id, CONCAT(s.first_name, ' ', s.last_name) AS name,
           s.is_online, MAX(r.created_at) AS last_booking, COUNT(r.ride_id) AS ride_count
    FROM student s
    LEFT JOIN rides r ON r.passenger_account_id = s.account_id
    GROUP BY s.account_id, s.first_name, s.last_name, s.is_online
    ORDER BY last_booking IS NULL, last_booking DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ passengers: rows });
  });
};

// LOYALTY CERTIFICATES — the certificate no longer shows itself
// automatically (see rideController.js's getLoyaltyStatus/
// getDriverLoyaltyStatus); an admin has to grant it here instead.
// Milestones repeat and escalate: 5, then 10, then 15... one row per
// certificate ever granted.
const LOYALTY_MILESTONE_STEP = 5;

// Everyone (passenger or driver) who's crossed at least one milestone —
// includes both people still waiting on a grant and people already
// granted their current one, since the admin should see both, not just
// an ever-shrinking "to do" list.
exports.listLoyaltyOverview = (req, res) => {
  const sql = `
    SELECT s.account_id, CONCAT(s.first_name, ' ', s.last_name) AS name, 'passenger' AS role, NULL AS detail,
           (SELECT COUNT(*) FROM rides r WHERE r.passenger_account_id = s.account_id AND r.status = 'Completed') AS completed_rides,
           (SELECT COUNT(*) FROM loyalty_certificates lc WHERE lc.account_id = s.account_id) AS grants_count
    FROM student s
    UNION ALL
    SELECT d.account_id, CONCAT(d.first_name, ' ', d.last_name) AS name, 'driver' AS role, d.plate_number AS detail,
           (SELECT COUNT(*) FROM rides r WHERE r.driver_account_id = d.account_id AND r.status = 'Completed') AS completed_rides,
           (SELECT COUNT(*) FROM loyalty_certificates lc WHERE lc.account_id = d.account_id) AS grants_count
    FROM tricycle_driver d
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const overview = rows
      .filter(r => r.completed_rides >= LOYALTY_MILESTONE_STEP)
      .map(r => {
        const nextThreshold = (r.grants_count + 1) * LOYALTY_MILESTONE_STEP;
        return {
          account_id: r.account_id,
          name: r.name,
          role: r.role,
          detail: r.detail,
          completed_rides: r.completed_rides,
          next_threshold: nextThreshold,
          eligible: r.completed_rides >= nextThreshold
        };
      })
      .sort((a, b) => (b.eligible - a.eligible) || (b.completed_rides - a.completed_rides));
    res.status(200).json({ overview });
  });
};

// GRANT — recomputes eligibility fresh from the database rather than
// trusting anything the client sent, same defense-in-depth pattern as the
// rest of this app's money/status-affecting actions.
exports.grantLoyaltyCertificate = (req, res) => {
  const { account_id } = req.body;
  const grantedByAdminId = req.user.adminId;
  if (!account_id) return res.status(400).json({ error: 'account_id is required' });

  db.query(`SELECT role FROM user_account WHERE account_id = ?`, [account_id], (err, userRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userRows.length) return res.status(404).json({ error: 'Account not found' });

    const rideCountSql = userRows[0].role === 'driver'
      ? `SELECT COUNT(*) AS completedRides FROM rides WHERE driver_account_id = ? AND status = 'Completed'`
      : `SELECT COUNT(*) AS completedRides FROM rides WHERE passenger_account_id = ? AND status = 'Completed'`;

    db.query(rideCountSql, [account_id], (err, rideRows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query(`SELECT COUNT(*) AS grantsCount FROM loyalty_certificates WHERE account_id = ?`, [account_id], (err, grantRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const completedRides = rideRows[0].completedRides;
        const grantsCount = grantRows[0].grantsCount;
        const nextThreshold = (grantsCount + 1) * LOYALTY_MILESTONE_STEP;

        if (completedRides < nextThreshold) {
          return res.status(400).json({ error: `This account has ${completedRides} completed rides, but needs ${nextThreshold} for its next certificate.` });
        }

        db.query(
          `INSERT INTO loyalty_certificates (account_id, granted_by_admin_id, milestone_rides) VALUES (?, ?, ?)`,
          [account_id, grantedByAdminId, nextThreshold],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Certificate granted', milestone: nextThreshold });
          }
        );
      });
    });
  });
};

// HISTORY — every certificate ever granted, newest first, for the "view
// granting history" toggle.
exports.listLoyaltyHistory = (req, res) => {
  const sql = `
    SELECT lc.certificate_id, lc.milestone_rides, lc.granted_at, ua.role,
           COALESCE(CONCAT(s.first_name, ' ', s.last_name), CONCAT(d.first_name, ' ', d.last_name)) AS name,
           CONCAT(ap.first_name, ' ', ap.last_name) AS granted_by_name
    FROM loyalty_certificates lc
    JOIN user_account ua ON ua.account_id = lc.account_id
    LEFT JOIN student s ON s.account_id = lc.account_id
    LEFT JOIN tricycle_driver d ON d.account_id = lc.account_id
    LEFT JOIN administrator_profile ap ON ap.admin_id = lc.granted_by_admin_id
    ORDER BY lc.granted_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ history: rows });
  });
};

// LIST ALL BOOKINGS — every ride ever requested, newest first, for the
// admin to audit. Capped at 100 so the table stays usable as the system
// accumulates history.
exports.listBookings = (req, res) => {
  const sql = `
    SELECT r.ride_id, r.pickup_location, r.dropoff_location, r.ride_type,
           r.status, r.fare, r.created_at,
           CONCAT(s.first_name, ' ', s.last_name) AS passenger_name,
           CONCAT(td.first_name, ' ', td.last_name) AS driver_name
    FROM rides r
    JOIN student s ON s.account_id = r.passenger_account_id
    LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
    ORDER BY r.created_at DESC
    LIMIT 100
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ bookings: rows });
  });
};

// APPROVE OR REJECT A DRIVER
exports.updateDriverStatus = (req, res) => {
  const { driverId } = req.params;
  const { status } = req.body;

  if (!['Active', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "Active" or "Rejected"' });
  }

  db.query(`UPDATE tricycle_driver SET account_status = ? WHERE driver_id = ?`, [status, driverId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found' });
    res.status(200).json({ message: `Driver marked as ${status}` });
    db.query(`SELECT account_id FROM tricycle_driver WHERE driver_id = ?`, [driverId], (err2, rows) => {
      if (err2 || !rows.length) return;
      emitDriverAccountStatus(rows[0].account_id);
    });
  });
};

// RESET DRIVER PASSWORD — admin-issued, since drivers have no email on file
// for a self-service Forgot Password flow the way passengers get (that OTP
// flow needs an inbox to send to). A driver who forgets their password
// contacts the TODA admin directly (phone/in person — same trust model as
// the existing approve/reject flow); admin clicks this button and relays
// the one-time temp password from the response. It's generated fresh here
// and never stored or logged anywhere in plaintext after this response.
exports.resetDriverPassword = async (req, res) => {
  const { driverId } = req.params;
  const tempPassword = generateTempPassword();

  try {
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    db.query(
      `UPDATE user_account ua
       JOIN tricycle_driver td ON ua.account_id = td.account_id
       SET ua.password = ?
       WHERE td.driver_id = ?`,
      [hashedPassword, driverId],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found' });
        res.status(200).json({ message: 'Password reset successfully', tempPassword });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
