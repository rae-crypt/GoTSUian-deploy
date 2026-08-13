// One-off diagnostic: send a test email through the exact same SendGrid
// code path production uses, to any address — useful for checking whether
// a delivery problem is specific to one recipient's mail system (e.g. TSU's
// Outlook) or general to SendGrid itself.
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
      subject: 'GoTSUian SendGrid test',
      text: 'This is a test email to check SendGrid delivery.',
      html: '<p>This is a test email to check SendGrid delivery.</p>'
    });
    console.log('Sent successfully to', to);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
