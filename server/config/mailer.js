// Sends email over HTTPS via Resend's API instead of raw SMTP — Railway's
// free tier blocks outbound SMTP entirely (confirmed: both port 465 and 587
// connections to Gmail timed out identically in production), so nodemailer
// could never work here no matter how the connection was configured. HTTPS
// (port 443) isn't blocked, since the app's own API traffic already relies
// on it working.
//
// Resend replaced SendGrid in October 2026: SendGrid's free plan is only a
// 60-day trial, while Resend's free tier (3,000 emails/month, 100/day) is
// permanent and needs no card. SendGrid stays as a fallback only while its
// key is still set in Railway; once it's removed, that branch never runs.
//
// The "from" address is on gotsuian.com, a domain verified in Resend (DKIM
// TXT record + SPF CNAME records added in Namecheap's DNS). Sending as
// gotsuian.system@gmail.com (a domain the sender doesn't control) was
// silently discarded by receiving mail servers even though the provider
// reported "Delivered" — no third party can properly authenticate mail
// claiming to be from a gmail.com address.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'noreply@gotsuian.com';
const FROM_NAME = 'GoTSUian';

async function sendViaResend({ to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
}

async function sendViaSendGrid({ to, subject, text, html }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }
}

// Local development has no email key — the real one lives only in
// Railway's dashboard variables, and copying it onto a laptop is one more
// place for it to leak from. Without this, every OTP send fails locally and
// registration can't be tested at all. Printing the code to the terminal
// instead keeps the key off development machines entirely.
//
// This can never take effect in production: Railway always has the variable
// set, so the branch below is unreachable there. The warning is deliberately
// loud so that a deploy which somehow lost the key is obvious in the logs
// rather than silently accepting registrations nobody can complete.
async function sendMail({ to, subject, text, html }) {
  if (RESEND_API_KEY) {
    return sendViaResend({ to, subject, text, html });
  }
  if (SENDGRID_API_KEY) {
    return sendViaSendGrid({ to, subject, text, html });
  }

  console.warn(
    '\n' +
    '  ┌─────────────────────────────────────────────────────────────┐\n' +
    '  │   NO RESEND_API_KEY — EMAIL NOT SENT (local dev fallback)   │\n' +
    '  └─────────────────────────────────────────────────────────────┘\n' +
    `  To:      ${to}\n` +
    `  Subject: ${subject}\n` +
    `  ${text}\n`
  );
}

module.exports = { sendMail };
