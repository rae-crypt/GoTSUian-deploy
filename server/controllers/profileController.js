const db = require('../config/db');

// GET the logged-in user's profile — branches by role since students and
// drivers live in different tables with different fields.
exports.getProfile = (req, res) => {
  const { accountId, role } = req.user;

  if (role === 'student') {
    db.query(
      `SELECT student_id, student_number, first_name, middle_name, last_name, birth_date, age, sex, contact_number, current_address
       FROM student WHERE account_id = ?`,
      [accountId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
        res.status(200).json({ profile: rows[0] });
      }
    );
  } else if (role === 'driver') {
    db.query(
      `SELECT driver_id, driver_license_no, first_name, middle_name, last_name, account_status, birth_date, age, sex, contact_number, current_address
       FROM tricycle_driver WHERE account_id = ?`,
      [accountId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
        res.status(200).json({ profile: rows[0] });
      }
    );
  } else {
    res.status(400).json({ error: 'Profile is only available for students and drivers' });
  }
};

// UPDATE the logged-in user's editable profile fields. Identity fields
// (username/email, student_number, driver_license_no) are intentionally
// excluded from what this accepts — those double as login credentials or
// verified IDs and shouldn't change without re-verification.
exports.updateProfile = (req, res) => {
  const { accountId, role } = req.user;
  const { first_name, middle_name, last_name, birth_date, age, sex, contact_number, current_address } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  // `table` only ever comes from the verified JWT role (never from req.body),
  // so this is safe to interpolate — it's not client-controlled input.
  const table = role === 'student' ? 'student' : role === 'driver' ? 'tricycle_driver' : null;
  if (!table) {
    return res.status(400).json({ error: 'Profile is only available for students and drivers' });
  }

  db.query(
    `UPDATE ${table} SET first_name = ?, middle_name = ?, last_name = ?, birth_date = ?, age = ?, sex = ?, contact_number = ?, current_address = ? WHERE account_id = ?`,
    [first_name, middle_name || null, last_name, birth_date || null, age || null, sex || null, contact_number || null, current_address || null, accountId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Profile not found' });
      res.status(200).json({ message: 'Profile updated successfully' });
    }
  );
};
