const mysql = require('mysql2');
require('dotenv').config();

// A single long-lived createConnection() used to sit here — once Railway's
// MySQL closed it (idle timeout, or the hardware-failure outage that took
// the DB down briefly), every query after that failed with "Can't add new
// command when connection is in closed state" until the whole process was
// restarted, since there was only ever the one connection object to use.
// A pool grabs a fresh (or reconnects a dead) connection per query instead.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL database: gotsuian_db');
  connection.release();
});

module.exports = db;