const nodemailer = require('nodemailer');

// Uses a Gmail account + App Password (not the regular account password —
// see server/.env for where GMAIL_USER / GMAIL_APP_PASSWORD are set).
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  // Railway's container only exposes a non-internal IPv6 interface, so
  // nodemailer's own DNS resolver (lib/shared/index.js) treats IPv4 as
  // "unsupported" and never even looks up Gmail's IPv4 address — it's
  // left only with an IPv6 address that isn't actually routable, hence
  // ENETUNREACH. (Note: `family` is not a real nodemailer option and had
  // no effect.) Setting this makes it also count the loopback interface
  // as proof IPv4 works, so it resolves and tries Gmail's IPv4 address too.
  allowInternalNetworkInterfaces: true
});

module.exports = transporter;
