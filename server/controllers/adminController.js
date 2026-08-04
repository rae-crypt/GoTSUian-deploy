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
