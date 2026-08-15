const path = require('path');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { emitAvailabilityChanged } = require('../socket');

// REGISTER STUDENT (Passenger)
exports.registerStudent = async (req, res) => {
  const {
    username, password,
    first_name, middle_name, last_name,
    student_number,
    birth_date, age, sex, contact_number, current_address
  } = req.body;

  if (!username || !password || !first_name || !last_name || !student_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const email = username.trim().toLowerCase();

  // A passenger's email must have gone through /api/otp/send + /api/otp/verify
  // first — this is the gate that stops anyone from registering with an
  // inbox they don't actually own.
  db.query(
    `SELECT 1 FROM email_otp WHERE email = ? AND verified = 1 AND expires_at > NOW() LIMIT 1`,
    [email],
    async (err, otpRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!otpRows.length) {
        return res.status(400).json({ error: 'Please verify your email first' });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.beginTransaction((err) => {
          if (err) return res.status(500).json({ error: err.message });

          const accountSql = `INSERT INTO user_account (username, password, role) VALUES (?, ?, 'student')`;
          db.query(accountSql, [username, hashedPassword], (err, accountResult) => {
            if (err) {
              return db.rollback(() => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.sqlMessage || err.message }));
            }

            const accountId = accountResult.insertId;

            const studentSql = `
              INSERT INTO student (account_id, student_number, first_name, middle_name, last_name, birth_date, age, sex, contact_number, current_address)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(studentSql, [accountId, student_number, first_name, middle_name || null, last_name, birth_date || null, age || null, sex || null, contact_number || null, current_address || null], (err, studentResult) => {
              if (err) {
                return db.rollback(() => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'This student ID is already registered' : err.message }));
              }

              db.commit((err) => {
                if (err) {
                  return db.rollback(() => res.status(500).json({ error: err.message }));
                }
                // Consume the OTP so it can't be reused for a second registration.
                db.query(`DELETE FROM email_otp WHERE email = ?`, [email]);
                const token = jwt.sign(
                  { accountId, role: 'student' },
                  process.env.JWT_SECRET,
                  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
                );
                res.status(201).json({
                  message: 'Student registered successfully',
                  accountId,
                  studentId: studentResult.insertId,
                  token
                });
              });
            });
          });
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
};

// LOGIN STUDENT (Passenger)
exports.loginStudent = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const sql = `
    SELECT ua.account_id, ua.username, ua.password, ua.role, s.student_id, s.first_name, s.last_name
    FROM user_account ua
    JOIN student s ON ua.account_id = s.account_id
    WHERE ua.username = ? AND ua.role = 'student'
  `;

  db.query(sql, [username], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign(
      { accountId: user.account_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        accountId: user.account_id,
        studentId: user.student_id,
        name: `${user.first_name} ${user.last_name}`,
        username: user.username,
        role: user.role
      }
    });
  });
};

// RESET PASSWORD (Passenger) — Forgot Password's final step. Requires a
// verified, unexpired email_otp row for the email (same check
// registerStudent uses), created via /api/otp/send-reset + /api/otp/verify.
exports.resetPasswordStudent = async (req, res) => {
  const { email: rawEmail, newPassword } = req.body;

  if (!rawEmail || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const email = rawEmail.trim().toLowerCase();

  db.query(
    `SELECT 1 FROM email_otp WHERE email = ? AND verified = 1 AND expires_at > NOW() LIMIT 1`,
    [email],
    async (err, otpRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!otpRows.length) {
        return res.status(400).json({ error: 'Please verify your email first' });
      }

      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query(
          `UPDATE user_account SET password = ? WHERE username = ? AND role = 'student'`,
          [hashedPassword, email],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) {
              return res.status(404).json({ error: 'No passenger account found with that email' });
            }
            db.query(`DELETE FROM email_otp WHERE email = ?`, [email]);
            res.status(200).json({ message: 'Password updated successfully' });
          }
        );
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
};

// CHANGE PASSWORD — from either role's own Profile page while logged in.
// Unlike resetPasswordStudent (Forgot Password's OTP-gated flow, students
// only, since that's the only role with an email on file), this doesn't
// need to re-prove email ownership — knowing the current password already
// proves that, so it works the same way for drivers too.
function changePassword(role) {
  return async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const accountId = req.user.accountId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    db.query(
      `SELECT password FROM user_account WHERE account_id = ? AND role = ?`,
      [accountId, role],
      async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows.length) return res.status(404).json({ error: 'Account not found' });

        const passwordMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        try {
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          db.query(
            `UPDATE user_account SET password = ? WHERE account_id = ?`,
            [hashedPassword, accountId],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.status(200).json({ message: 'Password updated successfully' });
            }
          );
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  };
}

exports.changePasswordStudent = changePassword('student');
exports.changePasswordDriver = changePassword('driver');

// REGISTER DRIVER
exports.registerDriver = async (req, res) => {
  const {
    password,
    first_name, middle_name, last_name,
    driver_license_no, plate_number, body_number, birth_date, age, sex, contact_number, current_address
  } = req.body;

  // Drivers log in with their contact number instead of an email/username —
  // it doubles as the unique login identifier stored in user_account.username.
  if (!contact_number || !password || !first_name || !last_name || !driver_license_no || !plate_number || !body_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Plate number (LTO-issued, e.g. CD-64318) and body number (TODA unit
  // number painted on the tricycle) are two different real-world IDs with
  // two different formats — validated server-side too, not just in the
  // form, since this data is shown to passengers for their own safety.
  const normalizedPlateNumber = plate_number.trim().toUpperCase();
  if (!/^[A-Z]{2}-\d{5}$/.test(normalizedPlateNumber)) {
    return res.status(400).json({ error: 'Plate number must be in the format AA-12345 (2 letters, hyphen, 5 digits)' });
  }
  if (!/^\d{5}$/.test(body_number.trim())) {
    return res.status(400).json({ error: 'Body number must be exactly 5 digits' });
  }

  // Philippine LTO driver's license number: 1 letter + 10 digits, formatted
  // as L##-##-###### (e.g. N01-23-456789) — same format the frontend
  // auto-formats into as the driver types, re-checked here server-side.
  const normalizedLicenseNo = driver_license_no.trim().toUpperCase();
  if (!/^[A-Z]\d{2}-\d{2}-\d{6}$/.test(normalizedLicenseNo)) {
    return res.status(400).json({ error: 'Driver\'s license number must be in the format L##-##-###### (e.g. N01-23-456789)' });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Driver's license file is required" });
  }

  // Store a path relative to server/ (not the absolute disk path multer
  // gives us) so it stays valid regardless of which machine runs the server.
  const licenseDocumentPath = path.join('uploads', 'licenses', req.file.filename);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      const accountSql = `INSERT INTO user_account (username, password, role) VALUES (?, ?, 'driver')`;
      db.query(accountSql, [contact_number, hashedPassword], (err, accountResult) => {
        if (err) {
          return db.rollback(() => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'This contact number is already registered' : err.message }));
        }

        const accountId = accountResult.insertId;

        const driverSql = `
          INSERT INTO tricycle_driver (account_id, first_name, middle_name, last_name, driver_license_no, plate_number, body_number, license_document_path, account_status, birth_date, age, sex, contact_number, current_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
        `;
        db.query(driverSql, [accountId, first_name, middle_name || null, last_name, normalizedLicenseNo, normalizedPlateNumber, body_number.trim(), licenseDocumentPath, birth_date || null, age || null, sex || null, contact_number || null, current_address || null], (err, driverResult) => {
          if (err) {
            return db.rollback(() => res.status(500).json({ error: err.message }));
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => res.status(500).json({ error: err.message }));
            }
            // A Pending driver is already allowed to log in (see loginDriver
            // — only 'Rejected' blocks access) and see their dashboard, they
            // just can't accept rides yet. Issue a token here too so a
            // newly-registered driver lands straight on their dashboard
            // instead of being sent back to the login form.
            const token = jwt.sign(
              { accountId, role: 'driver', accountStatus: 'Pending' },
              process.env.JWT_SECRET,
              { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );
            res.status(201).json({
              message: 'Driver registered successfully',
              accountId,
              driverId: driverResult.insertId,
              accountStatus: 'Pending',
              token
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN DRIVER
exports.loginDriver = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const sql = `
    SELECT ua.account_id, ua.username, ua.password, ua.role, td.driver_id, td.first_name, td.last_name, td.account_status
    FROM user_account ua
    JOIN tricycle_driver td ON ua.account_id = td.account_id
    WHERE ua.username = ? AND ua.role = 'driver'
  `;

  db.query(sql, [username], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Pending drivers can still log in and see their dashboard — the admin
    // isn't watching the system around the clock, so blocking login entirely
    // would leave a newly-registered driver locked out for who knows how
    // long. Approval instead gates the ability to accept rides (see
    // acceptRide in rideController.js). A rejected application is the one
    // case that blocks access outright.
    if (user.account_status === 'Rejected') {
      return res.status(403).json({ error: 'Your driver application was not approved. Please contact the TODA admin.' });
    }

        const token = jwt.sign(
      { accountId: user.account_id, role: user.role, accountStatus: user.account_status },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Driver is automatically "on shift" the moment they log in — no manual
    // toggle needed. Logging out (see setupLogoutButtons in app.js) is what
    // flips them back offline.
    db.query(`UPDATE tricycle_driver SET is_online = TRUE WHERE account_id = ?`, [user.account_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          accountId: user.account_id,
          driverId: user.driver_id,
          name: `${user.first_name} ${user.last_name}`,
          username: user.username,
          role: user.role,
          accountStatus: user.account_status
        }
      });
      emitAvailabilityChanged();
    });
  });
};

// LOGIN ADMIN
exports.loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const sql = `
    SELECT a.admin_id, a.username, a.password, a.account_status, ap.first_name, ap.last_name
    FROM administrator a
    JOIN administrator_profile ap ON a.admin_id = ap.admin_id
    WHERE a.username = ?
  `;

  db.query(sql, [username], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const admin = results[0];

    if (admin.account_status !== 'active') {
      return res.status(403).json({ error: 'Admin account is not active' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { adminId: admin.admin_id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        adminId: admin.admin_id,
        name: `${admin.first_name} ${admin.last_name}`,
        username: admin.username,
        role: 'admin'
      }
    });
  });
};