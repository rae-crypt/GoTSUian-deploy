const nodemailer = require('nodemailer');

// Uses a Gmail account + App Password (not the regular account password —
// see server/.env for where GMAIL_USER / GMAIL_APP_PASSWORD are set).
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

module.exports = transporter;
