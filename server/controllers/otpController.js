const db = require('../config/db');
const bcrypt = require('bcrypt');
const { sendMail } = require('../config/mailer');

const SCHOOL_EMAIL_DOMAIN = '@student.tsu.edu.ph';
// TEMPORARY: also allow @gmail.com while TSU's Outlook system silently
// drops mail from gotsuian.com (brand-new domain, no sending reputation
// yet with TSU's mail filtering) — lets groupmates/adviser actually reach
// the dashboard for testing. Remove once TSU IT whitelists the domain or
// its reputation builds up, so only SCHOOL_EMAIL_DOMAIN is accepted again.
const TESTING_ALLOWED_DOMAIN = '@gmail.com';
const OTP_TTL_MINUTES = 10;
const VERIFIED_GRACE_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isAllowedEmail(email) {
  return email.endsWith(SCHOOL_EMAIL_DOMAIN) || email.endsWith(TESTING_ALLOWED_DOMAIN);
}

// Generates a fresh code, hashes it, and replaces any previous pending code
// for that email — shared by sendOtp (registration) and sendResetOtp
// (forgot password), which differ only in which existence check runs first.
async function issueOtp(email) {
  const code = generateCode();
  const otpHash = await bcrypt.hash(code, 10);

  await new Promise((resolve, reject) => {
    db.query(`DELETE FROM email_otp WHERE email = ?`, [email], (err) => (err ? reject(err) : resolve()));
  });

  await new Promise((resolve, reject) => {
    const insertSql = `
      INSERT INTO email_otp (email, otp_hash, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${OTP_TTL_MINUTES} MINUTE))
    `;
    db.query(insertSql, [email, otpHash], (err) => (err ? reject(err) : resolve()));
  });

  return code;
}

async function emailCode(email, code, res) {
  try {
    await sendMail({
      to: email,
      subject: 'Your GoTSUian verification code',
      text: `Your GoTSUian verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your GoTSUian verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>`
    });
    res.status(200).json({ message: 'Verification code sent' });
  } catch (mailError) {
    console.error('SendGrid send failed:', mailError.message);
    res.status(502).json({ error: 'Could not send the verification email. Please try again.' });
  }
}

// SEND OTP — emails a fresh 6-digit code to a @student.tsu.edu.ph address.
// Any previous code for that email (verified or not) is invalidated, so
// only the most recently sent code can ever be used.
exports.sendOtp = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email || !isAllowedEmail(email)) {
    return res.status(400).json({ error: `Please use a valid ${SCHOOL_EMAIL_DOMAIN} email` });
  }

  db.query(`SELECT account_id FROM user_account WHERE username = ?`, [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    try {
      const code = await issueOtp(email);
      await emailCode(email, code, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

// SEND RESET OTP — Forgot Password, passengers only. Opposite existence
// check from sendOtp: the email must already belong to a registered
// student account, not be free of one.
exports.sendResetOtp = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email || !isAllowedEmail(email)) {
    return res.status(400).json({ error: `Please use a valid ${SCHOOL_EMAIL_DOMAIN} email` });
  }

  db.query(`SELECT account_id FROM user_account WHERE username = ? AND role = 'student'`, [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) {
      return res.status(404).json({ error: 'No passenger account found with that email' });
    }

    try {
      const code = await issueOtp(email);
      await emailCode(email, code, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

// VERIFY OTP — checks the code against the most recently sent one for that
// email. On success, the row stays `verified = 1` for a short grace window
// so the follow-up /register/student call can rely on it.
exports.verifyOtp = (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const code = (req.body.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  db.query(`SELECT * FROM email_otp WHERE email = ? ORDER BY otp_id DESC LIMIT 1`, [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) {
      return res.status(400).json({ error: 'No verification code found for this email. Please request a new one.' });
    }

    const otpRow = rows[0];

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }

    if (otpRow.attempts >= MAX_ATTEMPTS) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const match = await bcrypt.compare(code, otpRow.otp_hash);

    if (!match) {
      db.query(`UPDATE email_otp SET attempts = attempts + 1 WHERE otp_id = ?`, [otpRow.otp_id]);
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    const updateSql = `
      UPDATE email_otp
      SET verified = 1, expires_at = DATE_ADD(NOW(), INTERVAL ${VERIFIED_GRACE_MINUTES} MINUTE)
      WHERE otp_id = ?
    `;
    db.query(updateSql, [otpRow.otp_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ message: 'Email verified' });
    });
  });
};
