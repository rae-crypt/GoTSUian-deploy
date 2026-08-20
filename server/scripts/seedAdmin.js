// One-time helper to create the first administrator account.
// There is no sign-up UI for admins (auth.html only offers passenger/driver),
// so this is the only way to get a row into `administrator` to log in with.
//
// Usage:
//   node scripts/seedAdmin.js <username> <password> <firstName> <lastName> [contactNumber]
//
// Run from the server/ directory so the relative require below resolves.

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

const [username, password, firstName, lastName, contactNumber] = process.argv.slice(2);

if (!username || !password || !firstName || !lastName) {
  console.error('Usage: node scripts/seedAdmin.js <username> <password> <firstName> <lastName> [contactNumber]');
  process.exit(1);
}

(async () => {
  const hashedPassword = await bcrypt.hash(password, 10);

  db.getConnection((err, connection) => {
    if (err) {
      console.error('Failed to get a connection:', err.message);
      process.exit(1);
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error('Failed to start transaction:', err.message);
        process.exit(1);
      }

      const adminSql = `INSERT INTO administrator (username, password, account_status) VALUES (?, ?, 'active')`;
      connection.query(adminSql, [username, hashedPassword], (err, adminResult) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error('Failed to create admin account:', err.code === 'ER_DUP_ENTRY' ? 'username already exists' : err.message);
            process.exit(1);
          });
        }

        const adminId = adminResult.insertId;
        const profileSql = `
          INSERT INTO administrator_profile (admin_id, first_name, middle_name, last_name, contact_number)
          VALUES (?, ?, NULL, ?, ?)
        `;
        connection.query(profileSql, [adminId, firstName, lastName, contactNumber || null], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('Failed to create admin profile:', err.message);
              process.exit(1);
            });
          }

          connection.commit((err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('Failed to commit:', err.message);
                process.exit(1);
              });
            }
            connection.release();
            console.log(`Admin account created: ${username} (admin_id ${adminId})`);
            db.end();
          });
        });
      });
    });
  });
})();
