// One-off diagnostic: send a test email through the exact same Resend
// code path production uses, to any address — useful for checking whether
// a delivery problem is specific to one recipient's mail system (e.g. TSU's
// Outlook) or general to Resend itself.
//
// Usage: node scripts/testEmail.js <recipient-email>

require('dotenv').config();
const { sendMail } = require('../config/mailer');

const to = process.argv[2];

if (!to) {
  console.error('Usage: node scripts/testEmail.js <recipient-email>');
  process.exit(1);
}

(async () => {
  try {
    await sendMail({
      to,
      subject: 'GoTSUian Resend test',
      text: 'This is a test email to check Resend delivery.',
      html: '<p>This is a test email to check Resend delivery.</p>'
    });
    console.log('Sent successfully to', to);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
