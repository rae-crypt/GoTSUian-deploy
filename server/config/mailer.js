// Sends email over HTTPS via SendGrid's API instead of raw SMTP — Railway's
// free tier blocks outbound SMTP entirely (confirmed: both port 465 and 587
// connections to Gmail timed out identically in production), so nodemailer
// could never work here no matter how the connection was configured. HTTPS
// (port 443) isn't blocked, since the app's own API traffic already relies
// on it working.
//
// The "from" address is on gotsuian.com, a domain fully authenticated in
// SendGrid (Settings → Sender Authentication → Domain Authentication, SPF/
// DKIM/DMARC records added in Namecheap's DNS). Sending as
// gotsuian.system@gmail.com (a domain SendGrid doesn't control) was
// silently discarded by receiving mail servers even though SendGrid itself
// reported "Delivered" — no third party can properly authenticate mail
// claiming to be from a gmail.com address.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'noreply@gotsuian.com';

async function sendMail({ to, subject, text, html }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: 'GoTSUian' },
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

module.exports = { sendMail };
