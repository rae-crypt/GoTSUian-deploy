const db = require('../config/db');
const bcrypt = require('bcrypt');

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
            res.status(201).json({
              message: 'Student registered successfully',
              accountId,
              studentId: studentResult.insertId
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

    res.status(200).json({
      message: 'Login successful',
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

// REGISTER DRIVER
exports.registerDriver = async (req, res) => {
  const {
    username, password,
    first_name, middle_name, last_name,
    driver_license_no, birth_date, age, sex, contact_number, current_address
  } = req.body;

  if (!username || !password || !first_name || !last_name || !driver_license_no) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      const accountSql = `INSERT INTO user_account (username, password, role) VALUES (?, ?, 'driver')`;
      db.query(accountSql, [username, hashedPassword], (err, accountResult) => {
        if (err) {
          return db.rollback(() => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.sqlMessage || err.message }));
        }

        const accountId = accountResult.insertId;

        const driverSql = `
          INSERT INTO tricycle_driver (account_id, first_name, middle_name, last_name, driver_license_no, account_status, birth_date, age, sex, contact_number, current_address)
          VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
        `;
        db.query(driverSql, [accountId, first_name, middle_name || null, last_name, driver_license_no, birth_date || null, age || null, sex || null, contact_number || null, current_address || null], (err, driverResult) => {
          if (err) {
            return db.rollback(() => res.status(500).json({ error: err.message }));
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => res.status(500).json({ error: err.message }));
            }
            res.status(201).json({
              message: 'Driver registered successfully',
              accountId,
              driverId: driverResult.insertId
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

    res.status(200).json({
      message: 'Login successful',
      user: {
        accountId: user.account_id,
        driverId: user.driver_id,
        name: `${user.first_name} ${user.last_name}`,
        username: user.username,
        role: user.role,
        accountStatus: user.account_status
      }
    });
  });
};

// REGISTER ADMIN
exports.registerAdmin = async (req, res) => {
  const {
    username, password,
    first_name, middle_name, last_name, contact_number
  } = req.body;

  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      const adminSql = `INSERT INTO administrator (username, password, account_status) VALUES (?, ?, 'active')`;
      db.query(adminSql, [username, hashedPassword], (err, adminResult) => {
        if (err) {
          return db.rollback(() => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.sqlMessage || err.message }));
        }

        const adminId = adminResult.insertId;

        const profileSql = `
          INSERT INTO administrator_profile (admin_id, first_name, middle_name, last_name, contact_number)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.query(profileSql, [adminId, first_name, middle_name || null, last_name, contact_number || null], (err) => {
          if (err) {
            return db.rollback(() => res.status(500).json({ error: err.message }));
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => res.status(500).json({ error: err.message }));
            }
            res.status(201).json({
              message: 'Admin registered successfully',
              adminId
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

    res.status(200).json({
      message: 'Login successful',
      user: {
        adminId: admin.admin_id,
        name: `${admin.first_name} ${admin.last_name}`,
        username: admin.username,
        role: 'admin'
      }
    });
  });
};