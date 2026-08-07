const db = require('../config/db');

// LIST ALL DRIVERS — the admin dashboard's driver management table shows
// every driver (not just pending ones) so the admin can also review
// already-approved or rejected accounts, not only act on new ones.
exports.listDrivers = (req, res) => {
  const sql = `
    SELECT driver_id, account_id, first_name, last_name, driver_license_no,
           contact_number, account_status
    FROM tricycle_driver
    ORDER BY FIELD(account_status, 'Pending', 'Active', 'Rejected'), driver_id DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ drivers: rows });
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
// they've made and when they last booked. "Active" just means they've
// booked at least once; there's no separate account-status field for
// passengers the way there is for drivers.
exports.listPassengers = (req, res) => {
  const sql = `
    SELECT s.account_id, CONCAT(s.first_name, ' ', s.last_name) AS name,
           MAX(r.created_at) AS last_booking, COUNT(r.ride_id) AS ride_count
    FROM student s
    LEFT JOIN rides r ON r.passenger_account_id = s.account_id
    GROUP BY s.account_id, s.first_name, s.last_name
    ORDER BY last_booking IS NULL, last_booking DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ passengers: rows });
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
  });
};
