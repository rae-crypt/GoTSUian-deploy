const dns = require('dns');
const nodemailer = require('nodemailer');

// Uses a Gmail account + App Password (not the regular account password —
// see server/.env for where GMAIL_USER / GMAIL_APP_PASSWORD are set).
//
// Railway's container doesn't expose a local network interface that
// nodemailer's own DNS-family heuristic (lib/shared/index.js) recognizes
// as IPv4-capable, so nodemailer always resolves and connects to Gmail's
// IPv6 address — which isn't actually routable from this container
// (ENETUNREACH). Resolving Gmail's IPv4 address ourselves and passing it
// as `host` skips that heuristic entirely, since nodemailer only runs its
// own DNS resolution when `host` is a hostname, not an IP literal.
let cachedTransporter = null;
let cachedIp = null;

async function getTransporter() {
  const [ip] = await dns.promises.resolve4('smtp.gmail.com');

  if (cachedTransporter && ip === cachedIp) {
    return cachedTransporter;
  }

  cachedIp = ip;
  cachedTransporter = nodemailer.createTransport({
    host: ip,
    // Port 465 (implicit TLS) connections were hanging until timeout in
    // production — likely 465 outbound being blocked/dropped by Railway
    // for abuse prevention, common on free-tier hosts. Port 587 (STARTTLS)
    // is the modern mail submission port and much less commonly blocked.
    port: 587,
    secure: false,
    requireTLS: true,
    tls: { servername: 'smtp.gmail.com' },
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  return cachedTransporter;
}

module.exports = { getTransporter };
