const nodemailer = require('nodemailer');

// Uses a Gmail account + App Password (not the regular account password —
// see server/.env for where GMAIL_USER / GMAIL_APP_PASSWORD are set).
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  // Railway's containers can't route outbound IPv6, but Gmail's SMTP
  // hostname resolves to both an IPv6 and IPv4 address and Node tries
  // IPv6 first by default — forcing IPv4 here avoids the ENETUNREACH/
  // connection-timeout loop seen in production.
  family: 4
});

module.exports = transporter;
