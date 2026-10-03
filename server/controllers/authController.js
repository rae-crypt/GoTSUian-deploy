const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { emitAvailabilityChanged } = require('../socket');
const { getSuspension, SUSPENDED_MESSAGE } = require('../suspension');

// True when an admin-issued Violation has suspended this account (see
// suspension.js). Checked after the password, so a wrong password never
// reveals whether an account is suspended.
function isSuspended(accountId) {
  return new Promise((resolve) => {
    getSuspension(accountId, (err, suspension) => resolve(!err && Boolean(suspension)));
  });
}

// REGISTER STUDENT (Passenger)
exports.registerStudent = async (req, res) => {
  const {
    username, password,
    first_name, middle_name, last_name,
    student_number,
    birth_date, age, sex, contact_number, current_address
  } = req.body;

  // student_number is deliberately NOT required. Testing moved off campus to a
  // partner TODA after the bridge collapsed, so the people registering are
  // members of the public with no student number to give; the column is
  // nullable and the field is gone from the passenger form. It stays in the
  // destructure (and in the INSERT below) so that restoring the field is a
  // front-end change only -- a real number sent by any client is still stored
  // and still has to be unique.
  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Mobile number, required since 2026-10-04 (IT expert review): a Gmail
  // account is free to make, a registered SIM is not (SIM Registration Act),
  // so one number per passenger account makes dummy/fake-booking accounts
  // harder to mass-produce and stops a suspended passenger from simply
  // signing up again. Only the admin and the passenger see it; drivers
  // never do (they use the in-app chat).
  const mobile = String(contact_number || '').trim();
  if (!/^09[0-9]{9}$/.test(mobile)) {
    return res.status(400).json({ error: 'Enter an 11-digit mobile number starting with 09' });
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

      const mobileTaken = await new Promise((resolve) => {
        db.query(`SELECT 1 FROM student WHERE contact_number = ? LIMIT 1`, [mobile], (dupErr, dupRows) => {
          resolve(!dupErr && dupRows.length > 0);
        });
      });
      if (mobileTaken) {
        return res.status(409).json({ error: 'This mobile number is already registered to another passenger account.' });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // A transaction needs one dedicated connection for its whole
        // lifetime (begin/query/commit must all land on the same physical
        // connection) — db is a pool now, so that connection has to be
        // checked out explicitly and released back when done, on every
        // exit path including the error ones.
        db.getConnection((err, connection) => {
          if (err) return res.status(500).json({ error: err.message });

          connection.beginTransaction((err) => {
            if (err) {
              connection.release();
              return res.status(500).json({ error: err.message });
            }

            const accountSql = `INSERT INTO user_account (username, password, role) VALUES (?, ?, 'student')`;
            connection.query(accountSql, [username, hashedPassword], (err, accountResult) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.sqlMessage || err.message });
                });
              }

              const accountId = accountResult.insertId;

              // '' would satisfy NOT NULL but not UNIQUE -- the first blank
              // registration would succeed and every one after it would fail
              // on a duplicate key. Anything empty becomes a real NULL, which
              // a UNIQUE index lets repeat freely.
              const studentNumber = (student_number || '').trim() || null;

              const studentSql = `
                INSERT INTO student (account_id, student_number, first_name, middle_name, last_name, birth_date, age, sex, contact_number, current_address, is_online)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
              `;
              connection.query(studentSql, [accountId, studentNumber, first_name, middle_name || null, last_name, birth_date || null, age || null, sex || null, mobile, current_address || null], (err, studentResult) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'This student ID is already registered' : err.message });
                  });
                }

                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ error: err.message });
                    });
                  }
                  connection.release();
                  // Consume the OTP so it can't be reused for a second registration —
                  // no longer needs the transaction's connection, run on the pool.
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
    if (await isSuspended(user.account_id)) {
      return res.status(403).json({ error: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' });
    }
    const token = jwt.sign(
      { accountId: user.account_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Same "online the moment they log in, offline when they explicitly log
    // out" pattern as loginDriver below — lets Admin's Passenger management
    // panel show who's actually logged in right now instead of just who's
    // ever booked a ride.
    db.query(`UPDATE student SET is_online = TRUE WHERE account_id = ?`, [user.account_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

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
  });
};

// LOGOUT STUDENT — flips is_online back off. Fired client-side right
// before clearStoredUser() wipes the token (see setupLogoutButtons in
// app.js), same as the driver's availability PUT on logout.
exports.logoutStudent = (req, res) => {
  const accountId = req.user.accountId;
  db.query(`UPDATE student SET is_online = FALSE WHERE account_id = ?`, [accountId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Logged out' });
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

    db.getConnection((err, connection) => {
      if (err) return res.status(500).json({ error: err.message });

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return res.status(500).json({ error: err.message });
        }

        const accountSql = `INSERT INTO user_account (username, password, role) VALUES (?, ?, 'driver')`;
        connection.query(accountSql, [contact_number, hashedPassword], (err, accountResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'This contact number is already registered' : err.message });
            });
          }

          const accountId = accountResult.insertId;

          const driverSql = `
            INSERT INTO tricycle_driver (account_id, first_name, middle_name, last_name, driver_license_no, plate_number, body_number, license_document_path, account_status, is_online, birth_date, age, sex, contact_number, current_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', TRUE, ?, ?, ?, ?, ?)
          `;
          connection.query(driverSql, [accountId, first_name, middle_name || null, last_name, normalizedLicenseNo, normalizedPlateNumber, body_number.trim(), licenseDocumentPath, birth_date || null, age || null, sex || null, contact_number || null, current_address || null], (err, driverResult) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: err.message });
              });
            }

            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ error: err.message });
                });
              }
              connection.release();
              // No token: a new driver can't log in until an admin has checked
              // their license and approved them (see loginDriver), so the
              // registration form tells them to wait instead of signing in.
              res.status(201).json({
                message: 'Driver registered successfully',
                accountId,
                driverId: driverResult.insertId,
                accountStatus: 'Pending'
              });
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RE-UPLOAD A PENDING DRIVER'S LICENSE — a Pending driver has no token (see
// loginDriver), so they prove who they are with the same contact number and
// password they log in with. Used when the admin can't read the first file,
// or when it was lost (uploads made before the Railway volume existed were
// wiped on redeploy). Only while Pending: an approved license stays as it is.
exports.reuploadDriverLicense = (req, res) => {
  const { username, password } = req.body;
  // multer has already saved the new file by this point, so every refusal
  // below has to remove it again or it lingers on disk unattached.
  const discardUpload = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  if (!username || !password) {
    discardUpload();
    return res.status(400).json({ error: 'Contact number and password are required' });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Please choose a photo or scan of your driver's license" });
  }

  const sql = `
    SELECT ua.password, td.driver_id, td.account_status, td.license_document_path
    FROM user_account ua
    JOIN tricycle_driver td ON ua.account_id = td.account_id
    WHERE ua.username = ? AND ua.role = 'driver'
  `;
  db.query(sql, [username], async (err, rows) => {
    if (err) {
      discardUpload();
      return res.status(500).json({ error: err.message });
    }
    const driver = rows[0];
    if (!driver || !(await bcrypt.compare(password, driver.password))) {
      discardUpload();
      return res.status(401).json({ error: 'Invalid contact number or password' });
    }
    if (driver.account_status !== 'Pending') {
      discardUpload();
      return res.status(409).json({ error: 'Your license can only be replaced while your account is waiting for verification.' });
    }

    const newPath = path.join('uploads', 'licenses', req.file.filename);
    db.query(
      `UPDATE tricycle_driver SET license_document_path = ? WHERE driver_id = ?`,
      [newPath, driver.driver_id],
      (updateErr) => {
        if (updateErr) {
          discardUpload();
          return res.status(500).json({ error: updateErr.message });
        }
        if (driver.license_document_path) {
          fs.unlink(path.join(__dirname, '..', driver.license_document_path), () => {});
        }
        res.status(200).json({ message: 'License uploaded' });
      }
    );
  });
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

    // A driver gets in only after an admin has verified their license and
    // approved the account (KYC). Until then, and after a rejection, login
    // is refused with a reason the login form can show.
    if (user.account_status === 'Pending') {
      return res.status(403).json({
        error: 'Your account is still waiting for verification by the TODA admin. You can log in once it has been approved.',
        accountStatus: 'Pending'
      });
    }
    if (user.account_status === 'Rejected') {
      return res.status(403).json({ error: 'Your driver application was not approved. Please contact the TODA admin.' });
    }
    if (await isSuspended(user.account_id)) {
      return res.status(403).json({ error: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' });
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