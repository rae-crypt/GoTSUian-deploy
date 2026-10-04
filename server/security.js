const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Security headers. Two of helmet's defaults are switched off or relaxed
// because they would break the app as it is:
// - contentSecurityPolicy: the pages load Leaflet from unpkg, fonts from
//   Google/Fontshare and map tiles from OpenStreetMap, plus inline scripts.
// - referrerPolicy: OpenStreetMap's tile servers refuse tile requests that
//   carry no Referer, and helmet's default is "no-referrer".
const securityHeaders = helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// The JSON every refused request gets, in the same { error } shape the
// pages already show for any other failed login or sign-up.
function tooMany(message) {
  return (req, res) => res.status(429).json({ error: message });
}

// The account part of a key: the email, username or contact number sent in
// the body (lower-cased), or '' when there is none (a multipart sign-up,
// whose body isn't parsed yet at this point).
function accountOf(req) {
  const body = req.body || {};
  return String(body.username || body.email || body.contact_number || '').trim().toLowerCase();
}

// Keys are "IP + account", not IP alone: at the defense the whole room is
// on one Wi-Fi and so shares one public IP, and an IP-only limit would lock
// everyone out after a few logins. Per account, someone guessing one
// person's password is stopped while everyone else logs in normally.
const perIpAndAccount = (req) => `${ipKeyGenerator(req.ip)}|${accountOf(req)}`;

// Logins (passenger, driver, admin): 10 tries per account per 15 minutes.
// Successful logins don't count, so only wrong passwords use up tries.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: perIpAndAccount,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many wrong attempts. Please wait 15 minutes and try again.')
});

// Email codes (sign-up, forgot password, and checking a code): 5 sends per
// email per 15 minutes, so nobody can flood an inbox or use up the Gmail
// sending limit. Checking a code is also capped per OTP in otpController.
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: perIpAndAccount,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many codes requested. Please wait 15 minutes and try again.')
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: perIpAndAccount,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many tries. Please wait 15 minutes and try again.')
});

// Sign-ups and password resets, per network: generous enough for a whole
// class registering at the defense from one Wi-Fi, low enough to stop a
// script from mass-creating accounts.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many sign-ups from this network. Please wait a few minutes and try again.')
});

module.exports = { securityHeaders, loginLimiter, otpSendLimiter, otpVerifyLimiter, signupLimiter };
