// Mobile navigation toggle
function setupNavMenu() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navBackdrop = document.querySelector('.nav-backdrop');
 
  if (!navToggle || !navLinks) return;
 
  function closeNav() {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    if (navBackdrop) {
      navBackdrop.classList.remove('active');
    }
  }
 
  navToggle.addEventListener('click', function(event) {
    event.stopPropagation();
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('open');
    if (navBackdrop) {
      navBackdrop.classList.toggle('active');
    }
  });
 
  if (navBackdrop) {
    navBackdrop.addEventListener('click', function() {
      closeNav();
    });
  }
 
  document.addEventListener('click', function(event) {
    if (!navToggle.contains(event.target) && !navLinks.contains(event.target)) {
      closeNav();
    }
  });

  // In-page anchor links (e.g. the Home page's "About Us" / "How it works"
  // jump links) don't trigger a full page navigation, so the drawer would
  // otherwise stay open covering the section the user just jumped to.
  navLinks.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', closeNav);
  });
}

// The "Home" row in the mobile drawer (safe no-op elsewhere — only pages
// with a .nav-drawer-group have this) expands into About Us/How it
// works/Get Started instead of navigating directly, same accordion
// interaction as the FAQ items elsewhere on the site.
function setupNavDrawerAccordion() {
  document.querySelectorAll('.nav-drawer-group-toggle').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      const group = toggle.closest('.nav-drawer-group');
      if (!group) return;
      const isOpen = group.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

function setupBackToTop() {
  const backToTopBtn = document.querySelector('.back-to-top');
  if (!backToTopBtn) return;
 
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  });
 
  backToTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// HOW IT WORKS page — the Student/Driver step toggle and FAQ accordion.
// Safe no-op everywhere else (only how-it-works.html has these elements).
// How It Works shows the fare rates the admin has set, not just the
// defaults written into the page, so the page stays right after a change.
// Uses the same "started kilometre counts" rule as the server.
// Also fills [data-fare="first|per|basis"] spans, used by the Fares and
// Payments section of the Terms (rules.html), so the rates written there
// always match what the admin has set.
function setupHowItWorksFares() {
  const firstEl = document.querySelector('#how-fare-first');
  const termSpans = document.querySelectorAll('[data-fare]');
  if (!firstEl && !termSpans.length) return;
  fetch(`${RIDES_API_URL}/fare-settings`)
    .then(res => res.ok ? res.json() : null)
    .then(settings => {
      if (!settings) return;
      const first = Number(settings.first_km_fare);
      const rate = Number(settings.per_km_fare);
      const fareFor = (km) => Math.round(first + rate * Math.max(0, Math.ceil(km - 1)));
      termSpans.forEach((el) => {
        const which = el.getAttribute('data-fare');
        if (which === 'first') el.textContent = `₱${first}`;
        else if (which === 'per') el.textContent = `₱${rate}`;
        else if (which === 'basis' && settings.basis) el.textContent = settings.basis;
      });
      if (!firstEl) return;
      firstEl.textContent = `₱${first}`;
      const perEl = document.querySelector('#how-fare-per');
      if (perEl) perEl.textContent = `+₱${rate}`;
      const basisEl = document.querySelector('#how-fare-basis');
      if (basisEl && settings.basis) basisEl.textContent = settings.basis;
      const examplesEl = document.querySelector('#how-fare-examples');
      if (examplesEl) {
        examplesEl.innerHTML = [2, 3.2, 5]
          .map((km, i) => `<div class="how-fare-chip${i === 1 ? ' is-active' : ''}">${km} km · ₱${fareFor(km)}</div>`)
          .join('');
      }
    })
    .catch(() => {});
}

// Footer "Report a problem": complaints are filed per ride from booking
// history, so it goes there for a signed-in passenger or driver, to the
// dashboard for the admin, and to the login page for everyone else.
function setupFooterReportLink() {
  const links = document.querySelectorAll('[data-report-link]');
  if (!links.length || !isAuthenticated()) return;
  const role = (getStoredUser() || {}).role;
  const target = role === 'passenger' ? 'passenger-bookings.html'
    : role === 'driver' ? 'driver-bookings.html'
    : role === 'admin' ? 'admin.html'
    : null;
  if (target) links.forEach((a) => a.setAttribute('href', target));
}

// The Home page's big "Book a Ride" button only makes sense for a guest or
// a passenger; a driver tapping it was bounced off the login page back to
// their own dashboard. Each role now gets the button for where they'd go.
function setupHeroBookButton() {
  const btn = document.querySelector('.hero-book-btn');
  if (!btn || !isAuthenticated()) return;
  const role = (getStoredUser() || {}).role;
  const target = role === 'passenger' ? { href: 'passenger.html', label: 'Book a Ride' }
    : role === 'driver' ? { href: 'driver.html', label: 'Go to My Rides' }
    : role === 'admin' ? { href: 'admin.html', label: 'Open Dashboard' }
    : null;
  if (!target) return;
  btn.setAttribute('href', target.href);
  // The label is the text after the calendar icon.
  const textNode = Array.from(btn.childNodes).reverse().find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (textNode) textNode.textContent = target.label;
}

function setupHowItWorksPage() {
  const roleButtons = document.querySelectorAll('.how-role-btn');
  if (roleButtons.length) {
    roleButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const role = btn.getAttribute('data-how-role');
        roleButtons.forEach(function(b) { b.classList.toggle('is-active', b === btn); });
        document.querySelectorAll('[data-how-role-panel]').forEach(function(panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-how-role-panel') === role);
        });
      });
    });
  }

  document.querySelectorAll('.how-faq-item').forEach(function(item) {
    const question = item.querySelector('.how-faq-q');
    if (question) {
      question.addEventListener('click', function() {
        item.classList.toggle('is-open');
      });
    }
  });
}

// GETTING STARTED page — the troubleshooting FAQ accordion. Safe no-op
// everywhere else (only getting-started.html has these elements).
function setupGettingStartedPage() {
  document.querySelectorAll('.gs-faq-item').forEach(function(item) {
    const question = item.querySelector('.gs-faq-q');
    if (question) {
      question.addEventListener('click', function() {
        item.classList.toggle('is-open');
      });
    }
  });
}

function highlightActiveNav() {
  const currentPage = document.body.getAttribute('data-page');
  const navLinksArray = document.querySelectorAll('.nav-links a');
  navLinksArray.forEach(link => {
    if (link.getAttribute('data-page') === currentPage) {
      link.classList.add('active');
    }
  });
}
 
function setupScrollReveal() {
  const revealItems = document.querySelectorAll('.feature-card, .step-card, .support-card, .testimonial-card, .about-mv-card, .about-feature-card, .about-team-card, .how-step-card, .how-compare-card, .how-faq-item, .gs-check-card, .gs-step-card, .gs-faq-item, .auth-info-card, .auth-form-card, .availability-indicator, .passenger-sidebar .dashboard-card, #ride-status-panel, .dashboard-panel-link, #availability-toggle, .dashboard-grid .dashboard-card, .request-status-stack .dashboard-card, .rule-card, .term-card, .rules-note');
  if (!revealItems.length || !('IntersectionObserver' in window)) return;
 
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.16
  });
 
  revealItems.forEach(item => observer.observe(item));
}
 
// Auth lives in sessionStorage only — isolated per tab, so testing
// passenger/driver/admin side by side in different tabs never bleeds
// between them. (A previous version also kept a localStorage backup for
// same-tab redirect recovery, needed by an old embedded preview browser;
// real Chrome's sessionStorage survives location.replace() on its own, and
// that backup was the actual cause of repeated cross-tab login hijacks —
// any tab whose sessionStorage happened to be empty would silently adopt
// whoever logged in elsewhere. Removed rather than patched again.)
// "Stay signed in" (opt-in, unchecked by default) — sessionStorage is
// still the source of truth for a tab that's already logged in, but a
// brand-new tab/browser-restart with no sessionStorage of its own will
// self-heal from localStorage IF the user checked the box at login (see
// setStoredUser below). This intentionally reintroduces the localStorage
// mechanism that was previously removed entirely after a cross-tab login
// hijack bug — the difference this time is it's opt-in (localStorage is
// only ever written when the checkbox is checked), so a tab that never
// asked for persistence never gets silently overwritten by another tab's
// login the way the old unconditional version did.
function getStoredUser() {
  let rawUser = sessionStorage.getItem('authUser');
  if (!rawUser) {
    const remembered = localStorage.getItem('authUser');
    if (remembered && localStorage.getItem('isAuthenticated') === 'true') {
      sessionStorage.setItem('authUser', remembered);
      sessionStorage.setItem('isAuthenticated', 'true');
      rawUser = remembered;
    }
  }
  if (!rawUser) {
    return {
      name: '',
      role: '',
      email: '',
      accountId: null,
      accountStatus: '',
      token: ''
    };
  }

  try {
    const parsedUser = JSON.parse(rawUser);
    return {
      name: parsedUser.name || '',
      role: parsedUser.role || '',
      email: parsedUser.email || '',
      accountId: parsedUser.accountId || null,
      accountStatus: parsedUser.accountStatus || '',
      token: parsedUser.token || ''
    };
  } catch (error) {
    console.warn('Unable to read stored session user', error);
    return {
      name: '',
      role: '',
      email: '',
      accountId: null,
      accountStatus: '',
      token: ''
    };
  }
}

// skipRefresh: pass true when a redirectToDashboard() call immediately
// follows — refreshAuthState() would otherwise repaint this page's nav as
// logged-in (e.g. auth.html briefly showing "Booking" + the avatar) for the
// instant before the browser actually navigates away, a visible flash for
// no benefit since the page is about to be torn down anyway.
function setStoredUser(user, skipRefresh) {
  const payload = {
    name: user.name || '',
    role: user.role || '',
    email: user.email || '',
    accountId: user.accountId || null,
    accountStatus: user.accountStatus || '',
    token: user.token || ''
  };

  sessionStorage.setItem('authUser', JSON.stringify(payload));
  sessionStorage.setItem('isAuthenticated', 'true');
  // Only ever mirrors into localStorage when the login form's "Stay signed
  // in" checkbox set this flag — every other call site (re-syncing an
  // already-active session, registration, etc.) leaves it untouched, so it
  // keeps whatever persistence choice was made at the actual login.
  if (localStorage.getItem('rememberMe') === 'true') {
    localStorage.setItem('authUser', JSON.stringify(payload));
    localStorage.setItem('isAuthenticated', 'true');
  }
  if (!skipRefresh) refreshAuthState();
}

// Suspended accounts (server/suspension.js). The server refuses every API
// call from a suspended passenger/driver with code ACCOUNT_SUSPENDED, and
// also pushes "account:suspended" over the socket the moment it happens;
// either one logs this tab out and takes it to the login page, which then
// explains why (see showSuspendedNoticeIfAny).
const SUSPENDED_NOTICE_KEY = 'suspendedNotice';

function forceSuspendedLogout(message) {
  if (!isAuthenticated() || getStoredUser().role === 'admin') return;
  try { sessionStorage.setItem(SUSPENDED_NOTICE_KEY, message || 'Your account has been suspended. Please contact the TODA admin.'); } catch (e) {}
  clearStoredUser();
  location.replace('auth.html?tab=login');
}

function showSuspendedNoticeIfAny() {
  let message = null;
  try {
    message = sessionStorage.getItem(SUSPENDED_NOTICE_KEY);
    sessionStorage.removeItem(SUSPENDED_NOTICE_KEY);
  } catch (e) {}
  if (message && document.querySelector('#auth-modal')) showAuthFeedback('error', 'Account suspended', message);
}

(function watchApiForSuspension() {
  if (!window.fetch) return;
  const realFetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const res = await realFetch(...args);
    if (res.status === 403) {
      res.clone().json().then((data) => {
        if (data && data.code === 'ACCOUNT_SUSPENDED') forceSuspendedLogout(data.error);
      }).catch(() => {});
    }
    return res;
  };
})();

function getAuthHeaders() {
  const token = getStoredUser().token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function clearStoredUser() {
  sessionStorage.removeItem('authUser');
  sessionStorage.removeItem('isAuthenticated');
  localStorage.removeItem('authUser');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('rememberMe');
  refreshAuthState();
}
 
function renderAuthStatus() {
  const navCta = document.querySelector('.nav-cta');
  const navToggle = document.querySelector('.nav-toggle');
  const navToggleAvatar = navToggle ? navToggle.querySelector('.nav-toggle-avatar') : null;

  const user = getStoredUser();
  const authenticated = isAuthenticated();
  const initial = authenticated && user.name ? (user.name.trim().charAt(0).toUpperCase() || '?') : '';

  if (navToggle && navToggleAvatar) {
    if (initial) {
      navToggleAvatar.textContent = initial;
      navToggle.classList.add('has-avatar');
    } else {
      navToggleAvatar.textContent = '';
      navToggle.classList.remove('has-avatar');
    }
  }

  const profileHref = user.role === 'driver' ? 'driver-profile.html'
    : user.role === 'passenger' ? 'passenger-profile.html'
    : '#';
  const dashboardHref = user.role === 'driver' ? 'driver.html'
    : user.role === 'passenger' ? 'passenger.html'
    : user.role === 'admin' ? 'admin.html'
    : '#';

  const drawerProfile = document.querySelector('.nav-drawer-profile');
  if (drawerProfile) {
    if (initial) {
      const avatar = drawerProfile.querySelector('.nav-drawer-avatar');
      const name = drawerProfile.querySelector('.nav-drawer-name');
      const role = drawerProfile.querySelector('.nav-drawer-role');
      if (avatar) avatar.textContent = initial;
      if (name) name.textContent = user.name;
      if (role) role.textContent = user.role || '';
      drawerProfile.href = profileHref;
      drawerProfile.classList.add('is-visible');
    } else {
      drawerProfile.classList.remove('is-visible');
    }
  }

  if (!navCta) return;
  let menu = navCta.querySelector('.nav-user-menu');

  if (authenticated && user.name) {
    // Built once and updated in place on later refreshes (not rebuilt every
    // time) — refreshAuthState runs on a poll timer, and rebuilding the DOM
    // each time would force-close the dropdown mid-interaction and require
    // re-attaching its listeners every few seconds.
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'nav-user-menu';
      menu.innerHTML = `
        <button type="button" class="nav-user-trigger" aria-haspopup="true" aria-expanded="false">
          <span class="nav-user-avatar"></span>
        </button>
        <div class="nav-user-dropdown">
          <a class="nav-user-dropdown-header" href="#">
            <strong class="nav-user-dropdown-name"></strong>
            <small class="nav-user-dropdown-role"></small>
          </a>
          <a class="nav-user-dropdown-dashboard" href="#">My Rides</a>
          <a class="nav-user-dropdown-profile" href="#">My profile</a>
          <a class="nav-user-dropdown-history" href="#">Booking history</a>
          <button type="button" data-action="logout">Logout</button>
        </div>
      `;
      navCta.insertBefore(menu, navCta.firstChild);

      const trigger = menu.querySelector('.nav-user-trigger');
      trigger.addEventListener('click', function(event) {
        event.stopPropagation();
        const isOpen = menu.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', function(event) {
        if (!menu.contains(event.target)) {
          menu.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      // Belt-and-suspenders: close on any dropdown item click too, in case
      // navigation doesn't immediately tear down the page (e.g. logout).
      menu.querySelectorAll('.nav-user-dropdown a, .nav-user-dropdown button').forEach(el => {
        el.addEventListener('click', () => menu.classList.remove('is-open'));
      });
    }

    menu.querySelector('.nav-user-avatar').textContent = initial;
    menu.querySelector('.nav-user-dropdown-name').textContent = user.name;
    menu.querySelector('.nav-user-dropdown-role').textContent = user.role || '';

    // The name header opens the profile. Drivers get a chevron on it and
    // no separate "My profile" item; passengers keep their "My profile"
    // item as before. Admin has no profile page, so theirs is a plain label.
    const isDriver = user.role === 'driver';
    const headerLink = menu.querySelector('.nav-user-dropdown-header');
    if (profileHref !== '#') {
      headerLink.href = profileHref;
    } else {
      headerLink.removeAttribute('href');
    }
    headerLink.classList.toggle('has-chevron', isDriver);
    const profileLink = menu.querySelector('.nav-user-dropdown-profile');
    profileLink.href = profileHref;
    profileLink.style.display = profileHref !== '#' && !isDriver ? '' : 'none';

    // The dashboard link is back (2026-10-03). It was dropped on 2026-10-02
    // on the assumption the nav bar had it, but every page's CSS hides the
    // own-dashboard nav link at desktop widths, so desktop drivers and
    // passengers had no way back to the map/booking page. Admin has no
    // dashboard/profile/history links here — their menu is name + Logout.
    const dashboardHref = user.role === 'driver' ? 'driver.html'
      : user.role === 'passenger' ? 'passenger.html'
      : '#';
    const dashboardLink = menu.querySelector('.nav-user-dropdown-dashboard');
    dashboardLink.href = dashboardHref;
    dashboardLink.textContent = user.role === 'driver' ? 'My Rides' : 'Booking';
    dashboardLink.style.display = dashboardHref !== '#' ? '' : 'none';
    // Passengers only: a driver's ride history lives on My Rides itself,
    // under the pending requests, so "My Rides" already covers it.
    const historyHref = user.role === 'passenger' ? 'passenger-bookings.html' : '#';
    const historyLink = menu.querySelector('.nav-user-dropdown-history');
    historyLink.href = historyHref;
    historyLink.textContent = user.role === 'driver' ? 'Ride history' : 'Booking history';
    historyLink.style.display = historyHref !== '#' ? '' : 'none';
  } else if (menu) {
    menu.remove();
  }
}
 
function isAuthenticated() {
  return Boolean(getStoredUser().role) && sessionStorage.getItem('isAuthenticated') === 'true';
}
 
function redirectToDashboard(role) {
  if (!role) return;
  if (role === 'passenger') location.replace('passenger.html');
  if (role === 'driver') location.replace('driver.html');
  if (role === 'admin') location.replace('admin.html');
}
 
function enforceDashboardAccess() {
  const page = document.body.getAttribute('data-page');
  const allowedRoles = ['passenger', 'driver', 'admin'];
  const user = getStoredUser();

  // Every "Sign up" / "Get started" link on the site points at auth.html,
  // which showed the Register form even to someone already logged in.
  // Send them to their own dashboard instead, whatever their role.
  if (page === 'auth' && isAuthenticated()) {
    redirectToDashboard(user.role);
    return;
  }

  if (!allowedRoles.includes(page)) return;
 
  if (!isAuthenticated()) {
    if (page === 'admin') {
      return;
    }
    location.replace('auth.html');
    return;
  }
 
  if (page === 'admin' && user.role !== 'admin') {
    redirectToDashboard(user.role);
    return;
  }
 
  if (page !== user.role && allowedRoles.includes(page)) {
    redirectToDashboard(user.role);
  }
}

function hideAdminLinkForNonAdmin() {
  const adminLink = document.querySelector('.nav-links a[data-page="admin"]');
  const user = getStoredUser();
  if (!adminLink) return;
  if (!isAuthenticated() || user.role !== 'admin') {
    adminLink.classList.add('hidden');
  } else {
    adminLink.classList.remove('hidden');
  }
}

// Shows a friendly heads-up on the driver dashboard when the logged-in
// driver's account is still "Pending" — they can log in and look around,
// but rideController.acceptRide will reject any accept attempt until an
// admin flips their account_status to "Active".
function showDriverApprovalBanner() {
  const banner = document.querySelector('#driver-approval-banner');
  if (!banner) return;
  const user = getStoredUser();
  if (isAuthenticated() && user.role === 'driver' && user.accountStatus === 'Pending') {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// A driver's accountStatus is cached in sessionStorage from whenever they
// last logged in/registered — it doesn't update on its own when an admin
// approves them mid-session, which left the "pending approval" banner (and
// the "Offline" toggle it implies) stuck showing even after approval. This
// re-checks the real value from the server and refreshes the cached copy
// (which also re-renders the banner, via setStoredUser -> refreshAuthState)
// whenever it actually changed.
async function syncDriverAccountStatus() {
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  const profile = await fetchProfile();
  if (!profile || !profile.account_status) return;

  // Unverified drivers can no longer log in (see loginDriver), but a session
  // started before that rule, or one an admin has since rejected, is still
  // holding a token. Send it back to the login form, which explains why.
  if (profile.account_status === 'Pending' || profile.account_status === 'Rejected') {
    clearStoredUser();
    location.replace('auth.html?tab=login');
    return;
  }

  if (profile.account_status !== user.accountStatus) {
    setStoredUser({ ...user, accountStatus: profile.account_status });
  }
}

// Driver.html is a protected page for role "driver" only. Same rule as the
// Admin link: hidden unless you are actually logged in as a driver.
function updateDriverLinkVisibility() {
  const driverLink = document.querySelector('.nav-links a[data-page="driver"]');
  if (!driverLink) return;
  const user = getStoredUser();
  if (isAuthenticated() && user.role === 'driver') {
    driverLink.classList.remove('hidden');
  } else {
    driverLink.classList.add('hidden');
  }
}


// Same pattern, the passenger-side equivalent of the Driver link — takes a
// logged-in passenger back to their own dashboard (passenger.html) from
// anywhere else in the app, e.g. the Profile page.
function updatePassengerLinkVisibility() {
  const passengerLink = document.querySelector('.nav-links a[data-page="passenger"]');
  if (!passengerLink) return;
  const user = getStoredUser();
  if (isAuthenticated() && user.role === 'passenger') {
    passengerLink.classList.remove('hidden');
  } else {
    passengerLink.classList.add('hidden');
  }
}

// The marketing links (About Us/How It Works/Get Started) live in the same
// .nav-links markup at both the mobile drawer AND (on index.html and the
// other marketing pages) the real desktop nav row — so hiding them once
// logged in is only wanted in the drawer; at desktop widths they should
// keep showing regardless of auth state. Uses its own class (not the
// blanket .hidden utility, which is display:none at every width) so each
// page's CSS can scope the actual hiding to mobile only.
function updateMarketingLinksVisibility() {
  const authenticated = isAuthenticated();
  document.querySelectorAll('.nav-links a[data-page="about"], .nav-links a[data-page="how-it-works"], .nav-links a[data-page="getting-started"]').forEach(function(link) {
    link.classList.toggle('nav-marketing-link-hide-mobile', authenticated);
  });
  // "Get Started" is the sign-up walkthrough, so it's of no use to someone
  // already logged in; hidden for them at every width.
  document.querySelectorAll('.nav-links a[data-page="getting-started"]').forEach(function(link) {
    link.classList.toggle('hidden', authenticated);
  });
}

// Driver/passenger logout now lives on their Profile page (reached via the
// clickable nav-cta avatar badge — see renderAuthStatus), so this nav-links
// item is hidden entirely for them once signed in. Admin has no profile
// page, so it keeps the old relabel-to-"Logout" behavior — otherwise admin
// would have no way to log out on mobile, where nav-cta (and its Logout
// button) is hidden below the hamburger breakpoint.
function updateLoginNavLinkLabel() {
  const user = getStoredUser();
  const authenticated = isAuthenticated();
  const isDriverOrPassenger = user.role === 'driver' || user.role === 'passenger';

  // Driver/passenger logout lives on desktop-only surfaces now (the nav-cta
  // avatar dropdown, or the Profile page) — .nav-cta itself is hidden below
  // the drawer breakpoint, so mobile needs its own dedicated Logout row
  // inside the drawer. This button (unused until now) was already styled
  // for exactly this in every page's CSS — see .nav-row-logout.
  const mobileLogoutBtn = document.querySelector('.nav-links .nav-row-logout');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.classList.toggle('hidden', !(authenticated && isDriverOrPassenger));
  }

  const loginLink = document.querySelector('.nav-links a[data-page="auth"]');
  if (!loginLink) return;

  if (!authenticated || isDriverOrPassenger) {
    // Guests already have "Book a ride" for this; driver/passenger use the
    // dedicated Logout row above instead. Either way this row is redundant.
    loginLink.classList.add('hidden');
    return;
  }

  // Only admin reaches here (authenticated, not driver/passenger) — admin
  // has no profile page or desktop dropdown, so this stays as their one
  // mobile logout row.
  loginLink.classList.remove('hidden');
  const label = loginLink.querySelector('span');
  if (label) {
    label.textContent = 'Logout';
  } else {
    loginLink.textContent = 'Logout';
  }
}

function setupLoginNavLink() {
  const loginLink = document.querySelector('.nav-links a[data-page="auth"]');
  if (!loginLink) return;

  loginLink.addEventListener('click', function(event) {
    if (isAuthenticated()) {
      event.preventDefault();
      clearStoredUser();
      window.location.href = 'index.html';
    }
    // Not authenticated: let the link behave normally and navigate to auth.html.
  });

  updateLoginNavLinkLabel();
}
 
function setupAdminLoginForm() {
  const adminLoginForm = document.querySelector('#admin-login-form');
  if (!adminLoginForm) return;
 
  adminLoginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.querySelector('#admin-name').value.trim();
    const password = document.querySelector('#admin-password').value.trim();
    const errorEl = document.querySelector('#admin-login-error');
    if (errorEl) errorEl.textContent = '';

    if (!username || !password) {
      if (errorEl) errorEl.textContent = 'Please enter both name and password.';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        if (errorEl) errorEl.textContent = data.error || 'Invalid admin credentials.';
        return;
      }

      setStoredUser({ name: data.user.name, role: data.user.role, email: data.user.username, token: data.token }, true);
      redirectToDashboard('admin');
    } catch (error) {
      console.error('Admin login request failed', error);
      if (errorEl) errorEl.textContent = 'Could not connect to the server. Please make sure the backend is running.';
    }
  });
}
 
function showAdminDashboardIfLoggedIn() {
  const page = document.body.getAttribute('data-page');
  if (page !== 'admin') return;
 
  const user = getStoredUser();
  const loginSection = document.querySelector('#admin-login-section');
  const dashboardSection = document.querySelector('#admin-dashboard-section');
 
  if (!dashboardSection || !loginSection) return;

  const authed = isAuthenticated() && user.role === 'admin';
  loginSection.classList.toggle('hidden', authed);
  dashboardSection.classList.toggle('hidden', !authed);
  // Topbar's "Admin" chip + Logout button — hidden until actually logged in,
  // same rule as the dashboard section itself.
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !authed));
}

// index.html's nav-cta has a static "Sign in" link — hide it once someone
// browses back to the home page already logged in (the avatar badge next to
// it covers account access instead). Safe no-op on every page without
// #cta-signup.
function updateHomeCtaVisibility() {
  const signupLink = document.querySelector('#cta-signup');
  const hide = isAuthenticated() ? 'none' : '';
  if (signupLink) signupLink.style.display = hide;
  // #cta-signup-drawer's own visibility is handled by updateLoginNavLinkLabel()
  // now that it carries data-page="auth" like every other page's drawer Login
  // row — same guest-hidden / driver-passenger-hidden / admin-Logout rules.
}

// LOYALTY / REWARDS — only present on passenger-rewards.html, so this is a
// safe no-op on every other page (all the elements it looks for won't exist).
// Mirrors LOYALTY_MILESTONE_STEP in rideController.js -- only used here to
// size the progress ring/dots (always a fresh 5-ride bar per certificate);
// the server is what actually enforces the real threshold.
const LOYALTY_MILESTONE_STEP_CLIENT = 5;

async function fetchLoyaltyStatus() {
  const role = getStoredUser().role;
  const endpoint = role === 'driver' ? 'driver-loyalty' : 'loyalty';
  try {
    const res = await fetch(`${RIDES_API_URL}/${endpoint}`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn('Unable to fetch loyalty status', error);
    return null;
  }
}

async function renderLoyaltyStatus() {
  const loadingEl = document.querySelector('#loyalty-loading');
  const detailsEl = document.querySelector('#loyalty-details');
  if (!loadingEl || !detailsEl) return;

  const data = await fetchLoyaltyStatus();
  if (!data) {
    loadingEl.textContent = 'Unable to load your loyalty status right now.';
    return;
  }

  // nextThreshold/progressWithinLeg/awaitingGrant/latestCertificate all
  // come from buildLoyaltyStatus() server-side — see rideController.js.
  const { completedRides, nextThreshold, progressWithinLeg, awaitingGrant, latestCertificate } = data;

  // Per explicit request: the WHOLE loyalty section — not just the
  // certificate — stays out of the UI entirely (both dashboard teaser
  // card and profile-page card, both roles) until an admin has actually
  // granted at least one certificate. No progress ring/milestone teaser
  // visible before that first grant.
  const outerCardEl = document.querySelector('#loyalty-card') || document.querySelector('#loyalty-teaser-card');
  if (outerCardEl) outerCardEl.style.display = latestCertificate ? '' : 'none';
  if (!latestCertificate) return;
  // The ring always reads "rides / next target" and keeps climbing as the
  // passenger books. Once a target is reached its certificate waits for the
  // admin, and the ring moves on to the next one: 11 rides with the 10-ride
  // certificate pending shows 11/15, one dot filled.
  const step = LOYALTY_MILESTONE_STEP_CLIENT;
  // Exactly on the target shows a full ring (10/10); the next ride starts the next leg.
  const pastTarget = completedRides > nextThreshold;
  const ringTarget = pastTarget ? (Math.floor(completedRides / step) + 1) * step : nextThreshold;
  const ringProgress = pastTarget ? completedRides - (ringTarget - step) : progressWithinLeg;
  const percent = Math.min(100, Math.round((ringProgress / step) * 100));
  const role = getStoredUser().role;
  const title = role === 'driver' ? 'Loyal Driver' : 'Loyal Passenger';

  // Real ride count over the ring's target, so it matches the
  // "N completed rides" line under it (never a capped "10/10" next to "11").
  const counterEl = document.querySelector('#loyalty-current').parentNode;
  counterEl.innerHTML = `<span id="loyalty-current">${completedRides}</span>/<span id="loyalty-threshold">${ringTarget}</span>`;

  const ringFill = document.querySelector('#loyalty-ring-fill');
  if (ringFill) {
    const circumference = 2 * Math.PI * 44;
    ringFill.setAttribute('stroke-dasharray', circumference.toFixed(1));
    ringFill.style.strokeDashoffset = circumference - (circumference * percent / 100);
  }

  const milestonesEl = document.querySelector('#loyalty-milestones');
  if (milestonesEl) {
    milestonesEl.innerHTML = Array.from({ length: LOYALTY_MILESTONE_STEP_CLIENT }, (_, i) =>
      `<span class="milestone-dot${i < ringProgress ? ' is-filled' : ''}"></span>`
    ).join('');
  }

  const roleWordEl = document.querySelector('#loyalty-role-word');
  if (roleWordEl) roleWordEl.textContent = role === 'driver' ? 'Driver' : 'Passenger';

  // The grey line under the ring says where they stand; the message below
  // it says what happens next. They used to repeat each other.
  const statsSubEl = document.querySelector('#loyalty-stats-sub');
  // Two short lines instead of one long one, which wrapped with a lone
  // "earned" on a narrow card.
  if (statsSubEl) {
    statsSubEl.innerHTML = `
      <span class="rewards-stats-line">${completedRides} completed ride${completedRides === 1 ? '' : 's'}</span>
      <span class="rewards-stats-line">${latestCertificate.milestoneRides}-ride certificate earned</span>`;
  }

  const messageEl = document.querySelector('#loyalty-message');
  messageEl.classList.remove('eligible', 'in-progress');
  if (awaitingGrant) {
    messageEl.textContent = `🎉 ${nextThreshold} rides reached! Your ${nextThreshold}-ride certificate is waiting for the TODA admin's approval.`;
    messageEl.classList.add('eligible');
  } else {
    const remaining = nextThreshold - completedRides;
    messageEl.textContent = `${remaining} more completed ride${remaining === 1 ? '' : 's'} to earn your ${nextThreshold}-ride certificate.`;
    messageEl.classList.add('in-progress');
  }

  // The dashboard teaser's button opens the certificate they already have;
  // say which one, so it isn't mistaken for the one still awaiting approval.
  const teaserLink = document.querySelector('.rewards-teaser-link');
  if (teaserLink) {
    teaserLink.textContent = `View your ${latestCertificate.milestoneRides}-ride certificate`;
    if (!/#loyalty-card$/.test(teaserLink.getAttribute('href') || '')) {
      teaserLink.setAttribute('href', `${teaserLink.getAttribute('href')}#loyalty-card`);
    }
  }

  const certificateEl = document.querySelector('#loyalty-certificate');
  const downloadBtn = document.querySelector('#certificate-download-btn');
  if (certificateEl) {
    if (latestCertificate) {
      const user = getStoredUser();
      const headingEl = certificateEl.querySelector('#certificate-heading');
      const nameEl = certificateEl.querySelector('#certificate-name');
      const countEl = certificateEl.querySelector('#certificate-count');
      const titleEl = certificateEl.querySelector('#certificate-title');
      const dateEl = certificateEl.querySelector('#certificate-date');
      if (headingEl) headingEl.textContent = `${title} Award`;
      if (nameEl) nameEl.textContent = user.name || 'GoTSUian Member';
      if (countEl) countEl.textContent = latestCertificate.milestoneRides;
      if (titleEl) titleEl.textContent = title;
      if (dateEl) dateEl.textContent = new Date(latestCertificate.grantedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      certificateEl.style.display = 'block';
      if (downloadBtn) downloadBtn.classList.remove('hidden');
    } else {
      certificateEl.style.display = 'none';
      if (downloadBtn) downloadBtn.classList.add('hidden');
    }
  }

  loadingEl.style.display = 'none';
  detailsEl.style.display = 'block';
}

// Renders #loyalty-certificate to a PNG and downloads it — button is a
// sibling of the certificate (not inside it), so it's never captured in
// the exported image. Safe no-op on any page without the button/library.
function setupCertificateDownload() {
  const btn = document.querySelector('#certificate-download-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const certEl = document.querySelector('#loyalty-certificate');
    if (!certEl || typeof html2canvas === 'undefined') return;

    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const canvas = await html2canvas(certEl, { backgroundColor: '#fffaf3', scale: 2 });
      const link = document.createElement('a');
      link.download = 'GoTSUian-Loyalty-Certificate.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.warn('Unable to generate certificate image', error);
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}

// DRIVER RATING — only present on driver-profile.html, so this is a safe
// no-op on every other page.
async function renderDriverRating() {
  const loadingEl = document.querySelector('#rating-loading');
  const detailsEl = document.querySelector('#rating-details');
  if (!loadingEl || !detailsEl) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  try {
    const res = await fetch(`${REVIEWS_API_URL}/mine`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    document.querySelector('#rating-average').textContent = data.average.toFixed(1);
    document.querySelector('#rating-count').textContent = `(${data.count} review${data.count === 1 ? '' : 's'})`;

    const listEl = document.querySelector('#rating-list');
    listEl.innerHTML = data.reviews.slice(0, 5).map(r => `
      <div class="rating-item">
        <p class="rating-item-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} <span>${escapeHtml(r.passenger_name)}</span></p>
        ${r.comment ? `<p class="rating-item-comment">${escapeHtml(r.comment)}</p>` : ''}
      </div>
    `).join('') || '<p class="rating-empty">No reviews yet.</p>';

    loadingEl.style.display = 'none';
    detailsEl.style.display = 'block';
  } catch (error) {
    console.warn('Unable to fetch driver rating', error);
  }
}

// DRIVER RATINGS (FULL) — only present on driver-bookings.html, so this is a
// safe no-op on every other page. Reuses the same GET /api/reviews/mine
// endpoint as the dashboard preview above, but renders every review (not
// sliced to 5) plus a per-star breakdown computed client-side from
// data.reviews — no backend changes needed.
async function renderDriverRatingsFull() {
  const loadingEl = document.querySelector('#driver-ratings-loading');
  const detailsEl = document.querySelector('#driver-ratings-details');
  if (!loadingEl || !detailsEl) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  try {
    const res = await fetch(`${REVIEWS_API_URL}/mine`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    document.querySelector('#driver-ratings-average').textContent = data.average.toFixed(1);
    document.querySelector('#driver-ratings-star-row').textContent =
      '★'.repeat(Math.round(data.average)) + '☆'.repeat(5 - Math.round(data.average));
    document.querySelector('#driver-ratings-count').textContent =
      `${data.count} review${data.count === 1 ? '' : 's'}`;

    const counts = [0, 0, 0, 0, 0]; // counts[0] = # of 1-star ... counts[4] = # of 5-star
    data.reviews.forEach(r => { counts[r.rating - 1]++; });

    document.querySelector('#driver-ratings-breakdown').innerHTML = [5, 4, 3, 2, 1].map(star => {
      const count = counts[star - 1];
      const pct = data.count ? Math.round((count / data.count) * 100) : 0;
      return `
        <div class="rating-breakdown-row">
          <span class="rating-breakdown-label">${star}★</span>
          <div class="rating-breakdown-bar"><div class="rating-breakdown-fill" style="width:${pct}%"></div></div>
          <span class="rating-breakdown-count${count ? ' has-count' : ''}">${count}</span>
        </div>`;
    }).join('');

    document.querySelector('#driver-reviews-list').innerHTML = data.reviews.map(r => {
      const initial = (r.passenger_name || '?').trim().charAt(0).toUpperCase();
      const formattedDate = new Date(r.created_at).toLocaleDateString();
      return `
        <div class="rating-item">
          <div class="rating-item-head">
            <div class="rating-item-who">
              <span class="rating-item-avatar">${escapeHtml(initial)}</span>
              <div class="rating-item-meta">
                <strong class="rating-item-name">${escapeHtml(r.passenger_name)}</strong>
                <small class="rating-item-date">${escapeHtml(formattedDate)}</small>
              </div>
            </div>
            <span class="rating-item-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          <p class="rating-item-comment">${r.comment ? escapeHtml(r.comment) : '<em>No comment left.</em>'}</p>
        </div>`;
    }).join('') || '<p class="rating-empty">No reviews yet.</p>';

    loadingEl.style.display = 'none';
    detailsEl.style.display = 'block';
  } catch (error) {
    console.warn('Unable to fetch driver ratings', error);
  }
}

// ACCOUNT STANDING — a driver/passenger's own warning/violation history, on
// their Profile page. Only present on driver-profile.html /
// passenger-profile.html, so this is a safe no-op everywhere else.
async function renderMyViolations() {
  const loadingEl = document.querySelector('#warnings-loading');
  const detailsEl = document.querySelector('#warnings-details');
  if (!loadingEl || !detailsEl) return;

  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'driver' && user.role !== 'passenger')) return;

  try {
    const res = await fetch(`${COMPLAINTS_API_URL}/my-violations`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    document.querySelector('#warnings-count').textContent = data.count;

    const listEl = document.querySelector('#warnings-list');
    listEl.innerHTML = data.violations.map(v => `
      <div class="rating-item">
        <p class="warning-item-severity tone-${v.severity === 'Violation' ? 'danger' : 'warning'}">${escapeHtml(v.severity)}${v.escalated ? ' <small>(auto-escalated)</small>' : ''}</p>
        <p class="rating-item-comment">${escapeHtml(v.reason)}</p>
        <small>${new Date(v.created_at).toLocaleDateString()} &middot; Issued by admin</small>
      </div>
    `).join('') || '<p class="rating-empty">No warnings or violations on record. Keep it up!</p>';

    loadingEl.style.display = 'none';
    detailsEl.style.display = 'block';
  } catch (error) {
    console.warn('Unable to fetch account standing', error);
  }
}

// ACCOUNT STANDING (redesigned) — a collapsed, FAQ-style summary row shown
// on both dashboards (driver.html — between "Your rating" and "Loyalty
// Rewards" — and passenger.html, before "Loyalty Rewards") and on the
// driver bookings page. Same /my-violations data as renderMyViolations()
// above, but a different presentation (collapsed by default) — kept as its
// own function/ids rather than reworking the older Profile-page card,
// which no longer has any markup on either profile page (both moved to
// this redesigned dashboard version).
async function renderAccountStanding() {
  const loadingEl = document.querySelector('#standing-loading');
  const wrapEl = document.querySelector('#standing-wrap');
  if (!loadingEl || !wrapEl) return;

  const user = getStoredUser();
  // Login normalizes the backend's "student" role to "passenger" for
  // everything client-side (see setupAuthForm's login handler) — checking
  // for "student" here meant this always fell through silently for
  // passengers, leaving #standing-loading stuck forever since the function
  // returned before ever hiding it.
  if (!isAuthenticated() || (user.role !== 'driver' && user.role !== 'passenger')) return;

  try {
    const res = await fetch(`${COMPLAINTS_API_URL}/my-violations`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    const iconEl = document.querySelector('#standing-icon');
    const summaryEl = document.querySelector('#standing-summary');
    const hasWarnings = data.count > 0;
    if (iconEl) iconEl.classList.toggle('has-warnings', hasWarnings);
    if (summaryEl) {
      summaryEl.textContent = hasWarnings
        ? `${data.count} warning(s)/violation(s) on record`
        : 'No warnings or violations on record';
    }

    const listEl = document.querySelector('#standing-list');
    if (listEl) {
      listEl.innerHTML = data.violations.map(v => `
        <div class="rating-item">
          <p class="warning-item-severity tone-${v.severity === 'Violation' ? 'danger' : 'warning'}">${escapeHtml(v.severity)}${v.escalated ? ' <small>(auto-escalated)</small>' : ''}</p>
          <p class="rating-item-comment">${escapeHtml(v.reason)}</p>
          <small>${new Date(v.created_at).toLocaleDateString()} &middot; Issued by admin</small>
        </div>
      `).join('') || '<p class="rating-empty">No warnings or violations on record. Keep it up!</p>';
    }

    loadingEl.style.display = 'none';
    wrapEl.style.display = 'block';
  } catch (error) {
    console.warn('Unable to fetch account standing', error);
  }
}

// MY REPORTS — a passenger/driver could file a complaint (createComplaint)
// but had no way to see what happened to it afterward: admin's Reviewed/
// Resolved status and any admin_notes were only ever shown on the admin
// side (GET /api/complaints/mine already returned this, nothing on the
// frontend ever called it). Same collapsed-summary presentation as
// #standing-card right above it, reusing its .standing-* classes — the
// existing setupAccountStandingToggle() below already wires up any
// .standing-toggle button generically, so no new toggle JS is needed.
async function renderMyReports() {
  const loadingEl = document.querySelector('#reports-loading');
  const wrapEl = document.querySelector('#reports-wrap');
  if (!loadingEl || !wrapEl) return;

  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'driver' && user.role !== 'passenger')) return;

  try {
    const res = await fetch(`${COMPLAINTS_API_URL}/mine`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const complaints = data.complaints || [];
    const pendingCount = complaints.filter(c => c.status !== 'Resolved').length;

    const iconEl = document.querySelector('#reports-icon');
    const summaryEl = document.querySelector('#reports-summary');
    if (iconEl) iconEl.classList.toggle('has-warnings', pendingCount > 0);
    if (summaryEl) {
      summaryEl.textContent = complaints.length
        ? `${complaints.length} report(s) filed${pendingCount ? `, ${pendingCount} awaiting review` : ''}`
        : 'No reports filed';
    }

    const statusTone = { Pending: 'warning', Reviewed: 'info', Resolved: 'success' };

    const listEl = document.querySelector('#reports-list');
    if (listEl) {
      listEl.innerHTML = complaints.map(c => `
        <div class="rating-item">
          <div class="reports-item-head">
            <span class="ride-badge tone-${statusTone[c.status] || 'warning'}">${escapeHtml(c.status)}</span>
            <small>${new Date(c.created_at).toLocaleDateString()}</small>
          </div>
          <p class="rating-item-comment"><strong>${escapeHtml(c.category)}</strong>${c.against_name ? ` &middot; against ${escapeHtml(c.against_name)}` : ''}</p>
          <p class="rating-item-comment">${escapeHtml(c.description)}</p>
          ${c.admin_notes ? `<p class="rating-item-comment reports-admin-note"><strong>Admin note:</strong> ${escapeHtml(c.admin_notes)}</p>` : ''}
        </div>
      `).join('') || '<p class="rating-empty">You haven\'t filed any reports.</p>';
    }

    loadingEl.style.display = 'none';
    wrapEl.style.display = 'block';
  } catch (error) {
    console.warn('Unable to fetch my reports', error);
  }
}

// rules.html only: clicking the hero's Warning/Violation legend chip steps
// the matching severity cards forward (in both the Students/Passengers and
// Drivers card grids) and dims the rest, via a body-level filter class the
// CSS reads. Clicking the active chip again clears the filter.
function setupRulesLegendFilter() {
  const chips = document.querySelectorAll('.rules-legend-chip');
  if (!chips.length) return;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      const wasActive = chip.classList.contains('is-active');
      chips.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      document.body.classList.remove('filter-warning', 'filter-violation');
      if (!wasActive) {
        chip.classList.add('is-active');
        chip.setAttribute('aria-pressed', 'true');
        document.body.classList.add(`filter-${filter}`);
      }
    });
  });
}

function setupAccountStandingToggle() {
  document.querySelectorAll('.standing-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.parentElement.querySelector('.standing-panel');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (panel) panel.classList.toggle('open', !isOpen);
    });
  });
}

// PROFILE — only present on passenger-profile.html, so this is a safe
// no-op on every other page.
async function fetchProfile() {
  try {
    const res = await fetch(PROFILE_API_URL, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile || null;
  } catch (error) {
    console.warn('Unable to fetch profile', error);
    return null;
  }
}

async function updateProfileRemote(payload) {
  const res = await fetch(PROFILE_API_URL, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to update profile');
  return data;
}

async function renderProfile() {
  const loadingEl = document.querySelector('#profile-loading');
  const formEl = document.querySelector('#profile-form');
  if (!loadingEl || !formEl) return;

  const profile = await fetchProfile();
  if (!profile) {
    loadingEl.textContent = 'Unable to load your profile right now.';
    return;
  }

  document.querySelector('#profile-fname').value = profile.first_name || '';
  document.querySelector('#profile-mname').value = profile.middle_name || '';
  document.querySelector('#profile-lname').value = profile.last_name || '';
  document.querySelector('#profile-contact').value = profile.contact_number || '';
  document.querySelector('#profile-birthdate').value = profile.birth_date ? profile.birth_date.slice(0, 10) : '';
  document.querySelector('#profile-age').value = profile.age || '';
  document.querySelector('#profile-sex').value = profile.sex || '';
  document.querySelector('#profile-address').value = profile.current_address || '';

  const noteEl = document.querySelector('#profile-readonly-note');
  if (noteEl) {
    if (profile.student_number) {
      noteEl.textContent = `Student number: ${profile.student_number} (not editable here)`;
    } else if (profile.driver_license_no) {
      noteEl.textContent = `Driver's license no: ${profile.driver_license_no} (not editable here)`;
    }
  }

  loadingEl.style.display = 'none';
  formEl.style.display = '';
}

function setupProfileForm() {
  const form = document.querySelector('#profile-form');
  if (!form) return;

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    const errorEl = document.querySelector('#profile-error');
    if (errorEl) errorEl.textContent = '';

    const payload = {
      first_name: document.querySelector('#profile-fname').value.trim(),
      middle_name: document.querySelector('#profile-mname').value.trim(),
      last_name: document.querySelector('#profile-lname').value.trim(),
      contact_number: document.querySelector('#profile-contact').value.trim(),
      birth_date: document.querySelector('#profile-birthdate').value || null,
      age: document.querySelector('#profile-age').value || null,
      sex: document.querySelector('#profile-sex').value || null,
      current_address: document.querySelector('#profile-address').value.trim()
    };

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await updateProfileRemote(payload);
      if (submitButton) {
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Saved!';
        setTimeout(() => { submitButton.textContent = originalText; }, 2000);
      }
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Could not save your changes.';
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// CHANGE PASSWORD — nested inside the "Profile details" card on both
// passenger-profile.html and driver-profile.html, so this is a safe no-op
// elsewhere. Unlike Forgot Password (students only, since that's the only
// role with an email on file to send an OTP to), this doesn't need email
// at all — just the current password — so both roles get it the same way.
function setupChangePasswordForm() {
  const form = document.querySelector('#change-password-form');
  if (!form) return;

  const role = getStoredUser().role === 'driver' ? 'driver' : 'student';

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    const errorEl = document.querySelector('#change-password-error');
    const successEl = document.querySelector('#change-password-success');
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.style.display = 'none';

    const currentPassword = document.querySelector('#current-password').value;
    const newPassword = document.querySelector('#new-password').value;
    const confirmNewPassword = document.querySelector('#confirm-new-password').value;

    if (newPassword.length < 8) {
      if (errorEl) errorEl.textContent = 'New password must be at least 8 characters.';
      return;
    }
    if (newPassword !== confirmNewPassword) {
      if (errorEl) errorEl.textContent = 'New password and confirmation do not match.';
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const res = await fetch(`${API_BASE_URL}/change-password/${role}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change your password.');

      form.reset();
      if (successEl) successEl.style.display = 'block';
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// PASSENGER MAP — only present on passenger.html, so this is a safe no-op
// everywhere else. Static markers for now (the two fixed campus points);
// GPS tracking gets layered on top of this once the map itself works.
let passengerMapInstance = null;
let driverLocationMarker = null;

// Hard pan/zoom limit for both maps — maxBoundsViscosity: 1.0 below makes it
// completely rigid, so this is the literal edge of the world as far as anyone
// dragging the map is concerned.
//
// These are the administrative bounds of TARLAC PROVINCE, matching
// TARLAC_VIEWBOX in rideController.js (keep the two in step). The previous
// values were a ~33km box around Tarlac City whose southern wall fell at
// 15.35, which put a dead stop in the middle of Capas: the map simply
// refused to scroll past Barangay Dolores (15.3696), and Concepcion, Bamban
// and Camiling could not be reached at all. That looked like missing map
// data rather than a deliberate limit, because the drag just stopped.
//
// The old comment justified it as "a system that only ever serves two fixed
// points a few km apart" — no longer true since pickup became the
// passenger's own GPS position and drop-off became any address.
const TARLAC_BOUNDS = [[15.15, 120.15], [15.89, 120.80]];

// GoTSUian's service area is the same box: a GPS pickup outside it can't be
// booked (the server refuses it too, see isOutsideServiceArea).
function isInsideServiceArea(lat, lng) {
  return lat >= TARLAC_BOUNDS[0][0] && lat <= TARLAC_BOUNDS[1][0]
    && lng >= TARLAC_BOUNDS[0][1] && lng <= TARLAC_BOUNDS[1][1];
}
const OUTSIDE_AREA_MESSAGE = 'GoTSUian only serves Tarlac, and your current location is outside the service area. To book for someone in Tarlac, tap "Change pickup".';

// "Your pickup" pin on the passenger map before a ride exists, so the map
// moves to where they are instead of staying on its default view. Removed as
// soon as a ride starts, which draws its own A/B pins.
let pickupPreviewMarker = null;

function showPickupPreview(lat, lng) {
  if (!passengerMapInstance || driverTrackedRideId !== null) return;
  if (!isInsideServiceArea(lat, lng)) return clearPickupPreview();
  const point = [lat, lng];
  if (!pickupPreviewMarker) {
    pickupPreviewMarker = L.marker(point, { icon: ridePinIcon('A', 'pickup'), zIndexOffset: 1000 })
      .addTo(passengerMapInstance)
      .bindPopup('Your pickup');
  } else {
    pickupPreviewMarker.setLatLng(point);
  }
  passengerMapInstance.setView(point, 16);
}

function clearPickupPreview() {
  if (pickupPreviewMarker && passengerMapInstance) passengerMapInstance.removeLayer(pickupPreviewMarker);
  pickupPreviewMarker = null;
}

function setupPassengerMap() {
  const mapEl = document.querySelector('#map');
  if (!mapEl || typeof L === 'undefined') return;

  passengerMapInstance = L.map('map', {
    minZoom: 10,
    maxBounds: TARLAC_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView([15.494, 120.583], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(passengerMapInstance);

  watchMapContainerSize(mapEl, passengerMapInstance);
}

// Leaflet caches the map's pixel size from whenever it (or its tiles) were
// last measured and never re-checks on its own — anything that changes the
// container's actual size afterward (content above it loading in, a ride
// status panel appearing, a card collapsing, a font/image finishing load,
// even just a browser chrome resize) leaves the map rendering at its stale
// size, overflowing/cropped against the container's real, current size.
// Guessing every single moment that could happen (a single requestAnimation-
// Frame after one specific render call) turned out not to cover every case
// in practice. ResizeObserver instead watches the container directly and
// calls invalidateSize() on ANY actual size change, whatever the cause —
// timing-independent, and supported in every browser this app targets.
function watchMapContainerSize(mapEl, mapInstance) {
  if (typeof ResizeObserver === 'undefined') return;
  let lastW = 0;
  let lastH = 0;
  const observer = new ResizeObserver((entries) => {
    const box = entries[0].contentRect;
    if (Math.round(box.width) === lastW && Math.round(box.height) === lastH) return;
    lastW = Math.round(box.width);
    lastH = Math.round(box.height);
    mapInstance.invalidateSize();
  });
  observer.observe(mapEl);
}

// Polls for the assigned driver's live position while there's an active
// ride, and creates/moves/removes a marker for it — the map has no other
// pins until this one appears. Only present on passenger.html — safe no-op
// everywhere else.
let driverTrackedRideId = null;

// There is deliberately no pre-drawn route line on the passenger map. An
// earlier version drew one of the two fixed campus routes as a reference
// line, but that shows where the driver is EXPECTED to go, not where they
// actually went — if the driver deviates, the passenger would see two
// conflicting lines. Instead, this trail is the ONLY line shown: it
// accumulates the driver's real GPS pings as they arrive, so the line is
// always literally "the path the driver actually drove," never a guess.
let driverActualTrail = null;
let driverActualTrailPoints = [];

// Pickup/drop-off pins are independent of the trail — they mark the two
// fixed campus endpoints for this ride and never move, regardless of what
// path the driver ends up taking between them.
let driverPickupPin = null;
let driverDropoffPin = null;
// The maroon pickup-to-drop-off road line on the passenger's map, the same
// line the driver sees on theirs.
let passengerRouteLine = null;
let passengerRouteIsRoad = false;
let passengerRouteLoading = false;
const CAMPUS_PIN_COORDS = {
  sanIsidro: [15.502749, 120.578693],
  mainCampus: [15.485127, 120.587373]
};

// Coordinates come back from the API as strings often enough that a plain
// truthiness check isn't enough, and a half-present pair has to read as "no
// point" rather than quietly becoming NaN on the map.
function ridePoint(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return [latNum, lngNum];
}

// A ride stores where it actually starts and ends, so those coordinates are
// the truth. The campus lookup below is only a fallback for older rides
// saved before coordinates were recorded — on its own it would drop any
// non-campus location onto Main Campus, since that's its "not San Isidro"
// branch.
function getPinCoords(locationText, lat, lng) {
  return ridePoint(lat, lng)
    || ((locationText || '').includes('San Isidro') ? CAMPUS_PIN_COORDS.sanIsidro : CAMPUS_PIN_COORDS.mainCampus);
}

function clearDriverTracking() {
  if (driverLocationMarker) {
    passengerMapInstance.removeLayer(driverLocationMarker);
    driverLocationMarker = null;
  }
  if (driverActualTrail) {
    passengerMapInstance.removeLayer(driverActualTrail);
    driverActualTrail = null;
  }
  if (driverPickupPin) {
    passengerMapInstance.removeLayer(driverPickupPin);
    driverPickupPin = null;
  }
  if (driverDropoffPin) {
    passengerMapInstance.removeLayer(driverDropoffPin);
    driverDropoffPin = null;
  }
  if (passengerRouteLine) {
    passengerMapInstance.removeLayer(passengerRouteLine);
    passengerRouteLine = null;
  }
  passengerRouteIsRoad = false;
  driverActualTrailPoints = [];
  driverTrackedRideId = null;
  const legend = document.querySelector('#route-legend');
  if (legend) legend.style.display = 'none';
}

// Still used by the driver's own map (renderDriverMapTracking) below, which
// keeps its fixed reference line — the driver already knows the road, so
// that display just orients them, unlike the passenger side where an
// inaccurate reference line would be misleading.
function getRouteForRide(ride) {
  // A ride between two arbitrary points has no pre-traced path to show. A
  // straight line between its real endpoints at least points the driver the
  // right way, where the campus polyline would confidently draw a road they
  // aren't taking at all.
  const pickup = ridePoint(ride.pickup_lat, ride.pickup_lng);
  const dropoff = ridePoint(ride.dropoff_lat, ride.dropoff_lng);
  if (pickup && dropoff) return [pickup, dropoff];

  const pickupIsSanIsidro = (ride.pickup_location || '').includes('San Isidro');
  return pickupIsSanIsidro ? ROUTE_SAN_ISIDRO_TO_MAIN : ROUTE_MAIN_TO_SAN_ISIDRO;
}

// The road from pickup to drop-off (see getRideRoute on the server), for
// the maroon line on both maps, as { points, road }. road is false when the
// routing server didn't answer and points is only the straight line (or
// getRouteForRide's fallback), so callers try again on a later refresh.
async function fetchRideRoute(ride) {
  try {
    const res = await fetch(`${RIDES_API_URL}/${ride.ride_id}/route`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.points && data.points.length >= 2) return { points: data.points, road: Boolean(data.road) };
    }
  } catch (error) {
    console.warn('Unable to load ride route', error);
  }
  return { points: getRouteForRide(ride), road: false };
}

// The A (pickup) and B (drop-off) pins, identical on both maps. Anchored at
// their bottom edge so a pin sitting under the tricycle still pokes out.
function ridePinIcon(letter, kind) {
  return L.divIcon({ className: 'route-pin-icon', html: `<span class="route-pin-badge route-pin-${kind}">${letter}</span>`, iconSize: [26, 26], iconAnchor: [13, 26] });
}

// Finds which point in the route array the driver's current GPS is closest
// to, so we can draw only the REMAINING stretch of road ahead of them (the
// "consumed" portion behind them disappears) instead of always showing the
// whole route end-to-end. Plain squared-difference is fine here — we only
// need to compare distances relative to each other, not true meters, and
// the route points are close enough together that this never picks the
// wrong one in practice.
function findNearestRouteIndex(route, point) {
  let nearestIndex = 0;
  let nearestDist = Infinity;
  route.forEach((routePoint, index) => {
    const dLat = routePoint[0] - point[0];
    const dLng = routePoint[1] - point[1];
    const dist = dLat * dLat + dLng * dLng;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}


// ESTIMATED TIME OF ARRIVAL on the passenger's and the driver's ride card
// (see getRideEta on the server). Refreshed at most every ETA_REFRESH_MS per
// ride, piggybacking on updates that already happen (the driver's location
// reaching the passenger, the driver's own GPS fixes) rather than a timer of
// its own. The last answer is kept so a card that re-renders shows it again
// straight away instead of blanking until the next refresh.
const ETA_REFRESH_MS = 15 * 1000;
const ETA_ACTIVE_STATUSES = ['Accepted', 'Picked Up', 'In Progress'];
const rideEtaCache = {};

// "1 hr 5 min" rather than "65 min".
function formatEtaMinutes(minutes) {
  const total = Math.max(1, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function rideEtaText(eta, role) {
  if (!eta || eta.waiting) {
    return role === 'driver' ? 'Waiting for your GPS to estimate arrival…' : "Waiting for the driver's location…";
  }
  const km = eta.distanceKm != null ? ` · ${Number(eta.distanceKm).toFixed(1)} km` : '';
  const time = formatEtaMinutes(eta.minutes);
  if (eta.phase === 'to_pickup') {
    if (eta.arriving) return role === 'driver' ? "You're at the pickup point" : 'Your driver is arriving now';
    return role === 'driver'
      ? `About ${time} to pickup${km}`
      : `Driver arrives in about ${time}${km} away`;
  }
  return role === 'driver'
    ? `About ${time} to drop-off${km}`
    : `About ${time} to your destination${km}`;
}

// The ETA line inside a ride card's template. Empty for rides with nothing
// to estimate (still Pending, or already finished).
function rideEtaRowHtml(ride, role) {
  if (!ride || !ETA_ACTIVE_STATUSES.includes(ride.status)) return '';
  const cached = rideEtaCache[ride.ride_id];
  const eta = cached ? cached.eta : null;
  return `<p class="ride-eta${eta && eta.arriving ? ' is-arriving' : ''}" data-eta-ride="${ride.ride_id}" data-eta-role="${role}">${escapeHtml(rideEtaText(eta, role))}</p>`;
}

function paintRideEta(rideId) {
  const cached = rideEtaCache[rideId];
  const eta = cached ? cached.eta : null;
  document.querySelectorAll(`[data-eta-ride="${rideId}"]`).forEach((el) => {
    el.textContent = rideEtaText(eta, el.dataset.etaRole);
    el.classList.toggle('is-arriving', Boolean(eta && eta.arriving));
  });
  // The tricycle on the passenger's map says the same thing when tapped.
  if (typeof driverLocationMarker !== 'undefined' && driverLocationMarker && eta && !eta.waiting && eta.phase) {
    driverLocationMarker.setPopupContent(`Your driver · ${escapeHtml(rideEtaText(eta, 'passenger'))}`);
  }
}

async function refreshRideEta(ride) {
  if (!ride || !ETA_ACTIVE_STATUSES.includes(ride.status)) return;
  const cached = rideEtaCache[ride.ride_id];
  if (cached && (cached.loading || Date.now() - cached.at < ETA_REFRESH_MS)) return;
  rideEtaCache[ride.ride_id] = { eta: cached ? cached.eta : null, at: cached ? cached.at : 0, loading: true };
  try {
    const res = await fetch(`${RIDES_API_URL}/${ride.ride_id}/eta`, { headers: getAuthHeaders() });
    const eta = res.ok ? await res.json() : (cached ? cached.eta : null);
    rideEtaCache[ride.ride_id] = { eta, at: Date.now(), loading: false };
  } catch (error) {
    rideEtaCache[ride.ride_id] = { eta: cached ? cached.eta : null, at: Date.now(), loading: false };
  }
  paintRideEta(ride.ride_id);
}

// The ride the driver's own GPS fixes should refresh the ETA for; set by
// renderDriverMapTrackingBody while a trip is active.
let driverEtaRide = null;

async function pollDriverLocation() {
  if (!passengerMapInstance) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'passenger') return;

  const rides = await fetchMyRides();
  // 'Pending' is included so the A and B pins appear the moment a ride is
  // requested, not only once a driver accepts. Waiting for acceptance can be
  // minutes, and the map sat showing nothing at all about the trip that had
  // just been booked -- no pickup pin, no destination, no framing of either.
  // Deliberately NOT mirrored in renderDriverMapTrackingBody below, which
  // has the same line: a driver should only ever track a ride they accepted.
  const activeRide = rides.find(r => ['Pending', 'Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (!activeRide) {
    if (driverTrackedRideId !== null) clearDriverTracking();
    return;
  }

  // A new ride (different ride_id) means a fresh trip — wipe any leftover
  // marker/route from a previous ride instead of leaving it on the map.
  if (driverTrackedRideId !== null && driverTrackedRideId !== activeRide.ride_id) {
    clearDriverTracking();
  }

  refreshRideEta(activeRide);

  if (driverTrackedRideId !== activeRide.ride_id) {
    clearPickupPreview();
    driverTrackedRideId = activeRide.ride_id;
    driverActualTrailPoints = [];
    driverActualTrail = L.polyline([], {
      color: '#1d4ed8', weight: 4, opacity: 0.9, dashArray: '2 10', lineCap: 'round'
    }).addTo(passengerMapInstance);
    const pickupIcon = ridePinIcon('A', 'pickup');
    const dropoffIcon = ridePinIcon('B', 'dropoff');
    const pickupPoint = getPinCoords(activeRide.pickup_location, activeRide.pickup_lat, activeRide.pickup_lng);
    const dropoffPoint = getPinCoords(activeRide.dropoff_location, activeRide.dropoff_lat, activeRide.dropoff_lng);
    driverPickupPin = L.marker(pickupPoint, { icon: pickupIcon }).addTo(passengerMapInstance).bindPopup('Pickup: ' + escapeHtml(activeRide.pickup_location));
    driverDropoffPin = L.marker(dropoffPoint, { icon: dropoffIcon }).addTo(passengerMapInstance).bindPopup('Drop-off: ' + escapeHtml(activeRide.dropoff_location));
    // The map opens on a fixed view between the two campuses, which is the
    // wrong part of the province for a ride booked anywhere else. Framing the
    // trip's own endpoints once, as the ride starts, puts the passenger where
    // their ride actually is. Only on this first pass, so it never yanks the
    // view back while they're panning around during the trip.
    passengerMapInstance.fitBounds(L.latLngBounds([pickupPoint, dropoffPoint]).pad(0.3));
  }

  // Drawn behind the pins and the driver's trail once the route arrives, and
  // retried on later polls until it follows the road. The ride check stops a
  // slow answer landing on the next ride's map.
  if (!passengerRouteIsRoad && !passengerRouteLoading) {
    passengerRouteLoading = true;
    const routeRideId = activeRide.ride_id;
    fetchRideRoute(activeRide).then(({ points, road }) => {
      passengerRouteLoading = false;
      if (driverTrackedRideId !== routeRideId || !passengerMapInstance) return;
      if (passengerRouteLine) {
        passengerRouteLine.setLatLngs(points);
      } else {
        passengerRouteLine = L.polyline(points, {
          color: '#7f1d1d', weight: 5, opacity: 0.6, lineCap: 'round', lineJoin: 'round'
        }).addTo(passengerMapInstance);
        passengerRouteLine.bringToBack();
      }
      passengerRouteIsRoad = road;
    });
  }

  try {
    const res = await fetch(`${RIDES_API_URL}/${activeRide.ride_id}/driver-location`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (data.lat == null || data.lng == null) return;

    const point = [data.lat, data.lng];

    if (driverActualTrail) {
      driverActualTrailPoints.push(point);
      driverActualTrail.setLatLngs(driverActualTrailPoints);
    }

    if (!driverLocationMarker) {
      const driverIcon = L.divIcon({ className: 'driver-location-icon', html: DRIVER_MARKER_HTML, iconSize: [44, 44], iconAnchor: [22, 22] });
      driverLocationMarker = L.marker(point, { icon: driverIcon, zIndexOffset: 1000 }).addTo(passengerMapInstance).bindPopup('Your driver');
      // Legend moved here from the pin-drawing block above. It captions the
      // driver's trail, and a Pending ride has no driver yet -- shown any
      // earlier it would label a line that cannot exist.
      const legend = document.querySelector('#route-legend');
      if (legend) legend.style.display = 'flex';
    } else {
      driverLocationMarker.setLatLng(point);
    }
  } catch (error) {
    console.warn('Unable to fetch driver location', error);
  }
}

// PASSENGER'S OWN "YOU ARE HERE" MARKER — separate from everything above,
// which is all about showing the DRIVER's position. This is purely local
// display: the passenger's own device watches its own GPS and draws a dot
// for itself, same active-ride window as driver tracking (waiting for
// pickup through the trip itself). Unlike the driver's location, this
// position is never sent to the server — nothing else needs it, so there's
// no PUT call here, just a marker on this one device's own map.
let passengerWatchId = null;
let passengerSelfMarker = null;

async function syncPassengerSelfLocationSharing() {
  if (!passengerMapInstance || !navigator.geolocation) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'passenger') return;

  const rides = await fetchMyRides();
  const hasActiveRide = rides.some(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (hasActiveRide && passengerWatchId === null) {
    startPassengerSelfLocationSharing();
  } else if (!hasActiveRide && passengerWatchId !== null) {
    stopPassengerSelfLocationSharing();
  }
}

function startPassengerSelfLocationSharing() {
  passengerWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const point = [position.coords.latitude, position.coords.longitude];
      if (!passengerSelfMarker) {
        const icon = L.divIcon({
          className: 'you-are-here-icon',
          html: '<span class="you-are-here-pulse"></span><span class="you-are-here-dot"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        passengerSelfMarker = L.marker(point, { icon, zIndexOffset: 1100 }).addTo(passengerMapInstance).bindPopup('You are here');
        // Without this the map sits on its default view between the two
        // campuses, so a passenger anywhere else opens their dashboard looking
        // at the wrong town with their own dot off-screen.
        passengerMapInstance.setView(point, 15);
      } else {
        passengerSelfMarker.setLatLng(point);
      }
    },
    (error) => console.warn('Could not get passenger location', error),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stopPassengerSelfLocationSharing() {
  if (passengerWatchId !== null) {
    navigator.geolocation.clearWatch(passengerWatchId);
    passengerWatchId = null;
  }
  if (passengerSelfMarker) {
    passengerMapInstance.removeLayer(passengerSelfMarker);
    passengerSelfMarker = null;
  }
}

// DRIVER'S OWN MAP — mirrors the passenger-side map: no pins until there's
// an active ride, then the same shrinking route line and a marker for the
// driver's own live GPS fix. Only present on driver.html — safe no-op
// everywhere else.
let driverMapInstance = null;
let driverMapMarker = null;
let driverMapPassengerMarker = null;
let driverMapDropoffPin = null;
let driverMapRouteIsRoad = false;
let driverMapRouteLoading = false;
let driverMapRouteLine = null;
let driverMapRouteFull = null;
let driverMapTrackedRideId = null;
let lastKnownDriverPosition = null;

function setupDriverMap() {
  const mapEl = document.querySelector('#driver-map');
  if (!mapEl || typeof L === 'undefined') return;

  driverMapInstance = L.map('driver-map', {
    minZoom: 10,
    maxBounds: TARLAC_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView([15.494, 120.583], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(driverMapInstance);

  watchMapContainerSize(mapEl, driverMapInstance);
}

function clearDriverMapTracking() {
  if (driverMapMarker) {
    driverMapInstance.removeLayer(driverMapMarker);
    driverMapMarker = null;
  }
  if (driverMapPassengerMarker) {
    driverMapInstance.removeLayer(driverMapPassengerMarker);
    driverMapPassengerMarker = null;
  }
  if (driverMapDropoffPin) {
    driverMapInstance.removeLayer(driverMapDropoffPin);
    driverMapDropoffPin = null;
  }
  if (driverMapRouteLine) {
    driverMapInstance.removeLayer(driverMapRouteLine);
    driverMapRouteLine = null;
  }
  driverMapRouteFull = null;
  driverMapRouteIsRoad = false;
  driverMapTrackedRideId = null;
}

// Draws the driver's progress on their own map: while an active ride
// exists, shows the route line (shrinking as they advance, same as what
// the passenger sees) plus a marker at the driver's last known GPS fix.
// Runs on the same polling cadence as the location-sharing sync.
let driverMapTrackingInFlight = false;

async function renderDriverMapTracking() {
  if (!driverMapInstance) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;
  // This function can be triggered from more than one place close
  // together (page-load refreshAuthState() plus a near-simultaneous
  // ride:updated socket event) -- without this guard, two overlapping
  // calls can both pass the "if (!driverMapMarker)" check below before
  // either finishes, each creating its own marker: two overlapping 🛺
  // badges on the map instead of one.
  if (driverMapTrackingInFlight) return;
  driverMapTrackingInFlight = true;

  try {
    await renderDriverMapTrackingBody();
  } finally {
    driverMapTrackingInFlight = false;
  }
}

async function renderDriverMapTrackingBody() {
  const rides = await fetchDriverRides();
  const activeRide = rides.find(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (!activeRide) {
    driverEtaRide = null;
    if (driverMapTrackedRideId !== null) clearDriverMapTracking();
    return;
  }

  if (driverMapTrackedRideId !== null && driverMapTrackedRideId !== activeRide.ride_id) {
    clearDriverMapTracking();
  }

  driverEtaRide = activeRide;
  refreshRideEta(activeRide);

  if (driverMapTrackedRideId !== activeRide.ride_id) {
    driverMapTrackedRideId = activeRide.ride_id;
    // Straight line straight away, swapped for the road once it arrives:
    // the free routing server can take several seconds to answer.
    driverMapRouteFull = getRouteForRide(activeRide);
    driverMapRouteLine = L.polyline(driverMapRouteFull, {
      color: '#7f1d1d', weight: 5, opacity: 0.75, lineCap: 'round', lineJoin: 'round'
    }).addTo(driverMapInstance);

    const dropoffPoint = ridePoint(activeRide.dropoff_lat, activeRide.dropoff_lng);
    if (dropoffPoint) {
      driverMapDropoffPin = L.marker(dropoffPoint, { icon: ridePinIcon('B', 'dropoff') })
        .addTo(driverMapInstance).bindPopup('Drop-off: ' + escapeHtml(activeRide.dropoff_location));
    }
  }

  // Road line replaces the straight one when it arrives; retried on each
  // later render until the routing server has answered.
  if (!driverMapRouteIsRoad && !driverMapRouteLoading) {
    driverMapRouteLoading = true;
    const routeRideId = activeRide.ride_id;
    fetchRideRoute(activeRide).then(({ points, road }) => {
      driverMapRouteLoading = false;
      if (driverMapTrackedRideId !== routeRideId || !driverMapRouteLine) return;
      driverMapRouteFull = points;
      driverMapRouteLine.setLatLngs(points);
      driverMapRouteIsRoad = road;
      placeDriverMapMarker();
    });
  }

  // Best-effort: shows where the passenger actually was when they requested
  // this ride (a one-time GPS snapshot, not continuously updated) — a ride
  // requested before this feature existed, or where the passenger denied
  // location access, simply has no coordinates and no marker ever appears.
  try {
    const res = await fetch(`${RIDES_API_URL}/${activeRide.ride_id}/passenger-location`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.lat != null && data.lng != null) {
        const passengerPoint = [data.lat, data.lng];
        if (!driverMapPassengerMarker) {
          // The "A" pin the passenger sees, drawn above the driver's own
          // tricycle (1000): while the driver is at or near the pickup the
          // tricycle used to sit right on top of the passenger and hide it.
          driverMapPassengerMarker = L.marker(passengerPoint, { icon: ridePinIcon('A', 'pickup'), zIndexOffset: 1200 })
            .addTo(driverMapInstance).bindPopup('Passenger pickup: ' + escapeHtml(activeRide.pickup_location));
        } else {
          driverMapPassengerMarker.setLatLng(passengerPoint);
        }
      }
    }
  } catch (error) {
    console.warn('Unable to load passenger pickup location', error);
  }

  placeDriverMapMarker();
}

// The driver's own tricycle on their map during a ride, plus trimming the
// route line to what's still ahead. Called both when the ride view renders
// and on every GPS fix (see startDriverLocationSharing): the render usually
// runs right after Accept, before the first fix has arrived, and nothing
// rendered it again after that, so the driver never saw themselves.
function placeDriverMapMarker() {
  if (!driverMapInstance || driverMapTrackedRideId === null || !lastKnownDriverPosition) return;
  const point = lastKnownDriverPosition;

  if (driverMapRouteFull && driverMapRouteLine) {
    const nearestIndex = findNearestRouteIndex(driverMapRouteFull, point);
    driverMapRouteLine.setLatLngs(driverMapRouteFull.slice(nearestIndex));
  }

  if (!driverMapMarker) {
    const driverIcon = L.divIcon({ className: 'driver-location-icon', html: DRIVER_MARKER_HTML, iconSize: [44, 44], iconAnchor: [22, 22] });
    driverMapMarker = L.marker(point, { icon: driverIcon, zIndexOffset: 1000 }).addTo(driverMapInstance).bindPopup('You');
  } else {
    driverMapMarker.setLatLng(point);
  }
}

async function fetchAdminDrivers() {
  try {
    const res = await fetch(`${ADMIN_API_URL}/drivers`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.drivers || [];
  } catch (error) {
    console.warn('Unable to fetch drivers', error);
    return [];
  }
}

// ADMIN DASHBOARD STATS — only present on admin.html, so this is a safe
// no-op on every other page.
async function renderAdminStats() {
  const bookingsEl = document.querySelector('#admin-stat-bookings');
  if (!bookingsEl) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'admin') return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/stats`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const stats = await res.json();

    bookingsEl.textContent = stats.totalBookings.toLocaleString();
    document.querySelector('#admin-stat-drivers').textContent = stats.registeredDrivers.toLocaleString();
    document.querySelector('#admin-stat-passengers').textContent = stats.activePassengers.toLocaleString();
    document.querySelector('#admin-stat-pending').textContent = stats.pendingRequests.toLocaleString();
  } catch (error) {
    console.warn('Unable to fetch admin stats', error);
  }
}

async function updateDriverStatusRemote(driverId, status) {
  const res = await fetch(`${ADMIN_API_URL}/drivers/${driverId}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to update driver status');
  return data;
}

async function resetDriverPasswordRemote(driverId) {
  const res = await fetch(`${ADMIN_API_URL}/drivers/${driverId}/reset-password`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to reset this driver\'s password');
  return data;
}

const RESET_PW_ICONS = {
  lock: '<rect x="4" y="9" width="12" height="8" rx="2"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/>',
  check: '<path d="M10 2.5L16.5 5.2V9C16.5 13 13.7 16.3 10 17.5C6.3 16.3 3.5 13 3.5 9V5.2L10 2.5Z"/><path d="M7.2 10L9.2 12L12.8 8"/>',
  copy: '<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M4 13V4.5A1.5 1.5 0 0 1 5.5 3H13"/>',
  warn: '<path d="M10 6.5v4M10 13.2h.01"/><circle cx="10" cy="10" r="7.2"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>'
};
function resetPwSvg(icon, viewBox, strokeWidth) {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${RESET_PW_ICONS[icon]}</svg>`;
}

// Reset-password modal — built dynamically (like openChatModal/
// showRideConfirmModal elsewhere) rather than a static block in admin.html,
// since it has two states (confirm, then the one-time result) sharing one
// overlay. Uses the real .admin-modal-* shell so it reads as native to
// this panel, not the borrowed chat-modal one showRideConfirmModal uses.
function openDriverResetPasswordModal(driverId, targetName) {
  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.style.display = 'flex';

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
  }

  function renderConfirm() {
    overlay.innerHTML = `
      <div class="admin-modal">
        <div class="admin-modal-head">
          <div>
            <div class="admin-panel-icon admin-modal-head-icon">${resetPwSvg('lock', '0 0 20 20', '1.6')}</div>
            <h3>Reset password?</h3>
          </div>
          <button type="button" class="admin-modal-close">${resetPwSvg('close', '0 0 24 24', '2')}</button>
        </div>
        <div class="admin-modal-body">
          <p style="margin:0 0 18px;font-size:0.86rem;color:var(--muted);line-height:1.55;">This generates a new temporary password for <strong style="color:var(--text)">${escapeHtml(targetName)}</strong> and immediately replaces their current one. Give it to them by phone or in person.</p>
          <div class="admin-modal-actions">
            <button type="button" class="admin-btn-outline-full reset-pw-cancel">Cancel</button>
            <button type="button" class="admin-btn-primary reset-pw-confirm">Reset password</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('.admin-modal-close').addEventListener('click', close);
    overlay.querySelector('.reset-pw-cancel').addEventListener('click', close);
    overlay.querySelector('.reset-pw-confirm').addEventListener('click', async function() {
      this.disabled = true;
      try {
        const data = await resetDriverPasswordRemote(driverId);
        renderResult(data.tempPassword);
      } catch (error) {
        close();
        showRideFeedback('error', 'Could not reset password', error.message || 'Please try again.');
      }
    });
  }

  function renderResult(tempPassword) {
    overlay.innerHTML = `
      <div class="admin-modal">
        <div class="admin-modal-head">
          <div>
            <div class="admin-panel-icon admin-modal-head-icon" style="background:#e6f4ea;color:#1a7a3c;">${resetPwSvg('check', '0 0 20 20', '1.6')}</div>
            <h3>New temporary password</h3>
          </div>
          <button type="button" class="admin-modal-close">${resetPwSvg('close', '0 0 24 24', '2')}</button>
        </div>
        <div class="admin-modal-body">
          <p style="margin:0 0 14px;font-size:0.86rem;color:var(--muted);line-height:1.55;">Relay this to <strong style="color:var(--text)">${escapeHtml(targetName)}</strong> now.</p>
          <div class="temp-pw-box">
            <span>Temporary password</span>
            <div class="temp-pw-value">${escapeHtml(tempPassword)}</div>
            <div class="copy-row">
              <button type="button" class="copy-btn">${resetPwSvg('copy', '0 0 20 20', '1.6')}Copy</button>
            </div>
          </div>
          <div class="warn-note">
            ${resetPwSvg('warn', '0 0 20 20', '1.8')}
            <p>Shown only once — if you navigate away without copying this, you'll need to reset again.</p>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="admin-btn-primary reset-pw-done" style="flex:none;width:100%;">Done</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('.admin-modal-close').addEventListener('click', close);
    overlay.querySelector('.reset-pw-done').addEventListener('click', close);
    overlay.querySelector('.copy-btn').addEventListener('click', async function() {
      const btn = this;
      try {
        await navigator.clipboard.writeText(tempPassword);
        const original = btn.innerHTML;
        btn.innerHTML = 'Copied';
        setTimeout(() => { btn.innerHTML = original; }, 1400);
      } catch (error) {
        // Clipboard API unavailable/denied — password is still visible to select manually.
      }
    });
  }

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) close();
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  renderConfirm();
}

// The driver's map marker. An image rather than the 🛺 emoji, which every
// phone draws in its own style (some as an auto-rickshaw or a car), so the
// marker looked like a random vehicle depending on who was watching.
const DRIVER_MARKER_HTML = '<span class="driver-location-badge"><img src="../images/tricycle.png" alt="Driver"></span>';

function initials(...parts) {
  const chars = parts.map(p => (p || '').trim().charAt(0)).join('');
  return chars.toUpperCase() || '?';
}

function statusPillTone(status) {
  if (status === 'Active') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

// An approved driver's status reads "Approved" rather than the stored
// "Active", which sat next to the passengers' Active/Offline pills and read
// as "online right now". The stored value itself is unchanged.
function driverStatusLabel(status) {
  return status === 'Active' ? 'Approved' : status;
}

// Online/Offline for an approved driver: on shift with the app open right
// now (see listDrivers). Pending and rejected drivers can't log in at all.
function driverPresencePill(driver) {
  if (driver.account_status !== 'Active') return '';
  return pillHtml(driver.is_online ? 'success' : 'neutral', driver.is_online ? 'Online' : 'Offline');
}

function pillHtml(tone, label) {
  return `<span class="admin-pill tone-${tone}"><svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>${escapeHtml(label)}</span>`;
}

// Suspended accounts (a Violation suspends them, see server/suspension.js):
// a red pill in the admin lists, and a button to lift it.
function suspendedPill(account) {
  return account.suspended_at ? pillHtml('danger', 'Suspended') : '';
}

function liftSuspensionButton(account, safeName) {
  return account.suspended_at
    ? `<button type="button" class="admin-btn tone-danger" data-action="lift-suspension" data-account-id="${account.account_id}" data-target-name="${safeName}">Lift suspension</button>`
    : '';
}

// Same driver data renders two ways — a table row for web sizes, a stacked
// card for mobile (see admin.css's @media(max-width:640px) which swaps
// which one is visible) — kept as separate small templates rather than one
// generic component since their layouts genuinely differ, not just widths.
function renderDriverRow(driver) {
  const driverName = escapeHtml(`${driver.first_name} ${driver.last_name}`);
  const isPending = driver.account_status === 'Pending';
  const licenseCell = driver.has_license_file
    ? `<button type="button" class="admin-link-btn" data-action="view-license" data-driver-id="${driver.driver_id}">View file</button>`
    : '<span class="tone-warning">Not uploaded</span>';
  // No separate "View" button for an approved driver: it opened the same
  // license modal as the "View file" link in the License column.
  const approvalActions = isPending
    ? `<button type="button" class="admin-btn tone-success" data-action="approve-driver" data-driver-id="${driver.driver_id}">Approve</button>
       <button type="button" class="admin-btn tone-danger" data-action="reject-driver" data-driver-id="${driver.driver_id}">Reject</button>`
    : '';

  return `
    <tr${isPending ? ' data-pending-row' : ''} data-driver-id="${driver.driver_id}">
      <td><div class="admin-person"><span class="admin-avatar">${initials(driver.first_name, driver.last_name)}</span><div><strong>${driverName}</strong></div></div></td>
      <td>${escapeHtml(driver.contact_number || '—')}</td>
      <td>${licenseCell}</td>
      <td><div class="admin-pill-stack">${pillHtml(statusPillTone(driver.account_status), driverStatusLabel(driver.account_status))}${suspendedPill(driver)}${driverPresencePill(driver)}</div></td>
      <td><div class="admin-actions">${approvalActions}${liftSuspensionButton(driver, driverName)}<button type="button" class="admin-btn" data-action="reset-driver-password" data-driver-id="${driver.driver_id}" data-target-name="${driverName}">Reset password</button><button type="button" class="admin-btn" data-action="issue-warning" data-account-id="${driver.account_id}" data-target-name="${driverName}">Issue Warning</button></div></td>
    </tr>
  `;
}

function renderDriverCard(driver) {
  const driverName = escapeHtml(`${driver.first_name} ${driver.last_name}`);
  const isPending = driver.account_status === 'Pending';
  const licenseRow = driver.has_license_file
    ? `<div class="admin-mcard-row"><span>License</span><span><button type="button" class="admin-link-btn" data-action="view-license" data-driver-id="${driver.driver_id}">View file</button></span></div>`
    : `<div class="admin-mcard-row"><span>License</span><span class="tone-warning">Not uploaded</span></div>`;
  // Same as the table row: "View file" above already opens the license.
  const actions = isPending
    ? `<button class="admin-btn tone-success" data-action="approve-driver" data-driver-id="${driver.driver_id}">Approve</button>
       <button class="admin-btn tone-danger" data-action="reject-driver" data-driver-id="${driver.driver_id}">Reject</button>`
    : '';

  return `
    <div class="admin-mcard"${isPending ? ' data-pending-row' : ''} data-driver-id="${driver.driver_id}">
      <div class="admin-mcard-top">
        <div class="admin-person"><span class="admin-avatar">${initials(driver.first_name, driver.last_name)}</span><div><strong>${driverName}</strong></div></div>
        ${suspendedPill(driver) || pillHtml(statusPillTone(driver.account_status), driverStatusLabel(driver.account_status))}
      </div>
      <div class="admin-mcard-rows">
        ${driver.account_status === 'Active' ? `<div class="admin-mcard-row"><span>Right now</span><span>${driverPresencePill(driver)}</span></div>` : ''}
        <div class="admin-mcard-row"><span>Contact</span><span>${escapeHtml(driver.contact_number || '—')}</span></div>
        ${licenseRow}
      </div>
      <div class="admin-mcard-actions">
        ${actions}
        ${liftSuspensionButton(driver, driverName)}
        <button class="admin-btn" data-action="reset-driver-password" data-driver-id="${driver.driver_id}" data-target-name="${driverName}">Reset password</button>
        <button class="admin-btn" data-action="issue-warning" data-account-id="${driver.account_id}" data-target-name="${driverName}">Warn</button>
      </div>
    </div>
  `;
}

// Cached so the license modal (opened from either the table or the mobile
// card, both firing the same data-driver-id click) can look up the full
// driver record without a second network round trip.
let currentAdminDrivers = [];

async function renderAdminDriverManagement() {
  const tbody = document.querySelector('#admin-drivers-tbody');
  const mobileList = document.querySelector('#admin-drivers-mobile');
  if (!tbody) return;

  const drivers = await fetchAdminDrivers();
  currentAdminDrivers = drivers;

  if (!drivers.length) {
    tbody.innerHTML = '<tr><td colspan="5">No drivers registered yet.</td></tr>';
    if (mobileList) mobileList.innerHTML = '<p class="admin-mcard-empty">No drivers registered yet.</p>';
    return;
  }

  tbody.innerHTML = drivers.map(renderDriverRow).join('');
  if (mobileList) mobileList.innerHTML = drivers.map(renderDriverCard).join('');

  wireDriverManagementActions(tbody);
  if (mobileList) wireDriverManagementActions(mobileList);
}

function wireDriverManagementActions(container) {
  setupIssueWarningButtons(container);

  container.querySelectorAll('[data-action="view-license"]').forEach(button => {
    button.addEventListener('click', function() {
      openLicenseModal(this.getAttribute('data-driver-id'));
    });
  });

  container.querySelectorAll('[data-action="approve-driver"]').forEach(button => {
    button.addEventListener('click', async function() {
      try {
        await updateDriverStatusRemote(this.getAttribute('data-driver-id'), 'Active');
        renderAdminDriverManagement();
      } catch (error) {
        showRideFeedback('error', 'Could not approve', error.message || 'Please try again.');
      }
    });
  });

  container.querySelectorAll('[data-action="reject-driver"]').forEach(button => {
    button.addEventListener('click', async function() {
      const driverId = this.getAttribute('data-driver-id');
      if (!confirm('Reject this driver application?')) return;
      try {
        await updateDriverStatusRemote(driverId, 'Rejected');
        renderAdminDriverManagement();
      } catch (error) {
        showRideFeedback('error', 'Could not reject', error.message || 'Please try again.');
      }
    });
  });

  container.querySelectorAll('[data-action="reset-driver-password"]').forEach(button => {
    button.addEventListener('click', function() {
      openDriverResetPasswordModal(this.getAttribute('data-driver-id'), this.getAttribute('data-target-name'));
    });
  });
}

// Collapsible panels — same accordion behavior on every size now (not just
// mobile), since long driver/booking/complaint lists made the dashboard a
// long scroll on desktop too.
function setupAdminPanelCollapse() {
  document.querySelectorAll('.admin-panel-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.admin-panel');
      if (!panel) return;
      const collapsed = panel.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.setAttribute('aria-label', collapsed ? 'Expand this section' : 'Collapse this section');
    });
  });

  // Every panel starts closed, so a stat card at the top ("Registered
  // drivers", "Pending requests"...) opens the panel it jumps to instead of
  // landing on a closed one.
  document.querySelectorAll('a.admin-stat-card[href^="#"]').forEach(card => {
    card.addEventListener('click', () => {
      const panel = document.querySelector(card.getAttribute('href'));
      if (!panel || !panel.classList.contains('is-collapsed')) return;
      panel.classList.remove('is-collapsed');
      const toggle = panel.querySelector('.admin-panel-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Collapse this section');
      }
    });
  });
}

// Opens a collapsed admin panel and scrolls to it (the suspension popup's
// "Open Passenger management" button).
function openAdminPanel(selector) {
  const panel = document.querySelector(selector);
  if (!panel) return;
  panel.classList.remove('is-collapsed');
  const toggle = panel.querySelector('.admin-panel-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Collapse this section');
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Same collapsible-section treatment as the admin panels, applied to
// passenger-profile.html / driver-profile.html's "Profile details" /
// "Change password" / "Loyalty Rewards" cards. Safe no-op elsewhere.
function setupProfilePanelCollapse() {
  document.querySelectorAll('.profile-panel-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.profile-panel');
      if (!panel) return;
      const collapsed = panel.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.setAttribute('aria-label', collapsed ? 'Expand this section' : 'Collapse this section');
    });
  });
}

// Same collapsible-section treatment as the admin panels, applied to the
// "All bookings" / "All rides" cards — one toggle collapses the whole
// card's body, not each individual ride.
function setupDashboardCardCollapse() {
  document.querySelectorAll('.dashboard-card-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.dashboard-card');
      if (!card) return;
      const collapsed = card.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.setAttribute('aria-label', collapsed ? 'Expand this section' : 'Collapse this section');
    });
  });
}

// License review modal — fetched as a blob (a plain <a href> can't carry
// the Authorization header this admin-only endpoint requires); images
// render inline, PDFs fall back to an "open in new tab" link since <img>
// can't display them.
function openLicenseModal(driverId) {
  const driver = currentAdminDrivers.find(d => String(d.driver_id) === String(driverId));
  const modal = document.querySelector('#license-modal');
  if (!driver || !modal) return;

  document.querySelector('#license-modal-name').textContent = `${driver.first_name} ${driver.last_name}'s license`;
  const preview = document.querySelector('#license-modal-preview');
  const errorEl = document.querySelector('#license-modal-error');
  const actionsEl = document.querySelector('#license-modal-actions');
  errorEl.textContent = '';
  preview.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M6 16c.5-1.6 1.6-2.5 2.5-2.5s2 .9 2.5 2.5M14 9.5h5M14 12.5h5M14 15.5h3"/></svg>
    <strong>Loading file…</strong>
  `;
  actionsEl.innerHTML = '';
  modal.classList.remove('hidden');

  fetch(`${ADMIN_API_URL}/drivers/${driverId}/license`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load license file');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      preview.innerHTML = blob.type.startsWith('image/')
        ? `<img src="${url}" alt="${driver.first_name} ${driver.last_name}'s license">`
        : `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/></svg>
          <strong>License file (PDF)</strong>
          <small><a href="${url}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;">Open in new tab</a></small>
        `;
    })
    .catch(error => {
      // Replace the "Loading file…" placeholder too, or the box keeps
      // claiming to load while the message below says it failed.
      preview.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><line x1="9.5" y1="12.5" x2="14.5" y2="17.5"/><line x1="14.5" y1="12.5" x2="9.5" y2="17.5"/></svg>
        <strong>File not available</strong>
        <small>Ask the driver to send their license again before approving.</small>
      `;
      errorEl.textContent = error.message || 'Could not load license file';
    });

  if (driver.account_status === 'Pending') {
    actionsEl.innerHTML = `
      <button type="button" class="admin-btn-primary" style="background:var(--tone-success)" data-modal-action="approve-driver">Approve driver</button>
      <button type="button" class="admin-btn-outline-full" style="color:var(--tone-danger);border-color:var(--tone-danger)" data-modal-action="reject-driver">Reject</button>
    `;
    actionsEl.querySelector('[data-modal-action="approve-driver"]').addEventListener('click', async function() {
      try {
        await updateDriverStatusRemote(driverId, 'Active');
        closeLicenseModal();
        renderAdminDriverManagement();
      } catch (error) {
        errorEl.textContent = error.message || 'Could not approve driver';
      }
    });
    actionsEl.querySelector('[data-modal-action="reject-driver"]').addEventListener('click', async function() {
      if (!confirm('Reject this driver application?')) return;
      try {
        await updateDriverStatusRemote(driverId, 'Rejected');
        closeLicenseModal();
        renderAdminDriverManagement();
      } catch (error) {
        errorEl.textContent = error.message || 'Could not reject driver';
      }
    });
  }
}

function closeLicenseModal() {
  const modal = document.querySelector('#license-modal');
  if (modal) modal.classList.add('hidden');
}

function setupLicenseModal() {
  const modal = document.querySelector('#license-modal');
  if (!modal) return;
  modal.querySelectorAll('[data-close-license-modal]').forEach(btn => {
    btn.addEventListener('click', closeLicenseModal);
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeLicenseModal();
  });
}

function passengerInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return initials(parts[0], parts[1]);
}

function renderPassengerRow(p) {
  const lastBooking = p.last_booking ? new Date(p.last_booking).toLocaleDateString() : '—';
  const isOnline = Boolean(p.is_online);
  const passengerName = escapeHtml(p.name);
  return `
    <tr>
      <td><div class="admin-person"><span class="admin-avatar">${passengerInitials(p.name)}</span><div><strong>${passengerName}</strong></div></div></td>
      <td>${p.ride_count}</td>
      <td>${escapeHtml(lastBooking)}</td>
      <td><div class="admin-pill-stack">${suspendedPill(p)}${pillHtml(isOnline ? 'success' : 'neutral', isOnline ? 'Online' : 'Offline')}</div></td>
      <td><div class="admin-actions">${liftSuspensionButton(p, passengerName)}<button type="button" class="admin-btn" data-action="issue-warning" data-account-id="${p.account_id}" data-target-name="${passengerName}">Issue Warning</button></div></td>
    </tr>
  `;
}

function renderPassengerCard(p) {
  const lastBooking = p.last_booking ? new Date(p.last_booking).toLocaleDateString() : '—';
  const isOnline = Boolean(p.is_online);
  const passengerName = escapeHtml(p.name);
  return `
    <div class="admin-mcard">
      <div class="admin-mcard-top">
        <div class="admin-person"><span class="admin-avatar">${passengerInitials(p.name)}</span><div><strong>${passengerName}</strong></div></div>
        ${suspendedPill(p) || pillHtml(isOnline ? 'success' : 'neutral', isOnline ? 'Online' : 'Offline')}
      </div>
      <div class="admin-mcard-rows">
        <div class="admin-mcard-row"><span>Rides booked</span><span>${p.ride_count}</span></div>
        <div class="admin-mcard-row"><span>Last booking</span><span>${escapeHtml(lastBooking)}</span></div>
      </div>
      <div class="admin-mcard-actions">
        ${liftSuspensionButton(p, passengerName)}
        <button type="button" class="admin-btn" data-action="issue-warning" data-account-id="${p.account_id}" data-target-name="${passengerName}">Issue Warning</button>
      </div>
    </div>
  `;
}

// ADMIN — Loyalty Certificates panel. Lists every passenger/driver who's
// crossed at least one 5-ride milestone, with a Grant button for whichever
// milestone they haven't been given yet — see adminController.js's
// listLoyaltyOverview/grantLoyaltyCertificate.
const LOYALTY_GRANT_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5L16.5 5.2V9C16.5 13 13.7 16.3 10 17.5C6.3 16.3 3.5 13 3.5 9V5.2L10 2.5Z"/></svg>';
const LOYALTY_CLOCK_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6v4l2.5 2.5"/><circle cx="10" cy="10" r="7.2"/></svg>';
const LOYALTY_CHECK_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4 4 8-8"/></svg>';

// Kept from the last full fetch so the role tabs can re-filter instantly
// without re-hitting the server on every click.
let loyaltyOverviewCache = [];
let loyaltyActiveRoleFilter = 'all';

function renderLoyaltyRow(r) {
  const roleLabel = r.role === 'driver' ? `Driver${r.detail ? ' · ' + escapeHtml(r.detail) : ''}` : 'Passenger';
  const action = r.eligible
    ? `<button type="button" class="loyalty-grant-btn" data-action="grant-loyalty" data-account-id="${r.account_id}" data-name="${escapeHtml(r.name)}" data-threshold="${r.next_threshold}">${LOYALTY_GRANT_ICON}Grant certificate</button>`
    : `<span class="loyalty-granted-tag">${LOYALTY_CHECK_ICON}Already granted</span>`;
  return `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${roleLabel}</td>
      <td>${r.completed_rides}</td>
      <td><span class="loyalty-milestone-chip">${LOYALTY_CLOCK_ICON}${r.next_threshold} rides</span></td>
      <td>${action}</td>
    </tr>
  `;
}

function renderLoyaltyCard(r) {
  const roleLabel = r.role === 'driver' ? `Driver${r.detail ? ' · ' + escapeHtml(r.detail) : ''}` : 'Passenger';
  const action = r.eligible
    ? `<button type="button" class="loyalty-grant-btn" data-action="grant-loyalty" data-account-id="${r.account_id}" data-name="${escapeHtml(r.name)}" data-threshold="${r.next_threshold}">${LOYALTY_GRANT_ICON}Grant certificate</button>`
    : `<span class="loyalty-granted-tag">${LOYALTY_CHECK_ICON}Already granted</span>`;
  return `
    <div class="admin-mcard">
      <div class="admin-mcard-top">
        <strong style="font-size:14px;">${escapeHtml(r.name)}</strong>
        <span style="font-size:12px;color:var(--muted);">${roleLabel}</span>
      </div>
      <div class="admin-mcard-rows">
        <div class="admin-mcard-row"><span>Completed rides</span><span>${r.completed_rides}</span></div>
        <div class="admin-mcard-row"><span>Milestone</span><span><span class="loyalty-milestone-chip">${LOYALTY_CLOCK_ICON}${r.next_threshold} rides</span></span></div>
      </div>
      <div style="margin-top:10px;">${action}</div>
    </div>
  `;
}

function renderLoyaltyOverviewFiltered() {
  const tbody = document.querySelector('#admin-loyalty-tbody');
  const mobileList = document.querySelector('#admin-loyalty-mobile');
  if (!tbody) return;

  const filtered = loyaltyActiveRoleFilter === 'all'
    ? loyaltyOverviewCache
    : loyaltyOverviewCache.filter(r => r.role === loyaltyActiveRoleFilter);

  if (!filtered.length) {
    const emptyText = loyaltyOverviewCache.length ? 'No one in this category yet.' : 'No one has reached 5 rides yet.';
    tbody.innerHTML = `<tr><td colspan="5">${emptyText}</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="admin-mcard-empty">${emptyText}</p>`;
    return;
  }

  tbody.innerHTML = filtered.map(renderLoyaltyRow).join('');
  if (mobileList) mobileList.innerHTML = filtered.map(renderLoyaltyCard).join('');

  setupLoyaltyGrantButtons(tbody);
  if (mobileList) setupLoyaltyGrantButtons(mobileList);
}

function setupLoyaltyRoleTabs() {
  const tabs = document.querySelectorAll('#admin-loyalty-tabs .loyalty-role-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      loyaltyActiveRoleFilter = tab.getAttribute('data-role');
      renderLoyaltyOverviewFiltered();
    });
  });
}

async function renderAdminLoyaltyOverview() {
  const tbody = document.querySelector('#admin-loyalty-tbody');
  const countBadge = document.querySelector('#admin-loyalty-count');
  if (!tbody) return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/loyalty/overview`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    loyaltyOverviewCache = data.overview || [];
    const eligibleCount = loyaltyOverviewCache.filter(r => r.eligible).length;
    if (countBadge) countBadge.textContent = `${eligibleCount} eligible`;

    renderLoyaltyOverviewFiltered();
  } catch (error) {
    console.warn('Unable to fetch loyalty overview', error);
  }
}

// No confirm-step modal here, matching "Mark Reviewed"'s pattern for this
// class of low-risk admin action (additive, not destructive — worst case
// of a mis-click is an early certificate, not lost data) rather than
// building a dedicated modal for something this routine.
function setupLoyaltyGrantButtons(container) {
  container.querySelectorAll('[data-action="grant-loyalty"]').forEach(button => {
    button.addEventListener('click', async function() {
      const name = this.getAttribute('data-name');
      const threshold = this.getAttribute('data-threshold');
      this.disabled = true;
      try {
        const res = await fetch(`${ADMIN_API_URL}/loyalty/grant`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ account_id: this.getAttribute('data-account-id') })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not grant the certificate');
        showRideFeedback('success', 'Certificate granted', `${name} was awarded a certificate for ${threshold} rides.`);
        renderAdminLoyaltyOverview();
        const historyEl = document.querySelector('#admin-loyalty-history');
        if (historyEl && historyEl.style.display !== 'none') renderAdminLoyaltyHistory();
      } catch (error) {
        showRideFeedback('error', 'Could not grant', error.message || 'Please try again.');
        this.disabled = false;
      }
    });
  });
}

function renderLoyaltyHistoryRow(h) {
  const roleLabel = h.role === 'driver' ? 'Driver' : 'Passenger';
  return `
    <div class="admin-mcard-row">
      <span>${escapeHtml(h.name)} (${roleLabel}) — ${h.milestone_rides} rides</span>
      <span>${new Date(h.granted_at).toLocaleDateString()} by ${escapeHtml(h.granted_by_name || 'admin')}</span>
    </div>
  `;
}

async function renderAdminLoyaltyHistory() {
  const listEl = document.querySelector('#admin-loyalty-history-list');
  if (!listEl) return;
  try {
    const res = await fetch(`${ADMIN_API_URL}/loyalty/history`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const history = data.history || [];
    listEl.innerHTML = history.length
      ? history.map(renderLoyaltyHistoryRow).join('')
      : '<p class="admin-mcard-empty">No certificates granted yet.</p>';
  } catch (error) {
    console.warn('Unable to fetch loyalty history', error);
  }
}

function setupLoyaltyHistoryToggle() {
  const toggleBtn = document.querySelector('#admin-loyalty-history-toggle');
  const historyEl = document.querySelector('#admin-loyalty-history');
  if (!toggleBtn || !historyEl) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = historyEl.style.display === 'none' || !historyEl.style.display;
    historyEl.style.display = isHidden ? 'block' : 'none';
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) renderAdminLoyaltyHistory();
  });
}

async function renderAdminPassengerManagement() {
  const tbody = document.querySelector('#admin-passengers-tbody');
  const mobileList = document.querySelector('#admin-passengers-mobile');
  if (!tbody) return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/passengers`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const passengers = data.passengers || [];

    if (!passengers.length) {
      tbody.innerHTML = '<tr><td colspan="5">No passengers registered yet.</td></tr>';
      if (mobileList) mobileList.innerHTML = '<p class="admin-mcard-empty">No passengers registered yet.</p>';
      return;
    }

    tbody.innerHTML = passengers.map(renderPassengerRow).join('');
    if (mobileList) mobileList.innerHTML = passengers.map(renderPassengerCard).join('');

    setupIssueWarningButtons(tbody);
    if (mobileList) setupIssueWarningButtons(mobileList);
  } catch (error) {
    console.warn('Unable to fetch passengers', error);
  }
}

function renderBookingRow(b) {
  const statusConfig = getRideStatusConfig(b.status);
  const fareText = b.fare != null ? `₱${Number(b.fare).toFixed(0)}` : '—';
  return `
    <tr>
      <td>${escapeHtml(b.passenger_name)}</td>
      <td>${escapeHtml(b.driver_name || '—')}</td>
      <td>${escapeHtml(b.pickup_location)} → ${escapeHtml(b.dropoff_location)}</td>
      <td>${escapeHtml(b.ride_type)}</td>
      <td>${fareText}</td>
      <td>${pillHtml(statusConfig.tone, statusConfig.label)}</td>
      <td>${new Date(b.created_at).toLocaleDateString()}</td>
    </tr>
  `;
}

function renderBookingCard(b) {
  const statusConfig = getRideStatusConfig(b.status);
  const fareText = b.fare != null ? `₱${Number(b.fare).toFixed(0)}` : '—';
  return `
    <div class="admin-mcard">
      <div class="admin-mcard-top">
        <strong style="font-size:14px;">${escapeHtml(b.passenger_name)}</strong>
        ${pillHtml(statusConfig.tone, statusConfig.label)}
      </div>
      <div class="admin-mcard-rows">
        <div class="admin-mcard-row"><span>Driver</span><span>${escapeHtml(b.driver_name || '—')}</span></div>
        <div class="admin-mcard-row"><span>Route</span><span>${escapeHtml(b.pickup_location)} → ${escapeHtml(b.dropoff_location)}</span></div>
        <div class="admin-mcard-row"><span>Type</span><span>${escapeHtml(b.ride_type)}</span></div>
        <div class="admin-mcard-row"><span>Fare</span><span>${fareText}</span></div>
        <div class="admin-mcard-row"><span>Requested</span><span>${new Date(b.created_at).toLocaleDateString()}</span></div>
      </div>
    </div>
  `;
}

// ADMIN — all-bookings audit table, only present on admin.html.
async function renderAdminBookings() {
  const tbody = document.querySelector('#admin-bookings-tbody');
  const mobileList = document.querySelector('#admin-bookings-mobile');
  if (!tbody) return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/bookings`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const bookings = data.bookings || [];

    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="7">No bookings yet.</td></tr>';
      if (mobileList) mobileList.innerHTML = '<p class="admin-mcard-empty">No bookings yet.</p>';
      return;
    }

    tbody.innerHTML = bookings.map(renderBookingRow).join('');
    if (mobileList) mobileList.innerHTML = bookings.map(renderBookingCard).join('');
  } catch (error) {
    console.warn('Unable to fetch bookings', error);
  }
}

function complaintTone(status) {
  return status === 'Pending' ? 'warning' : status === 'Reviewed' ? 'info' : 'success';
}

function renderComplaintRow(c) {
  const route = c.pickup_location ? `${escapeHtml(c.pickup_location)} → ${escapeHtml(c.dropoff_location)}` : '—';
  const againstName = escapeHtml(c.against_name || '—');
  const actions = c.status === 'Resolved' ? '—' : `
    <button type="button" class="admin-btn" data-action="mark-reviewed" data-complaint-id="${c.complaint_id}">Mark Reviewed</button>
    ${c.against_account_id ? `<button type="button" class="admin-btn" data-action="issue-warning" data-account-id="${c.against_account_id}" data-target-name="${againstName}" data-complaint-id="${c.complaint_id}">Issue Warning</button>` : ''}
  `;
  return `
    <tr>
      <td>${escapeHtml(c.filed_by_name || '—')}</td>
      <td>${againstName}</td>
      <td>${escapeHtml(c.category)}</td>
      <td>${route}</td>
      <td>${pillHtml(complaintTone(c.status), c.status)}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td><div class="admin-actions">${actions}</div></td>
    </tr>
  `;
}

function renderComplaintCard(c) {
  const route = c.pickup_location ? `${escapeHtml(c.pickup_location)} → ${escapeHtml(c.dropoff_location)}` : '—';
  const againstName = escapeHtml(c.against_name || '—');
  const actions = c.status === 'Resolved' ? '' : `
    <button type="button" class="admin-btn" data-action="mark-reviewed" data-complaint-id="${c.complaint_id}">Mark Reviewed</button>
    ${c.against_account_id ? `<button type="button" class="admin-btn" data-action="issue-warning" data-account-id="${c.against_account_id}" data-target-name="${againstName}" data-complaint-id="${c.complaint_id}">Warn</button>` : ''}
  `;
  return `
    <div class="admin-mcard">
      <div class="admin-mcard-top">
        <strong style="font-size:14px;">${escapeHtml(c.filed_by_name || '—')} <span style="font-weight:400;color:var(--muted);">vs</span> ${againstName}</strong>
      </div>
      <div class="admin-mcard-rows">
        <div class="admin-mcard-row"><span>Category</span><span>${escapeHtml(c.category)}</span></div>
        <div class="admin-mcard-row"><span>Route</span><span>${route}</span></div>
        <div class="admin-mcard-row"><span>Status</span><span>${pillHtml(complaintTone(c.status), c.status)}</span></div>
        <div class="admin-mcard-row"><span>Filed</span><span>${new Date(c.created_at).toLocaleDateString()}</span></div>
      </div>
      ${actions ? `<div class="admin-mcard-actions">${actions}</div>` : ''}
    </div>
  `;
}

// ADMIN — complaints filed by passengers/drivers against each other, plus
// the "Issue Warning" modal shared between this panel and the driver/
// passenger management tables. Only present on admin.html.
async function renderAdminComplaints() {
  const tbody = document.querySelector('#admin-complaints-tbody');
  const mobileList = document.querySelector('#admin-complaints-mobile');
  if (!tbody) return;

  try {
    const res = await fetch(`${COMPLAINTS_API_URL}/admin`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const complaints = data.complaints || [];

    // Header pill, like "N eligible" on Loyalty Certificates: red while any
    // complaint is still waiting for the admin's review.
    const countBadge = document.querySelector('#admin-complaints-count');
    if (countBadge) {
      const pendingCount = complaints.filter(c => c.status === 'Pending').length;
      countBadge.textContent = `${pendingCount} pending`;
      countBadge.classList.toggle('is-alert', pendingCount > 0);
    }

    if (!complaints.length) {
      tbody.innerHTML = '<tr><td colspan="7">No complaints filed yet.</td></tr>';
      if (mobileList) mobileList.innerHTML = '<p class="admin-mcard-empty">No complaints filed yet.</p>';
      return;
    }

    tbody.innerHTML = complaints.map(renderComplaintRow).join('');
    if (mobileList) mobileList.innerHTML = complaints.map(renderComplaintCard).join('');

    wireComplaintActions(tbody);
    if (mobileList) wireComplaintActions(mobileList);
  } catch (error) {
    console.warn('Unable to fetch complaints', error);
  }
}

function wireComplaintActions(container) {
  container.querySelectorAll('[data-action="mark-reviewed"]').forEach(button => {
    button.addEventListener('click', async function() {
      try {
        await updateComplaintStatusRemote(this.getAttribute('data-complaint-id'), 'Reviewed');
        renderAdminComplaints();
      } catch (error) {
        showRideFeedback('error', 'Could not update', error.message || 'Please try again.');
      }
    });
  });
  setupIssueWarningButtons(container);
}

async function updateComplaintStatusRemote(complaintId, status, adminNotes) {
  const res = await fetch(`${COMPLAINTS_API_URL}/admin/${complaintId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, admin_notes: adminNotes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to update complaint');
  return data;
}

async function issueViolationRemote(accountId, severity, reason, complaintId) {
  const res = await fetch(`${COMPLAINTS_API_URL}/admin/violations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ account_id: accountId, severity, reason, complaint_id: complaintId || null })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to issue warning');
  return data;
}

// Wires every "Issue Warning" button found inside `container` — used by the
// Complaints panel, the driver-management table/cards, and the passenger-
// management table/cards alike, all sharing the one #violation-modal.
function setupIssueWarningButtons(container) {
  container.querySelectorAll('[data-action="lift-suspension"]').forEach(button => {
    button.addEventListener('click', async function() {
      const name = this.getAttribute('data-target-name') || 'This account';
      this.disabled = true;
      try {
        const res = await fetch(`${ADMIN_API_URL}/accounts/${this.getAttribute('data-account-id')}/lift-suspension`, {
          method: 'PUT',
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to lift the suspension');
        showRideFeedback('success', 'Suspension lifted', `${name} can log in again. Their warnings and violations stay on record, so another Violation suspends them again.`);
        renderAdminDriverManagement();
        renderAdminPassengerManagement();
      } catch (error) {
        showRideFeedback('error', 'Could not lift suspension', error.message || 'Please try again.');
        this.disabled = false;
      }
    });
  });
  container.querySelectorAll('[data-action="issue-warning"]').forEach(button => {
    button.addEventListener('click', function() {
      openViolationModal({
        accountId: this.getAttribute('data-account-id'),
        targetName: this.getAttribute('data-target-name'),
        complaintId: this.getAttribute('data-complaint-id') || null
      });
    });
  });
}

let violationModalContext = null;
let violationSelectedSeverity = 'Warning';

function openViolationModal({ accountId, targetName, complaintId }) {
  const modal = document.querySelector('#violation-modal');
  if (!modal) return;
  violationModalContext = { accountId, complaintId };
  violationSelectedSeverity = 'Warning';
  document.querySelector('#violation-modal-target').textContent = `Against: ${targetName || 'this account'}`;
  document.querySelectorAll('.admin-severity-btn').forEach(b => {
    b.classList.toggle('is-selected', b.getAttribute('data-severity') === 'Warning');
  });
  document.querySelector('#violation-reason').value = '';
  document.querySelector('#violation-modal-error').textContent = '';
  modal.classList.remove('hidden');
}

function closeViolationModal() {
  const modal = document.querySelector('#violation-modal');
  if (modal) modal.classList.add('hidden');
  violationModalContext = null;
}

function setupViolationModal() {
  const modal = document.querySelector('#violation-modal');
  if (!modal) return;

  document.querySelector('#violation-modal-cancel').addEventListener('click', closeViolationModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeViolationModal();
  });

  document.querySelectorAll('.admin-severity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      violationSelectedSeverity = btn.getAttribute('data-severity');
      document.querySelectorAll('.admin-severity-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
    });
  });

  document.querySelector('#violation-modal-submit').addEventListener('click', async function() {
    const errorEl = document.querySelector('#violation-modal-error');
    const reason = document.querySelector('#violation-reason').value.trim();
    errorEl.textContent = '';

    if (!reason) {
      errorEl.textContent = 'Please explain why this is being issued.';
      return;
    }
    if (!violationModalContext) return;

    this.disabled = true;
    try {
      const result = await issueViolationRemote(violationModalContext.accountId, violationSelectedSeverity, reason, violationModalContext.complaintId);
      if (result.suspended) {
        // Stays open until the admin taps a button (the usual feedback
        // popup closes itself after 2.6 s, too fast for this one).
        const isDriverAccount = result.role === 'driver';
        const listName = isDriverAccount ? 'Driver management' : 'Passenger management';
        showActionPopup({
          tone: 'error',
          title: result.escalated ? 'Escalated to Violation — account suspended' : 'Violation issued — account suspended',
          message: `${result.escalated ? 'This account already had a prior warning, so this was automatically issued as a Violation. ' : ''}They've been logged out and can't log in. To let them back in, open ${listName} and tap "Lift suspension" on their row.`,
          primaryLabel: `Open ${listName}`,
          onPrimary: () => openAdminPanel(isDriverAccount ? '#driver-management-panel' : '#passenger-management-panel'),
          secondaryLabel: 'Close'
        });
      } else if (result.escalated) {
        showRideFeedback('success', 'Escalated to Violation', 'This account already had a prior warning, so this was automatically issued as a Violation instead.');
      } else {
        showRideFeedback('success', `${result.finalSeverity} issued`, 'The account has been notified on their profile.');
      }
      closeViolationModal();
      renderAdminComplaints();
      renderAdminDriverManagement();
      renderAdminPassengerManagement();
    } catch (error) {
      errorEl.textContent = error.message || 'Please try again.';
    } finally {
      this.disabled = false;
    }
  });
}

function fillDashboardWelcome() {
  const welcomeName = document.querySelector('[data-dashboard-welcome]');
  if (!welcomeName) return;
  const user = getStoredUser();
  // Admin greets as "Admin", not the signed-in admin's own first name —
  // this is a shared account login, not a personal one.
  if (user.role === 'admin') {
    welcomeName.textContent = 'Admin';
  } else {
    const fullName = user.name || user.role || 'User';
    // "Welcome back, Juan" reads friendlier than "Welcome back, Juan Dela Cruz"
    // — just the first name here; the full name is still used elsewhere (reviews, admin tables).
    welcomeName.textContent = fullName.split(' ')[0];
  }

  // Matches the "Good morning, Student 👋" style already used in the
  // homepage phone mockup — real time-of-day greeting here since this is
  // the actual dashboard, not decorative mockup content.
  const greetingEl = document.querySelector('[data-dashboard-greeting]');
  if (greetingEl) {
    const hour = new Date().getHours();
    greetingEl.textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }
}
 
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Masks the local part of an email for display (e.g. in the OTP modal) —
// "gavjvorzki@gmail.com" -> "g*********@gmail.com". Keeps the first
// character so the user can still recognize their own address.
function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return email;
  const masked = local[0] + '*'.repeat(Math.max(local.length - 1, 1));
  return `${masked}@${domain}`;
}

// Show/hide toggle for password fields — wires up every `.toggle-eye`
// button on the page once; each button's `data-target` names the input
// it controls. No-op on pages with no such buttons (only auth.html has any).
function setupPasswordToggles() {
  document.querySelectorAll('.toggle-eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(`#${btn.dataset.target}`);
      if (!input) return;
      const showing = btn.classList.toggle('is-showing');
      input.type = showing ? 'text' : 'password';
      btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    });
  });
}

// Individual-digit-box OTP input — auto-advances focus as each digit is
// typed, moves back on Backspace from an empty box, and accepts a pasted
// 6-digit code in one go. Shared by the registration OTP modal and the
// Forgot Password modal's code step.
// Some phone keyboards (e.g. system language set to Arabic/Persian/Hindi)
// insert their own native numeral glyphs on the numeric keypad instead of
// plain ASCII 0-9 — same key, different Unicode codepoint. Left alone, the
// OTP boxes below would show/store those foreign digits, which then don't
// match the plain-ASCII code the backend actually sent. Converts the
// common non-Latin decimal-digit blocks (Arabic-Indic, Extended
// Arabic-Indic/Persian, Devanagari, Bengali, CJK fullwidth) to 0-9 first.
function normalizeDigits(str) {
  return str.replace(/[٠-٩۰-۹०-९০-৯０-９]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    if (code >= 0x0966 && code <= 0x096F) return String(code - 0x0966);
    if (code >= 0x09E6 && code <= 0x09EF) return String(code - 0x09E6);
    return String(code - 0xFF10);
  });
}

function setupOtpDigitInputs(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const boxes = Array.from(container.querySelectorAll('.otp-digit'));

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = normalizeDigits(box.value).replace(/[^0-9]/g, '').slice(0, 1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !box.value && boxes[i - 1]) {
        boxes[i - 1].focus();
      }
    });
    box.addEventListener('paste', (event) => {
      const pasted = normalizeDigits((event.clipboardData || window.clipboardData).getData('text')).replace(/[^0-9]/g, '');
      if (!pasted) return;
      event.preventDefault();
      pasted.slice(0, boxes.length).split('').forEach((digit, idx) => {
        if (boxes[idx]) boxes[idx].value = digit;
      });
      const nextEmpty = boxes.find((box) => !box.value);
      (nextEmpty || boxes[boxes.length - 1]).focus();
    });
  });
}

function getOtpDigitValue(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return '';
  return Array.from(container.querySelectorAll('.otp-digit')).map((box) => box.value).join('');
}

function clearOtpDigitInputs(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('.otp-digit').forEach((box) => { box.value = ''; });
}

// Live "code expires in mm:ss" countdown, matching the server's
// OTP_TTL_MINUTES (10 minutes = 600s) in otpController.js. Returns a stop
// function so a Resend click can cancel the previous countdown before
// starting a fresh one.
function startOtpCountdown(displayEl, seconds) {
  if (!displayEl) return () => {};
  let remaining = seconds;

  const render = () => {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    displayEl.innerHTML = remaining > 0
      ? `Code expires in <strong>${m}:${s}</strong>`
      : 'Code expired — request a new one';
  };

  render();
  const intervalId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(intervalId);
      remaining = 0;
    }
    render();
  }, 1000);

  return () => clearInterval(intervalId);
}

// The only two pickup/dropoff points in this system are the full campus
// names ("San Isidro Campus (Tarlac State University)", "Main Campus
// (Tarlac State University)") — too long for a route line, so shorten to
// just the campus name for display.
function shortLocationLabel(location) {
  if (!location) return location;
  if (location.startsWith('San Isidro')) return 'San Isidro';
  if (location.startsWith('Main Campus')) return 'Main Campus';
  return location;
}
 
// Centered popup used for quick ride-related confirmations (requested,
// accepted, cancelled, chat errors, etc.) — same overlay/pop-in design
// language as the other modals (.auth-modal, .chat-modal), not a corner
// toast, and not blocking: it auto-dismisses on its own after ~2.6s, or
// immediately if the user clicks it.
const RIDE_FEEDBACK_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>'
};

function showRideFeedback(type, title, message) {
  const existing = document.querySelector('[data-ride-feedback]');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.setAttribute('data-ride-feedback', '');
  overlay.className = 'ride-feedback-overlay';
  overlay.innerHTML = `
    <div class="ride-feedback-modal">
      <div class="ride-feedback-icon ${type}">${RIDE_FEEDBACK_ICONS[type] || RIDE_FEEDBACK_ICONS.info}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  let dismissTimer = null;
  const dismiss = () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    overlay.remove();
  };

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) dismiss();
  });

  dismissTimer = window.setTimeout(dismiss, 2600);
}

// In-app notification popup: same shell as showRideFeedback() above, but it
// stays until the person taps a button, since it carries something to act
// on (a certificate to view, a ride to accept) rather than a confirmation.
function showActionPopup({ tone = 'info', icon, title, message, primaryLabel, onPrimary, secondaryLabel = 'Close', onSecondary }) {
  document.querySelectorAll('[data-action-popup]').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.setAttribute('data-action-popup', '');
  overlay.className = 'ride-feedback-overlay';
  overlay.innerHTML = `
    <div class="ride-feedback-modal action-popup" role="alertdialog" aria-labelledby="action-popup-title" aria-describedby="action-popup-message">
      <div class="ride-feedback-icon ${tone}">${icon || RIDE_FEEDBACK_ICONS[tone] || RIDE_FEEDBACK_ICONS.info}</div>
      <h3 id="action-popup-title">${escapeHtml(title)}</h3>
      <p id="action-popup-message">${escapeHtml(message)}</p>
      <div class="action-popup-buttons">
        ${primaryLabel ? `<button type="button" class="action-popup-primary">${escapeHtml(primaryLabel)}</button>` : ''}
        ${secondaryLabel ? `<button type="button" class="action-popup-secondary">${escapeHtml(secondaryLabel)}</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  const secondary = overlay.querySelector('.action-popup-secondary');
  if (secondary) {
    secondary.addEventListener('click', () => {
      close();
      if (onSecondary) onSecondary();
    });
  }
  const primary = overlay.querySelector('.action-popup-primary');
  if (primary) {
    primary.addEventListener('click', () => {
      close();
      if (onPrimary) onPrimary();
    });
  }
  const firstButton = primary || secondary;
  if (firstButton) firstButton.focus();
}

const CERTIFICATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.6 13.9L7 22l5-3 5 3-1.6-8.1"/><path d="M9.8 9l1.5 1.5L14.5 7.5"/></svg>';

// "You got a certificate" for passengers and drivers: live when the admin
// grants it, or the next time they open the app if they weren't online
// then, and only once. "Seen" is kept on the server (seenAt), because some
// browsers wipe localStorage on close and the popup returned every visit.
// localStorage is only the fallback for a server without that column.
async function checkNewLoyaltyCertificate() {
  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'passenger' && user.role !== 'driver') || !user.accountId) return;

  const status = await fetchLoyaltyStatus();
  const latest = status && status.latestCertificate;
  if (!latest) return;

  const seenKey = `certificateSeen:${user.accountId}`;
  let seenLocally = 0;
  try {
    seenLocally = Number(localStorage.getItem(seenKey)) || 0;
  } catch (error) {
    // Storage unavailable; the server's record decides.
  }
  const serverTracksSeen = Object.prototype.hasOwnProperty.call(latest, 'seenAt');
  const markSeenOnServer = () => {
    if (!serverTracksSeen || !latest.certificateId) return;
    fetch(`${RIDES_API_URL}/loyalty/${latest.certificateId}/seen`, { method: 'PUT', headers: getAuthHeaders() })
      .catch(() => {});
  };

  if (serverTracksSeen) {
    if (latest.seenAt) return;
    // Already shown on this device before the server kept track: record it
    // there quietly instead of showing it again.
    if (Number(latest.milestoneRides) <= seenLocally) return markSeenOnServer();
  } else if (Number(latest.milestoneRides) <= seenLocally) {
    return;
  }
  markSeenOnServer();
  try {
    localStorage.setItem(seenKey, String(latest.milestoneRides));
  } catch (error) {
    // See above.
  }

  const profilePage = user.role === 'driver' ? 'driver-profile.html' : 'passenger-profile.html';
  const onProfilePage = window.location.pathname.endsWith(profilePage);
  showActionPopup({
    tone: 'success',
    icon: CERTIFICATE_ICON,
    title: 'You earned a loyalty certificate!',
    message: user.role === 'driver'
      ? `The TODA admin granted your certificate for completing ${latest.milestoneRides} trips. Thank you for driving with GoTSUian!`
      : `The TODA admin granted your certificate for completing ${latest.milestoneRides} rides. Thank you for riding with GoTSUian!`,
    primaryLabel: 'View certificate',
    onPrimary: () => {
      if (onProfilePage) openLoyaltyCard();
      else window.location.href = `${profilePage}#loyalty-card`;
    }
  });
}

// The profile page's loyalty card starts collapsed. "View certificate"
// (directly, or by arriving at profile#loyalty-card) opens it and scrolls to
// it. It's revealed only once renderLoyaltyStatus confirms a grant, hence
// the short wait for it to become visible.
function openLoyaltyCard(attempt = 0) {
  const card = document.querySelector('#loyalty-card');
  if (!card) return;
  if (card.style.display === 'none' && attempt < 20) {
    setTimeout(() => openLoyaltyCard(attempt + 1), 150);
    return;
  }
  card.classList.remove('is-collapsed');
  const toggle = card.querySelector('.profile-panel-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Collapse this section');
  }
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// A driver can't log in until the admin approves them, and nothing tells
// them when that happens. The first time an approved driver opens their
// dashboard, welcome them once. Only for drivers with no trips at all, so
// drivers approved long before this existed aren't told it now.
async function checkDriverApprovalWelcome() {
  const user = getStoredUser();
  if (!document.querySelector('#driver-ride-requests')) return;
  if (!isAuthenticated() || user.role !== 'driver' || user.accountStatus !== 'Active' || !user.accountId) return;

  const seenKey = `approvalWelcomed:${user.accountId}`;
  try {
    if (localStorage.getItem(seenKey)) return;
  } catch (error) {
    return;
  }
  const rides = await fetchDriverRides();
  try {
    localStorage.setItem(seenKey, '1');
  } catch (error) {
    // Nothing to do; the check above already returned if storage was missing.
  }
  if (rides.length) return;

  showActionPopup({
    tone: 'success',
    title: 'Welcome to GoTSUian!',
    message: 'The TODA admin has approved your driver account. Switch to Online to start receiving ride requests.',
    primaryLabel: 'Got it',
    secondaryLabel: null
  });
}

// New-ride alert for drivers: a popup with the trip and its fare, a short
// chime and, on Android, a vibration. Browsers only allow sound after the
// page has been tapped once, so the chime is armed on the driver's first tap.
let rideAlertAudio = null;
let lastAlertedRideId = null;

function unlockRideAlertAudio() {
  try {
    if (!rideAlertAudio) rideAlertAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (rideAlertAudio.state === 'suspended') rideAlertAudio.resume();
  } catch (error) {
    rideAlertAudio = null;
  }
}

function playRideAlertSound() {
  const ctx = rideAlertAudio;
  if (!ctx || ctx.state !== 'running') return;
  // Two rising notes, so it reads as "something arrived" rather than an error.
  [[0, 880], [0.18, 1175]].forEach(([offset, frequency]) => {
    const start = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.17);
  });
}

// Drivers on their dashboard hear new requests; passengers hear their ride
// being accepted (see checkRideMilestones).
function setupRideAlerts() {
  const user = getStoredUser();
  if (!isAuthenticated()) return;
  const driverDashboard = user.role === 'driver' && document.querySelector('#driver-ride-requests');
  if (!driverDashboard && user.role !== 'passenger') return;
  document.addEventListener('pointerdown', unlockRideAlertAudio, { once: true });
  document.addEventListener('keydown', unlockRideAlertAudio, { once: true });
}

async function alertDriverOfNewRides(newGroups) {
  // Only a driver who has switched themselves Online is looking for work.
  try {
    const res = await fetch(`${RIDES_API_URL}/driver/availability`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (!data.is_online) return;
    }
  } catch (error) {
    // Couldn't check; alert anyway rather than risk a missed ride.
  }

  const group = newGroups[newGroups.length - 1];
  const ride = group.type === 'solo' ? group.ride : group.riders[0];
  if (!ride || ride.ride_id === lastAlertedRideId) return;
  lastAlertedRideId = ride.ride_id;

  playRideAlertSound();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  const more = newGroups.length > 1 ? ` (and ${newGroups.length - 1} more)` : '';
  showActionPopup({
    tone: 'info',
    icon: '<img src="../images/tricycle.png" alt="" style="width:100%;height:100%;border-radius:50%">',
    title: 'New ride request',
    message: `${ride.pickup_location} → ${ride.dropoff_location}. Estimated fare ${formatFareWithDistance(ride.fare || 0, ride.distance_km)}${ride.booked_for_name ? `. Booked for ${ride.booked_for_name} (${formatPhMobile(ride.booked_for_contact)})` : ''}${more}.`,
    primaryLabel: 'Accept',
    secondaryLabel: 'Later',
    onPrimary: () => {
      const acceptBtn = document.querySelector(`#driver-ride-requests [data-action="accept-ride"][data-ride-id="${ride.ride_id}"]`);
      if (acceptBtn) {
        acceptBtn.click();
      } else {
        showRideFeedback('info', 'Request no longer open', 'Another driver may have accepted it already.');
      }
    }
  });
}
 
function getRideLifecycleSteps(status) {
  const steps = ['Pending', 'Accepted', 'Picked Up', 'In Progress', 'Completed'];
  const shortLabels = ['Pending', 'Accept', 'Picked', 'Trip', 'Done'];
  const statusIndex = steps.indexOf(status);

  return steps.map((step, index) => ({
    label: step,
    shortLabel: shortLabels[index],
    active: index <= statusIndex,
    complete: index < statusIndex
  }));
}
 
// Road-snapped paths for our two fixed campus routes, fetched once from
// OSRM (router.project-osrm.org) and hardcoded here — since there are only
// ever two possible routes in this system, there's no need to call a
// routing API live on every ride; these are the actual road geometry.
const ROUTE_SAN_ISIDRO_TO_MAIN = [[15.502749, 120.578693], [15.502711, 120.57869], [15.502646, 120.578686], [15.502546, 120.578722], [15.502463, 120.578762], [15.501538, 120.579205], [15.501465, 120.579232], [15.501377, 120.579232], [15.501273, 120.579205], [15.500987, 120.579112], [15.499926, 120.578773], [15.499765, 120.578717], [15.499075, 120.578494], [15.498456, 120.578293], [15.498699, 120.578124], [15.49865, 120.578054], [15.49836, 120.578262], [15.498313, 120.578296], [15.497141, 120.579117], [15.496965, 120.579245], [15.496579, 120.579518], [15.496432, 120.579615], [15.496244, 120.579747], [15.496038, 120.579892], [15.495946, 120.579962], [15.495824, 120.580045], [15.495801, 120.58006], [15.495316, 120.580393], [15.495178, 120.580492], [15.494699, 120.580841], [15.494433, 120.581034], [15.494102, 120.581266], [15.493598, 120.581618], [15.493447, 120.581729], [15.493087, 120.581996], [15.492933, 120.582108], [15.492767, 120.582224], [15.492617, 120.58233], [15.492238, 120.582613], [15.492018, 120.582793], [15.491637, 120.583097], [15.491407, 120.583297], [15.491314, 120.583382], [15.491123, 120.583556], [15.490749, 120.583926], [15.490708, 120.583969], [15.490691, 120.584042], [15.490675, 120.584059], [15.490578, 120.584154], [15.490544, 120.584188], [15.490057, 120.584763], [15.490023, 120.584808], [15.488324, 120.5869], [15.4883, 120.586929], [15.488251, 120.58694], [15.488175, 120.587014], [15.488154, 120.587015], [15.488135, 120.587022], [15.488044, 120.586977], [15.487957, 120.58693], [15.487317, 120.586584], [15.486787, 120.586273], [15.486598, 120.58614], [15.486456, 120.586036], [15.486441, 120.586008], [15.48642, 120.585986], [15.486394, 120.58597], [15.486364, 120.585962], [15.486334, 120.585964], [15.486305, 120.585974], [15.48628, 120.585992], [15.48626, 120.586016], [15.486248, 120.586046], [15.486245, 120.586077], [15.48625, 120.586108], [15.486179, 120.586357], [15.48598, 120.58707], [15.485915, 120.587013], [15.48579, 120.586997], [15.48542, 120.586949], [15.485206, 120.586913], [15.485166, 120.586906], [15.485025, 120.586901], [15.484896, 120.586913], [15.484739, 120.586938], [15.484223, 120.58707], [15.484033, 120.587118], [15.484042, 120.587183], [15.484548, 120.587052], [15.484751, 120.58701], [15.485029, 120.586976], [15.485135, 120.586981], [15.485195, 120.586982], [15.485175, 120.587098], [15.485127, 120.587373]];

const ROUTE_MAIN_TO_SAN_ISIDRO = [[15.485127, 120.587373], [15.485175, 120.587098], [15.485195, 120.586982], [15.485406, 120.587016], [15.48579, 120.587079], [15.485909, 120.587099], [15.48598, 120.58707], [15.48611, 120.587077], [15.486338, 120.587107], [15.486364, 120.587108], [15.486451, 120.587129], [15.486662, 120.58718], [15.486787, 120.587238], [15.486897, 120.587301], [15.486993, 120.587365], [15.487003, 120.587371], [15.487138, 120.587465], [15.487345, 120.587621], [15.487516, 120.587758], [15.487825, 120.587502], [15.488009, 120.587303], [15.488041, 120.587265], [15.488065, 120.587238], [15.488139, 120.587161], [15.488164, 120.587168], [15.488189, 120.587165], [15.488212, 120.587153], [15.48823, 120.587134], [15.488241, 120.58711], [15.488243, 120.587084], [15.48824, 120.587067], [15.488233, 120.58705], [15.488292, 120.586981], [15.4883, 120.586929], [15.488324, 120.5869], [15.490023, 120.584808], [15.490057, 120.584763], [15.490544, 120.584188], [15.490578, 120.584154], [15.490675, 120.584059], [15.490691, 120.584042], [15.490753, 120.58402], [15.49079, 120.583975], [15.49107, 120.58369], [15.491216, 120.583549], [15.491431, 120.583359], [15.49153, 120.583272], [15.492051, 120.582844], [15.492144, 120.58277], [15.492466, 120.582514], [15.492795, 120.582274], [15.493115, 120.582043], [15.493635, 120.581669], [15.494132, 120.581319], [15.494278, 120.581216], [15.494473, 120.581078], [15.494528, 120.58104], [15.495214, 120.580539], [15.495324, 120.580459], [15.495353, 120.58044], [15.495859, 120.580102], [15.495979, 120.580019], [15.496069, 120.579956], [15.49647, 120.579675], [15.496611, 120.579576], [15.496759, 120.579476], [15.497007, 120.5793], [15.497192, 120.579176], [15.498357, 120.578363], [15.498456, 120.578293], [15.499075, 120.578494], [15.499765, 120.578717], [15.499926, 120.578773], [15.500987, 120.579112], [15.501273, 120.579205], [15.501377, 120.579232], [15.501465, 120.579232], [15.501538, 120.579205], [15.502463, 120.578762], [15.502546, 120.578722], [15.502646, 120.578686], [15.502711, 120.57869], [15.502749, 120.578693]];

const RIDES_API_URL = '/api/rides';
const ADMIN_API_URL = '/api/admin';

// Admin's "Fare settings" card: the two ordinance figures every GPS-pickup
// ride is priced with (see server/fareSettings.js), with a worked example
// that updates as they're typed so the admin can see what a change means.
const FARE_EXAMPLE_KM = 3.2;

function setupAdminFareSettings() {
  const form = document.querySelector('#fare-settings-form');
  if (!form || !isAuthenticated() || getStoredUser().role !== 'admin') return;
  const firstKm = form.querySelector('#fare-first-km');
  const perKm = form.querySelector('#fare-per-km');
  const basis = form.querySelector('#fare-basis');
  const example = form.querySelector('#fare-example');
  const status = form.querySelector('#fare-save-status');
  const saveBtn = form.querySelector('#fare-save-btn');

  const setStatus = (text, tone) => {
    status.textContent = text;
    status.className = `fare-save-status${tone ? ` is-${tone}` : ''}`;
  };

  // Same rule as the server: a started kilometre counts as a whole one.
  const renderExample = () => {
    const first = Number(firstKm.value);
    const rate = Number(perKm.value);
    if (!Number.isFinite(first) || !Number.isFinite(rate) || firstKm.value === '' || perKm.value === '') {
      example.textContent = 'Enter both amounts to see an example.';
      return;
    }
    const extra = Math.ceil(FARE_EXAMPLE_KM - 1);
    const fare = Math.round(first + rate * extra);
    example.innerHTML = `A <strong>${FARE_EXAMPLE_KM} km</strong> trip costs <strong>₱${fare}</strong> `
      + `(₱${first} for the first km + ${extra} × ₱${rate}). A started kilometre counts as a whole one.`;
  };

  const fill = (settings) => {
    firstKm.value = settings.first_km_fare;
    perKm.value = settings.per_km_fare;
    basis.value = settings.basis || '';
    renderExample();
  };

  fetch(`${ADMIN_API_URL}/fare-settings`, { headers: getAuthHeaders() })
    .then(res => res.ok ? res.json() : Promise.reject(new Error('Could not load fare settings')))
    .then(fill)
    .catch(error => {
      example.textContent = '';
      setStatus(error.message, 'error');
    });

  firstKm.addEventListener('input', () => { renderExample(); setStatus(''); });
  perKm.addEventListener('input', () => { renderExample(); setStatus(''); });
  basis.addEventListener('input', () => setStatus(''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
    setStatus('Saving...');
    try {
      const res = await fetch(`${ADMIN_API_URL}/fare-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ first_km_fare: firstKm.value, per_km_fare: perKm.value, basis: basis.value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save fare settings.');
      fill(data);
      setStatus('Saved. New bookings use these rates.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}
const PROFILE_API_URL = '/api/profile';
const REVIEWS_API_URL = '/api/reviews';
const COMPLAINTS_API_URL = '/api/complaints';
const OTP_API_URL = '/api/otp';
const MESSAGES_API_URL = '/api/messages';
const SOCKET_URL = window.location.origin;

// Formats a JS Date as 'YYYY-MM-DD HH:MM:SS' in local time, which is what
// MySQL's DATETIME column expects — avoids timezone drift from ISO strings.
function toMySQLDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Groups a flat list of ride rows by pool_id, so a shared trip with 2-4
// riders renders as one card instead of one per passenger.
function groupRidesByPool(rides) {
  const pools = {};
  const grouped = [];
  rides.forEach(ride => {
    if (!ride.pool_id) {
      grouped.push({ poolId: null, riders: [ride] });
      return;
    }
    if (!pools[ride.pool_id]) {
      pools[ride.pool_id] = { poolId: ride.pool_id, riders: [] };
      grouped.push(pools[ride.pool_id]);
    }
    pools[ride.pool_id].riders.push(ride);
  });
  return grouped;
}

async function fetchMyRides() {
  const user = getStoredUser();
  if (!user.accountId) return [];
  try {
    const res = await fetch(`${RIDES_API_URL}/mine`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rides || [];
  } catch (error) {
    console.warn('Unable to fetch your rides', error);
    return [];
  }
}

async function fetchPendingRides() {
  try {
    const res = await fetch(`${RIDES_API_URL}/pending`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rides || [];
  } catch (error) {
    console.warn('Unable to fetch pending rides', error);
    return [];
  }
}

async function fetchDriverRides() {
  const user = getStoredUser();
  if (!user.accountId) return [];
  try {
    const res = await fetch(`${RIDES_API_URL}/driver`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rides || [];
  } catch (error) {
    console.warn('Unable to fetch your accepted rides', error);
    return [];
  }
}

async function createRideRequest(payload) {
  const res = await fetch(RIDES_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to request a ride');
  return data;
}

// Previews the real fare for a custom "Others" drop-off (geocodes the
// typed text and measures the distance server-side) without creating a
// ride yet — lets the confirm modal show the actual number instead of a
// placeholder. Throws with a passenger-facing message on failure (location
// not found, or outside the service area).
async function quoteOthersDropoff(pickupLocation, dropoffText, options) {
  const { pickupIsCustom, pickupCoords, dropoffCoords } = options || {};
  const pickupFromSearch = pickupMode === 'search';
  // While the server restarts (every deploy) or is briefly overloaded,
  // Railway answers for it with a reply that has no "error" field, and the
  // passenger used to get a bare "Could not calculate a fare", as if the
  // place were the problem. Those failures are flagged .retryable so the
  // booking form can try again by itself.
  const unreachable = () => {
    const err = new Error("Couldn't reach the GoTSUian server. Please try again in a moment.");
    err.retryable = true;
    return err;
  };
  let res;
  try {
    res = await fetch(`${RIDES_API_URL}/others-quote`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        pickup_location: pickupLocation,
        dropoff_text: dropoffText,
        pickup_is_custom: !!pickupIsCustom,
        pickup_lat: pickupCoords ? pickupCoords.lat : null,
        pickup_lng: pickupCoords ? pickupCoords.lng : null,
        dropoff_lat: dropoffCoords ? dropoffCoords.lat : null,
        dropoff_lng: dropoffCoords ? dropoffCoords.lng : null,
        pickup_from_search: pickupFromSearch
      })
    });
  } catch (networkError) {
    throw unreachable();
  }
  let data = {};
  try {
    data = await res.json();
  } catch (parseError) {
    // Not JSON: a proxy or error page rather than our server's answer.
  }
  if (res.ok) return data;
  if (res.status === 401) throw new Error('Your session has expired. Please log out and log in again.');
  if (res.status >= 500 || !data.error) throw unreachable();
  throw new Error(data.error);
}

// "₱35 · 3.2 km" for a distance-priced ride, just "₱35" for anything priced
// the old way (campus routes, rides booked before distance was recorded).
function formatFareWithDistance(fare, distanceKm) {
  const peso = `₱${Number(fare).toFixed(0)}`;
  return distanceKm != null && distanceKm !== '' ? `${peso} · ${Number(distanceKm).toFixed(1)} km` : peso;
}

// The estimated fare under the drop-off box, and in the Solo button, as soon
// as there's both a GPS pickup and a chosen drop-off (the IT expert's "compute
// the fare automatically"). Asks the server, which prices the road distance
// with the ordinance rates and keeps the quote, so booking charges exactly
// this figure. Shows no number rather than a wrong one when it can't price.
let fareEstimateToken = 0;
let lastFareEstimateKey = null;

// The fare sits in the right side of the Solo card in "Your trip": a short
// status while there's nothing to show yet, then the peso figure with the
// distance under it. Only an error gets the line under the card, since it
// needs a full sentence.
function setFareEstimate(state, { main, sub = '', message = '' }) {
  const box = document.querySelector('#solo-fare-box');
  const mainEl = document.querySelector('#solo-fare');
  const subEl = document.querySelector('#solo-km');
  const footLabel = document.querySelector('#ride-card-foot-label');
  const note = document.querySelector('#fare-estimate');
  if (box) box.className = `ride-card-price is-${state}`;
  if (mainEl) mainEl.textContent = main;
  if (subEl) subEl.textContent = sub;
  if (footLabel) footLabel.textContent = state === 'ready' ? 'Estimated fare' : 'Priced by road distance';
  if (note) {
    note.className = `fare-estimate${message ? ' is-error' : ''}`;
    note.textContent = message;
  }
}

function resetFareEstimate() {
  fareEstimateToken++;
  lastFareEstimateKey = null;
  setFareEstimate('pending', { main: 'Choose a drop-off' });
}

// A few automatic retries, further apart each time, when the server
// couldn't be reached (see quoteOthersDropoff); a real "place not found"
// style answer is shown at once. Any new drop-off or pickup bumps
// fareEstimateToken, which cancels a pending retry.
const FARE_RETRY_DELAYS_MS = [3000, 6000, 12000];
let fareEstimateRetries = 0;

async function refreshFareEstimate() {
  const pickupInput = document.querySelector('#pickup-other-text');
  const dropoffInput = document.querySelector('#dropoff-other-text');
  if (!pickupInput || !dropoffInput || !document.querySelector('#solo-fare-box')) return;

  const dropoffText = dropoffInput.value.trim();
  if (!dropoffText) return resetFareEstimate();

  const pickupCoords = customLocationCoords.pickup;
  if (pickupCoords && pickupMode === 'gps' && !isInsideServiceArea(pickupCoords.lat, pickupCoords.lng)) {
    lastFareEstimateKey = null;
    return setFareEstimate('error', { main: '—', message: 'Outside the GoTSUian service area (Tarlac).' });
  }
  if (!pickupCoords || pickupInput.dataset.detecting === 'true') {
    lastFareEstimateKey = null;
    return setFareEstimate('pending', { main: pickupMode === 'search' ? 'Choose a pickup' : 'Finding your location…' });
  }

  const dropoffCoords = customLocationCoords.dropoff;
  // Leaving the box or re-picking the same place mustn't ask again.
  const key = JSON.stringify([pickupCoords, dropoffCoords || dropoffText]);
  if (key === lastFareEstimateKey) return;
  lastFareEstimateKey = key;

  const token = ++fareEstimateToken;
  setFareEstimate('loading', { main: 'Calculating…' });
  fareEstimateRetries = 0;
  runFareEstimate(token, pickupInput, dropoffText, pickupCoords, dropoffCoords);
}

async function runFareEstimate(token, pickupInput, dropoffText, pickupCoords, dropoffCoords) {
  try {
    const quote = await quoteOthersDropoff(pickupInput.value.trim(), dropoffText, {
      pickupIsCustom: true,
      pickupCoords,
      dropoffCoords
    });
    if (token !== fareEstimateToken) return;
    setFareEstimate('ready', {
      main: `₱${Number(quote.fare).toFixed(0)}`,
      sub: quote.distanceKm != null ? `${Number(quote.distanceKm).toFixed(1)} km` : ''
    });
  } catch (error) {
    if (token !== fareEstimateToken) return;
    if (error.retryable && fareEstimateRetries < FARE_RETRY_DELAYS_MS.length) {
      const delay = FARE_RETRY_DELAYS_MS[fareEstimateRetries++];
      setFareEstimate('loading', { main: 'Calculating…', message: 'The server is busy. Trying again…' });
      setTimeout(() => {
        if (token === fareEstimateToken) runFareEstimate(token, pickupInput, dropoffText, pickupCoords, dropoffCoords);
      }, delay);
      return;
    }
    lastFareEstimateKey = null;
    setFareEstimate('error', { main: '—', message: error.message || 'Could not work out the fare for that place.' });
  }
}

function setupFareEstimate() {
  const dropoffInput = document.querySelector('#dropoff-other-text');
  if (!dropoffInput || !document.querySelector('#solo-fare-box')) return;
  // The card's footer names what the fare is based on; show whatever the
  // admin has set rather than the default written into the page.
  fetch(`${RIDES_API_URL}/fare-settings`)
    .then(res => res.ok ? res.json() : null)
    .then(settings => {
      const basisEl = document.querySelector('#ride-card-basis');
      if (settings && settings.basis && basisEl) basisEl.textContent = settings.basis;
    })
    .catch(() => {});
  // Typing makes the shown figure stale; it's priced again once a place is
  // picked from the suggestions or the passenger leaves the box.
  dropoffInput.addEventListener('input', resetFareEstimate);
  dropoffInput.addEventListener('change', refreshFareEstimate);
  // After a failed estimate, tapping the trip card tries again.
  const card = document.querySelector('.ride-type-btn.ride-card');
  if (card) {
    card.addEventListener('click', () => {
      const box = document.querySelector('#solo-fare-box');
      if (box && box.classList.contains('is-error')) refreshFareEstimate();
    });
  }
}

// Fire-and-forget — attaches a GPS snapshot to an already-created ride once
// it resolves. Never blocks or surfaces errors to the passenger; the ride
// itself was already created successfully regardless of whether this lands.
async function updateRidePickupLocation(rideId, lat, lng) {
  try {
    await fetch(`${RIDES_API_URL}/${rideId}/pickup-location`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ lat, lng })
    });
  } catch (error) {
    console.warn('Could not attach pickup location to ride', error);
  }
}

// DRIVER's "on shift" status — only present on driver.html, and only wired
// up if the driver role is logged in, so this is a safe no-op everywhere
// else. No manual toggle: a driver goes online automatically at login (see
// loginDriver in authController.js) and offline automatically at logout
// (see setupLogoutButtons below) — this just displays the current state.
function setupAvailabilityToggle() {
  const label = document.querySelector('#availability-label');
  if (!label) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  const dot = document.querySelector('.availability-status-dot');

  // Deliberately doesn't touch the label on a failed fetch — the HTML's
  // hardcoded "Offline" default used to sit there unchanged whenever this
  // request was slow or errored (e.g. right after the tab comes back from
  // being backgrounded/discarded by the browser), reading as a real offline
  // state even though the driver's actual is_online in the DB never moved.
  function refreshAvailabilityLabel() {
    fetch(`${RIDES_API_URL}/driver/availability`, { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        label.textContent = data.is_online ? 'Online' : 'Offline';
        if (dot) dot.classList.toggle('is-online', Boolean(data.is_online));
      })
      .catch(error => console.warn('Unable to fetch availability', error));
  }

  label.textContent = 'Checking…';
  refreshAvailabilityLabel();

  // Re-verify whenever the driver switches back to this tab — otherwise a
  // stale label (from before the tab was backgrounded) can sit there for
  // the rest of the session with nothing to correct it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAvailabilityLabel();
  });
}

// DRIVER GPS SHARING — automatically starts sending location while the
// driver has an active ride (Accepted/Picked Up/In Progress), and stops the
// moment it isn't, so a driver is never tracked while idle. Only present on
// driver.html; safe no-op everywhere else.
let driverWatchId = null;
let lastLocationSentAt = 0;

async function syncDriverLocationSharing() {
  const label = document.querySelector('#location-sharing-label');
  if (!label) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  const rides = await fetchDriverRides();
  const hasActiveRide = rides.some(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (hasActiveRide && driverWatchId === null) {
    startDriverLocationSharing(label);
  } else if (!hasActiveRide && driverWatchId !== null) {
    stopDriverLocationSharing(label);
  }
}

function startDriverLocationSharing(label) {
  if (!navigator.geolocation) {
    label.textContent = 'Location sharing not supported on this device.';
    return;
  }

  driverWatchId = navigator.geolocation.watchPosition(
    (position) => {
      label.textContent = '📍 Sharing your location with your passenger';
      lastKnownDriverPosition = [position.coords.latitude, position.coords.longitude];
      placeDriverMapMarker();
      if (driverEtaRide) refreshRideEta(driverEtaRide);
      const now = Date.now();
      if (now - lastLocationSentAt < 7000) return;
      lastLocationSentAt = now;
      fetch(`${RIDES_API_URL}/driver/location`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude })
      }).catch(error => console.warn('Unable to send location', error));
    },
    (error) => {
      console.warn('Geolocation error', error);
      label.textContent = 'Could not access your location — check location permissions.';
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stopDriverLocationSharing(label) {
  if (driverWatchId !== null) {
    navigator.geolocation.clearWatch(driverWatchId);
    driverWatchId = null;
  }
  label.textContent = '';
}

// DRIVER'S OWN "YOU ARE HERE" MARKER WHILE IDLE — mirrors
// syncPassengerSelfLocationSharing above, but for the opposite window: a
// driver isn't tracked/sent anywhere while idle (see the comment on
// syncDriverLocationSharing), so without this a driver waiting for a
// booking sees a blank map with no sense of their own position. This is
// purely local display, same as the passenger's version — never sent to
// the server, since nothing else needs an idle driver's position.
let driverSelfWatchId = null;
let driverSelfMarker = null;

async function syncDriverSelfLocationSharing() {
  if (!driverMapInstance || !navigator.geolocation) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  const rides = await fetchDriverRides();
  const hasActiveRide = rides.some(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (!hasActiveRide && driverSelfWatchId === null) {
    startDriverSelfLocationSharing();
  } else if (hasActiveRide && driverSelfWatchId !== null) {
    stopDriverSelfLocationSharing();
  }
}

function startDriverSelfLocationSharing() {
  driverSelfWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const point = [position.coords.latitude, position.coords.longitude];
      if (!driverSelfMarker) {
        const icon = L.divIcon({
          className: 'you-are-here-icon',
          html: '<span class="you-are-here-pulse"></span><span class="you-are-here-dot"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        driverSelfMarker = L.marker(point, { icon, zIndexOffset: 1100 }).addTo(driverMapInstance).bindPopup('You are here');
        // Same reason as the passenger's own marker: a driver waiting for a
        // booking outside the campus area would otherwise be staring at a map
        // of somewhere they aren't.
        driverMapInstance.setView(point, 15);
      } else {
        driverSelfMarker.setLatLng(point);
      }
    },
    (error) => console.warn('Could not get driver location', error),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stopDriverSelfLocationSharing() {
  if (driverSelfWatchId !== null) {
    navigator.geolocation.clearWatch(driverSelfWatchId);
    driverSelfWatchId = null;
  }
  if (driverSelfMarker) {
    driverMapInstance.removeLayer(driverSelfMarker);
    driverSelfMarker = null;
  }
}

// PASSENGER-facing reassurance indicator — only present on passenger.html.
async function renderAvailableDriversIndicator() {
  const dot = document.querySelector('#availability-dot');
  const text = document.querySelector('#availability-text');
  if (!dot || !text) return;

  try {
    const res = await fetch(`${RIDES_API_URL}/available-drivers-count`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (data.count > 0) {
      dot.classList.add('is-available');
      text.textContent = `${data.count} driver${data.count === 1 ? '' : 's'} available right now`;
    } else {
      dot.classList.remove('is-available');
      // "No drivers online" and "drivers online but all busy with a trip
      // right now" read very differently to a waiting passenger — don't
      // conflate them just because neither has anyone free at this instant.
      text.textContent = data.onlineCount > 0
        ? 'All online drivers are currently on a trip — your request may take a bit longer.'
        : 'No drivers online right now — requests may take a bit longer.';
    }
  } catch (error) {
    console.warn('Unable to fetch available drivers count', error);
  }
}

// Tapping the availability indicator opens a list of who's actually online
// right now (name + plate number only — no contact info or live location
// for drivers a passenger isn't riding with yet) so they have something to
// check the tricycle that shows up against, for their own safety.
function setupAvailabilityIndicatorClick() {
  const indicator = document.querySelector('#availability-indicator');
  if (!indicator) return;
  indicator.addEventListener('click', openAvailableDriversModal);
}

function openAvailableDriversModal() {
  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.innerHTML = `
    <div class="chat-modal driver-list-modal">
      <div class="chat-modal-header">
        <h3>Drivers online right now</h3>
        <button type="button" class="chat-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="driver-list-body">
        <p class="driver-list-loading">Loading...</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function closeModal() {
    overlay.remove();
    document.body.style.overflow = '';
  }

  overlay.querySelector('.chat-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) closeModal();
  });

  const body = overlay.querySelector('.driver-list-body');

  fetch(`${RIDES_API_URL}/available-drivers`, { headers: getAuthHeaders() })
    .then(res => res.ok ? res.json() : Promise.reject(new Error('Could not load drivers')))
    .then(data => {
      const drivers = data.drivers || [];
      if (!drivers.length) {
        body.innerHTML = '<p class="driver-list-empty">No drivers online right now.</p>';
        return;
      }
      body.innerHTML = drivers.map(d => {
        const plateText = d.plate_number || '—';
        return `
        <div class="driver-list-item">
          <span class="driver-list-icon"><img src="../images/tricycle.png" alt="Tricycle"></span>
          <div class="driver-list-info">
            <strong class="driver-list-label">${escapeHtml(d.name || 'Driver')}</strong>
            <span class="driver-list-plate">${escapeHtml(plateText)}</span>
          </div>
        </div>
      `;
      }).join('');
    })
    .catch(error => {
      body.innerHTML = `<p class="driver-list-empty">${escapeHtml(error.message || 'Could not load drivers.')}</p>`;
    });
}

async function acceptRideRemote(rideId) {
  const res = await fetch(`${RIDES_API_URL}/${rideId}/accept`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to accept this ride');
  return data;
}

// "Not me": the request leaves this driver's list and stays open for the
// other drivers (see declineRide on the server).
async function declineRideRemote(rideId) {
  const res = await fetch(`${RIDES_API_URL}/${rideId}/decline`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to decline this ride');
  return data;
}

async function updateRideStatusRemote(rideId, status) {
  const res = await fetch(`${RIDES_API_URL}/${rideId}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to update this ride');
  return data;
}

async function convertRideToSoloRemote(rideId) {
  const res = await fetch(`${RIDES_API_URL}/${rideId}/convert-to-solo`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to convert this ride');
  return data;
}

// Strips the repeated "(Tarlac State University)" suffix for display only
// — both fixed campuses carry it in the dropdown's stored value, but it's
// redundant clutter once the two stops are already shown side by side.
function shortCampusName(locationText) {
  return (locationText || '').replace(/\s*\(Tarlac State University\)\s*$/i, '');
}

// Ride-request confirmation popup — resolves true/false depending on which
// button the passenger picks (or false if they dismiss it entirely). Built
// dynamically the same way as openChatModal/openAvailableDriversModal
// rather than a static block in the page HTML. This is the one place that
// needs a second confirmation before an irreversible action (creating the
// ride), so it's a dedicated layout rather than a generic message dialog.
function showRideConfirmModal({ pickupLocation, dropoffLocation, rideType, fareText, whenLabel, bookedFor }) {
  // Same card shape as the pickup/drop-off box above it, with the person's
  // initial in the round badge where the A/B dots sit.
  const bookedForBlock = bookedFor && !bookedFor.error ? `
        <div class="ride-confirm-for">
          <span class="ride-confirm-for-avatar" aria-hidden="true">${escapeHtml(bookedFor.name.charAt(0).toUpperCase())}</span>
          <span class="ride-confirm-for-text">
            <span class="ride-confirm-kicker">Booked for</span>
            <span class="ride-confirm-name">${escapeHtml(bookedFor.name)}</span>
            <span class="ride-confirm-for-phone">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h-2a1 1 0 0 0-1 1C3.5 11 9 16.5 15.5 16.5a1 1 0 0 0 1-1v-2l-3-1.2-1.5 1.5a8 8 0 0 1-4.3-4.3L9.2 8 8 5Z"/></svg>
              ${escapeHtml(formatPhMobile(bookedFor.contact))}
            </span>
            <span class="ride-confirm-for-note">The driver will call this number. You're responsible for this ride and its fare.</span>
          </span>
        </div>` : '';
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'chat-overlay';
    overlay.innerHTML = `
      <div class="chat-modal ride-confirm-modal">
        <div class="ride-confirm-head">
          <span class="ride-confirm-badge">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6.5"/><path d="M10 8.2V4M8.3 11.2L5 13.5M11.7 11.2L15 13.5"/></svg>
          </span>
          <div class="ride-confirm-head-text">
            <h3>Confirm your ride</h3>
            <p>Double-check the trip before it's sent</p>
          </div>
          <button type="button" class="ride-confirm-close" aria-label="Close">&times;</button>
        </div>

        <div class="ride-confirm-journey">
          <div class="ride-confirm-stop">
            <span class="ride-confirm-dot a">A</span>
            <span class="ride-confirm-stop-text">
              <span class="ride-confirm-kicker">Pickup</span>
              <span class="ride-confirm-name">${escapeHtml(shortCampusName(pickupLocation))}</span>
            </span>
          </div>
          <span class="ride-confirm-connector"></span>
          <div class="ride-confirm-stop">
            <span class="ride-confirm-dot b">B</span>
            <span class="ride-confirm-stop-text">
              <span class="ride-confirm-kicker">Drop-off</span>
              <span class="ride-confirm-name">${escapeHtml(shortCampusName(dropoffLocation))}</span>
            </span>
          </div>
        </div>

        ${bookedForBlock}

        <!-- The Solo / "Leave now" chips were removed (IT expert review,
             3 Oct 2026): every ride is Solo and leaves now while Shared and
             scheduling are paused, so they told the passenger nothing. -->

        <div class="ride-confirm-fare">
          <span class="ride-confirm-fare-label">Estimated fare</span>
          <span class="ride-confirm-fare-value">${escapeHtml(fareText)}</span>
        </div>

        <div class="ride-confirm-actions">
          <button type="button" class="btn-secondary-outline confirm-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary confirm-ok-btn">
            Yes, request ride
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12M11 5l5 5-5 5"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close(result) {
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    overlay.querySelector('.ride-confirm-close').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-cancel-btn').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-ok-btn').addEventListener('click', () => close(true));
    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) close(false);
    });
  });
}

// The redesigned "Ride type" control is two visible buttons instead of the
// original <select> — kept in the DOM (visually hidden) since
// setupPassengerRideRequestForm() below still reads its .value directly;
// these buttons just drive that same hidden select instead of replacing it.
function setupRideTypeToggle() {
  const buttons = document.querySelectorAll('.ride-type-btn');
  const hiddenSelect = document.querySelector('#ride-type');
  if (!buttons.length || !hiddenSelect) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      hiddenSelect.value = btn.getAttribute('data-ride-type');
    });
  });
}

// Either endpoint can be a place that isn't one of the two campuses —
// picked off the passenger's own GPS ("__current__") or typed by hand
// ("__other__"). Both reveal the same free-text field; the only difference
// is whether it gets filled in automatically.
function isCustomLocationValue(value) {
  return value === '__current__' || value === '__other__';
}

// Coordinates captured by "Use my current location", kept per side. Cleared
// the moment the passenger edits that field by hand, because the text no
// longer describes the captured point and sending both would put the pin
// somewhere the address doesn't match.
const customLocationCoords = { pickup: null, dropoff: null };

async function reverseGeocodeCoords(lat, lng) {
  const res = await fetch(`${RIDES_API_URL}/reverse-geocode`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ lat, lng })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Reverse lookup failed');
  return data.label;
}

// Shared pooling matches riders by an exact pickup/drop-off text match, so
// it only works between the fixed campus points — a freely-entered location
// would never match anyone else's. Whenever either side is custom, the ride
// is forced to Solo and the Shared button is locked.
function syncRideTypeAvailability() {
  const pickupSelect = document.querySelector('#pickup-location');
  const dropoffSelect = document.querySelector('#dropoff-location');
  const sharedBtn = document.querySelector('.ride-type-btn[data-ride-type="Shared"]');
  const soloBtn = document.querySelector('.ride-type-btn[data-ride-type="Solo"]');
  const hiddenSelect = document.querySelector('#ride-type');
  if (!sharedBtn || !soloBtn) return;

  const anyCustom = isCustomLocationValue(pickupSelect && pickupSelect.value)
    || isCustomLocationValue(dropoffSelect && dropoffSelect.value);

  sharedBtn.disabled = anyCustom;
  if (anyCustom) {
    soloBtn.classList.add('is-selected');
    sharedBtn.classList.remove('is-selected');
    if (hiddenSelect) hiddenSelect.value = 'Solo';
  }
}

// The phone's first answer is usually a quick estimate from Wi-Fi or cell
// towers, easily a kilometre off, with real GPS arriving a few seconds
// later. Listen for up to PRECISE_FIX_WAIT_MS and keep the most precise
// reading, finishing early once one is within PRECISE_FIX_METERS. Resolves
// with a GeolocationPosition, or rejects with an Error whose message is
// DENIED, UNAVAILABLE (the phone's location is off) or TIMEOUT.
//
// Three things used to make it fail for no good reason:
// - The wait started while the browser's "Allow location?" prompt was still
//   open, so anyone slower than 12 s to tap Allow got "Could not get your
//   location" and the box stayed empty after they allowed it. Now, while the
//   permission is still being asked, the wait starts only once it's granted.
// - Only a brand-new GPS reading counted, which indoors may never come. A
//   quick rough reading (Wi-Fi/cell, up to ROUGH_FIX_MAX_AGE_MS old) now
//   runs alongside it and is used if GPS doesn't arrive.
// - With no Permissions API to tell (older iPhones), the prompt can't be
//   detected, so the wait is longer: PROMPT_FALLBACK_WAIT_MS.
const PRECISE_FIX_METERS = 30;
const PRECISE_FIX_WAIT_MS = 12000;
const PROMPT_FALLBACK_WAIT_MS = 30000;
const ROUGH_FIX_MAX_AGE_MS = 5 * 60 * 1000;
const PROMPT_UNANSWERED_MS = 60000;

// 'granted', 'denied', 'prompt', or null when the browser can't say.
async function getLocationPermissionStatus() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return null;
    return await navigator.permissions.query({ name: 'geolocation' });
  } catch (error) {
    return null;
  }
}

function getPreciseLocation() {
  return new Promise(async (resolve, reject) => {
    let best = null;
    let watchId = null;
    let timer = null;
    let done = false;
    let lastErrorCode = null;
    const status = await getLocationPermissionStatus();

    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (status) status.removeEventListener('change', onPermissionChange);
      if (best) return resolve(best);
      const reason = lastErrorCode === 1 ? 'DENIED'
        : status && status.state === 'prompt' ? 'PROMPT'
        : lastErrorCode === 2 ? 'UNAVAILABLE' : 'TIMEOUT';
      reject(new Error(reason));
    };
    const startTimer = (ms) => {
      if (timer === null && !done) timer = setTimeout(finish, ms);
    };
    const keep = (position) => {
      if (done) return;
      if (!best || position.coords.accuracy < best.coords.accuracy) best = position;
      // A reading means permission is granted, so the wait can start.
      startTimer(PRECISE_FIX_WAIT_MS);
      if (position.coords.accuracy <= PRECISE_FIX_METERS) finish();
    };
    const onError = (err) => {
      lastErrorCode = err.code;
      // Denied fails at once; anything else waits out the timer in case a
      // later reading still arrives.
      if (err.code === err.PERMISSION_DENIED) finish();
    };
    function onPermissionChange() {
      if (status.state === 'granted') startTimer(PRECISE_FIX_WAIT_MS);
      else if (status.state === 'denied') { lastErrorCode = 1; finish(); }
    }

    if (status && status.state === 'denied') {
      lastErrorCode = 1;
      return finish();
    }
    if (status && status.state === 'prompt') {
      status.addEventListener('change', onPermissionChange);
      // Never answered at all: stop waiting eventually. Allowing later
      // still fills the box (see setupPickupField).
      setTimeout(() => { if (timer === null) finish(); }, PROMPT_UNANSWERED_MS);
    } else {
      startTimer(status ? PRECISE_FIX_WAIT_MS : PROMPT_FALLBACK_WAIT_MS);
    }

    watchId = navigator.geolocation.watchPosition(keep, onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: PRECISE_FIX_WAIT_MS });
    navigator.geolocation.getCurrentPosition(keep, onError,
      { enableHighAccuracy: false, maximumAge: ROUGH_FIX_MAX_AGE_MS, timeout: PRECISE_FIX_WAIT_MS });
  });
}

// Facebook, Messenger, Instagram and similar apps open links in their own
// built-in browser, which often refuses location outright. Links to
// GoTSUian are usually shared through Messenger, so say how to get out.
function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|MicroMessenger|TikTok/i.test(navigator.userAgent || '');
}

// What to tell the passenger for each way getPreciseLocation can fail.
function locationErrorMessage(reason) {
  const base = baseLocationErrorMessage(reason);
  return isInAppBrowser()
    ? `${base} You're using the Facebook/Messenger browser, which often blocks location: tap ⋯ (or the share icon) → Open in Chrome or Safari.`
    : base;
}

function baseLocationErrorMessage(reason) {
  if (reason === 'DENIED') {
    return 'Location is blocked for this site. Tap the lock icon next to the web address → Permissions → Location → Allow, then tap the pickup box.';
  }
  if (reason === 'PROMPT') {
    return 'Tap "Allow" when your browser asks to use your location. If you missed it, tap the pickup box.';
  }
  if (reason === 'UNAVAILABLE') {
    return "Your phone's location is off. Turn on Location (GPS) in your phone's settings, then tap the pickup box.";
  }
  return 'Could not get a GPS signal. Move outdoors or near a window, then tap the pickup box to try again.';
}

function fillWithCurrentLocation(side) {
  const input = document.querySelector(`#${side}-other-text`);
  const error = document.querySelector(`#${side}-other-error`);
  if (!input) return;
  // The pickup box is a place search while booking for someone else; GPS
  // must not write into it then (see setPickupMode).
  if (side === 'pickup' && pickupMode !== 'gps') return;
  if (error) error.textContent = '';
  const fillToken = side === 'pickup' ? ++pickupFillToken : 0;
  const switchedAway = () => side === 'pickup' && fillToken !== pickupFillToken;

  if (!navigator.geolocation) {
    if (error) error.textContent = 'This device cannot share its location, which booking needs for your pickup.';
    return;
  }

  input.value = 'Using your current location...';
  input.disabled = true;
  input.dataset.detecting = 'true';

  getPreciseLocation().then(
    async (position) => {
      if (switchedAway()) return;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      customLocationCoords[side] = { lat, lng };
      // The coordinates are what the ride actually travels to — the label is
      // only there so the driver reads a place name instead of numbers, so a
      // failed lookup falls back to the numbers rather than failing the pick.
      let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        label = await reverseGeocodeCoords(lat, lng);
      } catch (lookupError) {
        console.warn('Could not name that location, using coordinates', lookupError);
      }
      if (switchedAway()) return;
      input.disabled = false;
      delete input.dataset.detecting;
      input.value = label;
      if (side === 'pickup') {
        if (!isInsideServiceArea(lat, lng)) {
          clearPickupPreview();
          if (error) error.textContent = OUTSIDE_AREA_MESSAGE;
          refreshFareEstimate();
          return;
        }
        showPickupPreview(lat, lng);
      }
      refreshFareEstimate();
      // Indoors, or with location set to battery saving, the phone may never
      // get a real GPS fix; say so instead of passing a rough guess off as exact.
      const accuracy = Math.round(position.coords.accuracy);
      if (error && accuracy > 150) {
        error.textContent = `Your location may be off by about ${accuracy} m. Move outdoors or near a window, then tap the pickup box to update it.`;
      }
    },
    (failure) => {
      if (switchedAway()) return;
      customLocationCoords[side] = null;
      input.disabled = false;
      delete input.dataset.detecting;
      input.value = '';
      if (error) error.textContent = locationErrorMessage(failure && failure.message);
    }
  );
}

function setupCustomLocationField(side) {
  const select = document.querySelector(`#${side}-location`);
  const field = document.querySelector(`#${side}-other-field`);
  const input = document.querySelector(`#${side}-other-text`);
  if (!select || !field) return;

  select.addEventListener('change', () => {
    const isCustom = isCustomLocationValue(select.value);
    field.style.display = isCustom ? '' : 'none';
    customLocationCoords[side] = null;

    if (!isCustom) {
      if (input) input.value = '';
    } else if (select.value === '__current__') {
      fillWithCurrentLocation(side);
    } else if (input) {
      input.value = '';
      input.focus();
    }

    syncRideTypeAvailability();
  });

  // Typing over an auto-filled address means the captured point no longer
  // describes what's written, so the ride falls back to geocoding the text.
  if (input) {
    input.addEventListener('input', () => {
      customLocationCoords[side] = null;
    });
  }
}

// Pickup is always where the passenger is: the box fills itself from GPS as
// soon as the booking form loads and is read-only, so there's no searching
// for a pickup elsewhere. Tapping the box looks the location up again, for
// when they've moved or location access was off the first time.
function setupPickupField() {
  const input = document.querySelector('#pickup-other-text');
  if (!input) return;

  input.addEventListener('click', () => {
    if (pickupMode === 'gps' && input.dataset.detecting !== 'true') fillWithCurrentLocation('pickup');
  });

  fillWithCurrentLocation('pickup');
  setupPickupModeSwitch();

  // Fill the box by itself once location becomes available after a failed
  // try: when the passenger allows it (late on the prompt, or in the
  // browser's site settings), or comes back to the page after turning on
  // their phone's location.
  const retryIfStillEmpty = () => {
    if (pickupMode !== 'gps' || input.dataset.detecting === 'true' || customLocationCoords.pickup) return;
    fillWithCurrentLocation('pickup');
  };
  getLocationPermissionStatus().then((status) => {
    if (!status) return;
    status.addEventListener('change', () => {
      if (status.state === 'granted') retryIfStillEmpty();
    });
  });
  document.addEventListener('visibilitychange', () => {
    const error = document.querySelector('#pickup-other-error');
    if (document.visibilityState === 'visible' && error && error.textContent) retryIfStillEmpty();
  });
}

// BOOK FOR SOMEONE ELSE. The pickup is normally the passenger's own GPS
// ('gps'). "Change pickup" turns the same box into a place search
// ('search') for booking someone else's ride, for example a child at
// school, and shows "Who will ride?" for that person's name and number,
// which the driver sees and can call. "Use my current location instead"
// switches back. The server repeats every check (see checkBookedFor).
let pickupMode = 'gps';
// Bumped on every GPS lookup and every mode switch, so a lookup still in
// flight can tell it has been superseded and must not fill the box.
let pickupFillToken = 0;
const PICKUP_GPS_PLACEHOLDER = 'Use my current location';

function formatPhMobile(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : String(digits || '');
}

// Same rule as normalizePhMobile on the server: 09XXXXXXXXX, with spaces,
// dashes or a +63 prefix allowed. Null if it isn't a PH mobile number.
function normalizePhMobileClient(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('63')) digits = '0' + digits.slice(2);
  return /^09\d{9}$/.test(digits) ? digits : null;
}

function setPickupMode(mode) {
  const input = document.querySelector('#pickup-other-text');
  const error = document.querySelector('#pickup-other-error');
  const changeLink = document.querySelector('#pickup-change-link');
  const gpsLink = document.querySelector('#pickup-gps-link');
  const bookedFor = document.querySelector('#booked-for-field');
  const label = document.querySelector('label[for="pickup-other-text"]');
  if (!input) return;

  pickupMode = mode;
  pickupFillToken++;
  customLocationCoords.pickup = null;
  clearPickupPreview();
  input.disabled = false;
  delete input.dataset.detecting;
  input.value = '';
  if (error) error.textContent = '';
  ['#booked-for-name-error', '#booked-for-contact-error'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = '';
  });

  const searching = mode === 'search';
  input.readOnly = !searching;
  input.placeholder = searching ? 'Search for the pickup place' : PICKUP_GPS_PLACEHOLDER;
  input.title = searching ? '' : 'Tap to update your location';
  input.classList.toggle('is-pickup-search', searching);
  if (label) label.textContent = searching ? 'Pickup location (for someone else)' : 'Pickup location';
  if (changeLink) changeLink.hidden = searching;
  if (gpsLink) gpsLink.hidden = !searching;
  if (bookedFor) bookedFor.hidden = !searching;
  if (!searching) {
    ['#booked-for-name', '#booked-for-contact'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    });
  }

  resetFareEstimate();
  if (searching) {
    input.focus();
  } else {
    fillWithCurrentLocation('pickup');
  }
}

function setupPickupModeSwitch() {
  const input = document.querySelector('#pickup-other-text');
  const changeLink = document.querySelector('#pickup-change-link');
  const gpsLink = document.querySelector('#pickup-gps-link');
  if (!input || !changeLink || !gpsLink) return;

  changeLink.addEventListener('click', (event) => {
    event.preventDefault();
    setPickupMode('search');
  });
  gpsLink.addEventListener('click', (event) => {
    event.preventDefault();
    setPickupMode('gps');
  });
  // While searching, typing makes the shown fare stale and picking a
  // suggestion (which fires 'change') prices the trip from that place.
  input.addEventListener('input', () => {
    if (pickupMode === 'search') resetFareEstimate();
  });
  input.addEventListener('change', () => {
    if (pickupMode !== 'search') return;
    const coords = customLocationCoords.pickup;
    if (coords) showPickupPreview(coords.lat, coords.lng);
    refreshFareEstimate();
  });
}

// The person being picked up, read from "Who will ride?". Returns null when
// booking for oneself, { error } when something is missing, else the values.
function readBookedForFields() {
  if (pickupMode !== 'search') return null;
  const nameInput = document.querySelector('#booked-for-name');
  const contactInput = document.querySelector('#booked-for-contact');
  const nameError = document.querySelector('#booked-for-name-error');
  const contactError = document.querySelector('#booked-for-contact-error');
  if (nameError) nameError.textContent = '';
  if (contactError) contactError.textContent = '';

  const name = (nameInput ? nameInput.value : '').trim().replace(/\s+/g, ' ');
  const contact = normalizePhMobileClient(contactInput ? contactInput.value : '');
  let error = null;
  if (name.length < 2) {
    if (nameError) nameError.textContent = "Enter the name of the passenger you're booking for.";
    error = error || nameInput;
  }
  if (!contact) {
    if (contactError) contactError.textContent = 'Enter their mobile number (11 digits, starting with 09).';
    error = error || contactInput;
  }
  if (error) {
    if (error.focus) error.focus();
    return { error: true };
  }
  return { name, contact };
}

// "Booked for" block on a driver's ride card, for a ride booked for
// someone else. Empty for an ordinary booking.
function bookedForDriverHtml(ride) {
  if (!ride || !ride.booked_for_name) return '';
  const contact = ride.booked_for_contact || '';
  // Same look as the "Booked for" box in the passenger's confirm popup.
  return `
    <div class="booked-for-card">
      <span class="booked-for-head">
        <span class="booked-for-avatar" aria-hidden="true">${escapeHtml(ride.booked_for_name.charAt(0).toUpperCase())}</span>
        <span class="booked-for-who">
          <span class="booked-for-kicker">Pick up this passenger</span>
          <strong class="booked-for-name">${escapeHtml(ride.booked_for_name)}</strong>
        </span>
      </span>
      ${contact ? `<a class="booked-for-call" href="tel:${escapeHtml(contact)}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h-2a1 1 0 0 0-1 1C3.5 11 9 16.5 15.5 16.5a1 1 0 0 0 1-1v-2l-3-1.2-1.5 1.5a8 8 0 0 1-4.3-4.3L9.2 8 8 5Z"/></svg><span>Call <span class="booked-for-num">${escapeHtml(formatPhMobile(contact))}</span></span></a>` : ''}
      <span class="booked-for-note">Booked by ${escapeHtml(ride.passenger_name || 'the passenger')} for someone else. Call to confirm the pickup before you go.</span>
    </div>
  `;
}

function setupOthersDropoff() {
  setupPickupField();
  setupCustomLocationField('dropoff');
}

async function searchPlaces(query) {
  const res = await fetch(`${RIDES_API_URL}/search-places`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ q: query })
  });
  const data = await res.json();
  return data.places || [];
}

// Type-ahead under the pickup and drop-off boxes. Picking a suggestion
// stores its exact coordinates, so the server uses the place the passenger
// actually chose rather than re-guessing from the text — the difference
// between a driver arriving at the right SM branch and the wrong one.
function setupPlaceSuggestions(side) {
  const input = document.querySelector(`#${side}-other-text`);
  if (!input || !input.parentNode) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'place-suggest-wrap';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const list = document.createElement('ul');
  list.className = 'place-suggest-list';
  list.hidden = true;
  wrapper.appendChild(list);

  let debounceTimer = null;
  let requestToken = 0;
  // The last results that actually came back. OpenStreetMap search only
  // matches whole words, so "sm c" finds nothing even though "sm" found SM
  // City Tarlac; narrowing these down locally keeps the list on screen
  // while the passenger is partway through a word.
  let lastPlaces = [];

  function closeList() {
    list.hidden = true;
    list.innerHTML = '';
  }

  // Every typed word has to start one of the words in the place's name, so
  // "sm c" keeps "SM City Tarlac" and drops "SM Gerona". The name is the part
  // before the first comma; checked alone first because nearly every address
  // ends in "Tarlac City", which would let "sm c" keep "SM Eats" too. The
  // full address is the fallback for someone typing the town ("sm gerona").
  function narrowPlaces(places, query) {
    const typedWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (text) => {
      const words = text.toLowerCase().split(/[\s,]+/);
      return typedWords.every((typed) => words.some((word) => word.startsWith(typed)));
    };
    const byName = places.filter((place) => matches(place.label.split(',')[0]));
    return byName.length ? byName : places.filter((place) => matches(place.label));
  }

  function showStatus(text) {
    list.innerHTML = `<li class="place-suggest-status">${escapeHtml(text)}</li>`;
    list.hidden = false;
  }

  function renderSuggestions(places) {
    if (!places.length) return closeList();

    list.innerHTML = places
      .map((place, index) => `<li><button type="button" class="place-suggest-item" data-index="${index}">${escapeHtml(place.label)}</button></li>`)
      .join('');
    list.hidden = false;

    list.querySelectorAll('.place-suggest-item').forEach((button) => {
      button.addEventListener('click', () => {
        const place = places[Number(button.dataset.index)];
        input.value = place.label;
        customLocationCoords[side] = { lat: place.lat, lng: place.lng };
        closeList();
        // Lets listeners such as the fare estimate react to the pick.
        input.dispatchEvent(new Event('change'));
      });
    });
  }

  input.addEventListener('input', () => {
    // Typing after choosing a suggestion means the stored point no longer
    // describes what's written, so the server falls back to geocoding text.
    customLocationCoords[side] = null;
    const query = input.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      lastPlaces = [];
      requestToken++;
      return closeList();
    }

    // Answer straight away from what's already known, so the list reacts
    // on every keystroke instead of only once the lookup below returns.
    const narrowed = narrowPlaces(lastPlaces, query);
    if (narrowed.length) renderSuggestions(narrowed);
    else showStatus('Searching…');

    // Nominatim's usage policy asks for at most one request per second, and
    // a lookup per keystroke would blow past that immediately.
    debounceTimer = setTimeout(async () => {
      const token = ++requestToken;
      let places = [];
      try {
        places = await searchPlaces(query);
      } catch (error) {
        places = [];
      }
      // A slower earlier request must not overwrite a newer one's results.
      if (token !== requestToken) return;
      if (places.length) {
        lastPlaces = places;
        return renderSuggestions(places);
      }
      // An empty answer usually means a word is still half-typed ("rob"
      // finds nothing, "robinsons" does), not that the place isn't there.
      const fallback = narrowPlaces(lastPlaces, query);
      if (fallback.length) renderSuggestions(fallback);
      else showStatus('No results yet. Try typing the full name (e.g. "Robinsons", not "Rob").');
    }, 350);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeList();
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) closeList();
  });
}

function setupPassengerRideRequestForm() {
  const form = document.querySelector('#ride-request-form');
  if (!form) return;

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    const user = getStoredUser();

    if (!isAuthenticated() || user.role !== 'passenger') {
      alert('Please log in to request a ride.');
      return;
    }

    // Either side can be a non-campus place, picked either off the
    // passenger's GPS ("__current__") or typed ("__other__") — see
    // setupCustomLocationField(). In both cases the real location text lives
    // in that side's free-text field, not in the select itself.
    const pickupSelectValue = document.querySelector('#pickup-location').value;
    const isCustomPickup = isCustomLocationValue(pickupSelectValue);
    const pickupOtherInput = document.querySelector('#pickup-other-text');
    const pickupOtherError = document.querySelector('#pickup-other-error');
    const pickupLocation = isCustomPickup
      ? (pickupOtherInput ? pickupOtherInput.value.trim() : '')
      : pickupSelectValue;

    // With the campus presets hidden, drop-off is a plain "type your
    // destination" box with no select above it. An absent select therefore
    // means every drop-off is a typed one; if the presets are restored, this
    // reads them again with no further change.
    const dropoffSelect = document.querySelector('#dropoff-location');
    const dropoffSelectValue = dropoffSelect ? dropoffSelect.value : '__other__';
    const isCustomDropoff = isCustomLocationValue(dropoffSelectValue);
    const dropoffOtherInput = document.querySelector('#dropoff-other-text');
    const dropoffOtherError = document.querySelector('#dropoff-other-error');
    const dropoffLocation = isCustomDropoff
      ? (dropoffOtherInput ? dropoffOtherInput.value.trim() : '')
      : dropoffSelectValue;
    const rideTypeSelect = document.querySelector('#ride-type');
    // The highlighted Solo/Shared BUTTON is the source of truth, not the
    // hidden <select> that mirrors it. form.reset() (fired after every
    // successful booking) reverts native inputs like that select back to
    // "Solo", but not the plain <button>s — so reading the select could
    // book a Solo ride while the screen still showed Shared selected.
    // Reading what the passenger can actually see makes that mismatch
    // impossible, regardless of reset timing or a stale cached script.
    const selectedRideTypeBtn = form.querySelector('.ride-type-btn.is-selected');
    // A ride with a custom pickup or drop-off is always Solo (see
    // syncRideTypeAvailability() — the Shared button is disabled the moment
    // either side stops being a campus), but this is the actual value
    // creating the ride, so it's enforced here too, not just in the UI.
    const rideType = (isCustomPickup || isCustomDropoff)
      ? 'Solo'
      : (selectedRideTypeBtn ? selectedRideTypeBtn.getAttribute('data-ride-type') : rideTypeSelect.value);
    // Keep the select in step so the confirmation modal's label below
    // (read from its selected <option>) describes the same ride type.
    rideTypeSelect.value = rideType;
    const scheduleSelect = document.querySelector('#ride-schedule');
    const scheduleMinutes = scheduleSelect ? parseInt(scheduleSelect.value, 10) : 0;
    const scheduledAt = scheduleMinutes > 0 ? toMySQLDateTime(new Date(Date.now() + scheduleMinutes * 60000)) : null;
    const routeError = document.querySelector('#route-error');
    if (routeError) routeError.textContent = '';
    if (dropoffOtherError) dropoffOtherError.textContent = '';
    if (pickupOtherError) pickupOtherError.textContent = '';

    if (!pickupLocation) {
      if (pickupMode === 'search' && pickupOtherError) pickupOtherError.textContent = 'Search for the pickup place and pick it from the list.';
      else if (isCustomPickup && pickupOtherError) pickupOtherError.textContent = "We don't have your location yet. Turn on location access, then tap the pickup box.";
      else if (routeError) routeError.textContent = 'Please select a pickup point.';
      return;
    }

    // GPS pickup outside Tarlac: nothing to book (the server refuses it too).
    const gpsPickup = customLocationCoords.pickup;
    if (pickupMode === 'gps' && gpsPickup && !isInsideServiceArea(gpsPickup.lat, gpsPickup.lng)) {
      if (pickupOtherError) pickupOtherError.textContent = OUTSIDE_AREA_MESSAGE;
      return;
    }

    // Booking for someone else: the pickup must be a picked suggestion (so
    // it has an exact point) and "Who will ride?" must be filled in.
    if (pickupMode === 'search' && !customLocationCoords.pickup) {
      if (pickupOtherError) pickupOtherError.textContent = 'Pick the pickup place from the list so the driver gets the exact spot.';
      return;
    }
    const bookedFor = readBookedForFields();
    if (bookedFor && bookedFor.error) return;

    if (!dropoffLocation) {
      if (isCustomDropoff && dropoffOtherError) dropoffOtherError.textContent = 'Please tell us where you want to be dropped off.';
      else if (routeError) routeError.textContent = 'Please select a drop-off point.';
      return;
    }

    if (pickupLocation === dropoffLocation) {
      if (routeError) routeError.textContent = 'Pickup and drop-off must be different places.';
      return;
    }

    // Submitting while a GPS lock is still resolving would book the
    // placeholder text ("Detecting your location...") as the actual address.
    const stillDetecting = [
      [pickupOtherInput, pickupOtherError],
      [dropoffOtherInput, dropoffOtherError]
    ].find(([field]) => field && field.dataset.detecting === 'true');
    if (stillDetecting) {
      const [, errorEl] = stillDetecting;
      if (errorEl) errorEl.textContent = 'Still finding your location — give it a moment, then try again.';
      return;
    }

    // A custom drop-off's real fare isn't known until the server geocodes
    // it and measures the distance — get that quote now, before showing
    // the confirm modal, so the passenger sees the real number instead of
    // a placeholder. This never trusts what it gets back for the actual
    // booking — createRide recomputes the same thing server-side.
    let othersQuote = null;
    if (isCustomDropoff) {
      const submitButtonForQuote = form.querySelector('button[type="submit"]');
      if (submitButtonForQuote) submitButtonForQuote.disabled = true;
      try {
        othersQuote = await quoteOthersDropoff(pickupLocation, dropoffLocation, {
          pickupIsCustom: isCustomPickup,
          pickupCoords: customLocationCoords.pickup,
          dropoffCoords: customLocationCoords.dropoff
        });
      } catch (error) {
        if (dropoffOtherError) dropoffOtherError.textContent = error.message || 'Could not calculate a fare for that location.';
        if (submitButtonForQuote) submitButtonForQuote.disabled = false;
        return;
      }
      if (submitButtonForQuote) submitButtonForQuote.disabled = false;
    }

    // One more explicit "are you sure" before actually creating the ride —
    // easy to fat-finger the wrong campus or ride type otherwise.
    // A custom drop-off uses the real quote. Otherwise the fare comes from
    // the same selected card used to read rideType above (its price figure),
    // not a separately-maintained number — one source of truth.
    const cardFare = selectedRideTypeBtn && selectedRideTypeBtn.querySelector('.ride-card-price b');
    const fareText = othersQuote
      ? formatFareWithDistance(othersQuote.fare, othersQuote.distanceKm)
      : (cardFare ? cardFare.textContent : '');
    const whenLabel = scheduleSelect && scheduleSelect.selectedOptions[0]
      ? scheduleSelect.selectedOptions[0].textContent
      : 'Leave now';
    const confirmed = await showRideConfirmModal({
      pickupLocation,
      dropoffLocation,
      rideType,
      fareText,
      whenLabel,
      bookedFor
    });
    if (!confirmed) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    // Kicks off the browser's native "Allow location?" prompt right at the
    // moment of requesting a ride. Deliberately NOT awaited here — a slow or
    // denied GPS lock used to hold up the whole request (2-3s instead of
    // feeling instant). Ride creation goes ahead immediately; the
    // coordinates, if they ever resolve, get attached to the ride
    // afterward in the background (see updateRidePickupLocation below).
    // Skipped entirely for a custom pickup: the point is already known (from
    // "Use my current location") or the passenger typed an address that is
    // deliberately somewhere other than where they're standing, and
    // overwriting it with their current position would send the driver to
    // the wrong place.
    const locationPromise = navigator.geolocation && !isCustomPickup
      ? new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        })
      : Promise.resolve(null);

    try {
      const result = await createRideRequest({
        passenger_account_id: user.accountId,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        pickup_lat: customLocationCoords.pickup ? customLocationCoords.pickup.lat : null,
        pickup_lng: customLocationCoords.pickup ? customLocationCoords.pickup.lng : null,
        dropoff_lat: customLocationCoords.dropoff ? customLocationCoords.dropoff.lat : null,
        dropoff_lng: customLocationCoords.dropoff ? customLocationCoords.dropoff.lng : null,
        ride_type: rideType,
        scheduled_at: scheduledAt,
        dropoff_is_custom: isCustomDropoff,
        pickup_is_custom: isCustomPickup,
        pickup_from_search: pickupMode === 'search',
        booked_for_name: bookedFor ? bookedFor.name : null,
        booked_for_contact: bookedFor ? bookedFor.contact : null
      });

      form.reset();
      // form.reset() only reverts native inputs, like the hidden #ride-type
      // <select> it's paired with (back to its first option, "Solo") — the
      // visible Solo/Shared toggle buttons are plain <button>s outside that
      // scope, so they silently kept showing whichever one the passenger
      // had clicked before this submission. After one Shared booking, the
      // form still LOOKED like Shared was selected while the hidden select
      // (and therefore the next submission's actual ride_type) had already
      // reverted to Solo — a passenger who trusted the highlighted button
      // and didn't re-click Shared got a real Solo ride with no warning.
      form.querySelectorAll('.ride-type-btn').forEach(b => b.classList.toggle('is-selected', b.getAttribute('data-ride-type') === rideTypeSelect.value));
      // The custom pickup/drop-off fields are shown and hidden by script, so
      // form.reset() leaves them on screen with the selects already back on
      // their placeholder — and any captured coordinates would otherwise
      // carry into the next, unrelated booking.
      ['pickup', 'dropoff'].forEach((side) => {
        const field = document.querySelector(`#${side}-other-field`);
        if (field) field.style.display = 'none';
        customLocationCoords[side] = null;
      });
      // form.reset() emptied the pickup box too; refill it from GPS so the
      // next booking starts where the passenger is, same as on page load
      // (this also ends "book for someone else" mode).
      resetFareEstimate();
      setPickupMode('gps');
      syncRideTypeAvailability();
      renderPassengerRideStatus();
      renderDriverRideRequests();
      renderDriverDashboardStats();
      showRideFeedback(
        'success',
        'Ride requested',
        rideType === 'Shared'
          ? 'Your seat is booked. Fare is finalized once the tricycle fills up or a driver departs early.'
          : 'Your trip request is now waiting for a driver.'
      );

      locationPromise.then((coords) => {
        if (coords && result && result.rideId) {
          updateRidePickupLocation(result.rideId, coords.lat, coords.lng);
        }
      });
    } catch (error) {
      console.error('Ride request failed', error);
      showRideFeedback('error', 'Request failed', error.message || 'Could not connect to the server.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
 
function getRideStatusConfig(status) {
  const configs = {
    Pending: { label: 'Pending', description: 'Waiting for driver review.', tone: 'warning' },
    Accepted: { label: 'Accepted', description: 'Driver has accepted the ride.', tone: 'success' },
    'Picked Up': { label: 'Picked Up', description: 'The driver has picked up the passenger.', tone: 'info' },
    'In Progress': { label: 'In Progress', description: 'The trip is underway.', tone: 'info' },
    Completed: { label: 'Completed', description: 'The ride has been completed.', tone: 'success' },
    Cancelled: { label: 'Cancelled', description: 'The ride was cancelled.', tone: 'danger' },
    Failed: { label: 'Failed', description: 'The ride could not be completed.', tone: 'danger' },
    Declined: { label: 'Declined', description: 'The driver declined this ride request.', tone: 'danger' }
  };
 
  return configs[status] || { label: status || 'Unknown', description: 'Status update received.', tone: 'warning' };
}
 
function getNextRideStatusOptions(currentStatus) {
  if (currentStatus === 'Pending') return ['Accepted', 'Cancelled'];
  if (currentStatus === 'Accepted') return ['Picked Up', 'Cancelled'];
  // No Cancel once the passenger is on board: the trip either goes ahead or,
  // if something goes wrong on the road, ends as Failed from In Progress.
  if (currentStatus === 'Picked Up') return ['In Progress', 'Completed'];
  if (currentStatus === 'In Progress') return ['Completed', 'Failed'];
  return [];
}
 
// Disables "Request ride" while the passenger already has one in flight —
// the backend rejects a second one anyway (see createRide), this just
// makes it obvious in the UI instead of letting them hit an error.
function updateRideRequestFormAvailability(hasActiveRide) {
  const submitBtn = document.querySelector('#ride-request-form button[type="submit"]');
  if (!submitBtn) return;
  if (hasActiveRide) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'You already have an active ride';
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request ride';
  }
}

// The ride-status panel toggling display/content above the map (below)
// shifts its container's height, but Leaflet caches the map's pixel size
// from whenever it was created and never re-measures on its own — left
// alone, the map keeps rendering at its old size, cropped/overflowing
// against its new, actually-resized container. invalidateSize() tells
// it to re-measure; requestAnimationFrame waits for the display/content
// change above to actually reflow first, so it measures the real size.
function resizePassengerMapSoon() {
  if (!passengerMapInstance) return;
  requestAnimationFrame(() => passengerMapInstance.invalidateSize());
}

async function renderPassengerRideStatus() {
  const container = document.querySelector('#ride-status-details');
  const emptyState = document.querySelector('#ride-status-empty');
  if (!container || !emptyState) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'passenger') {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    resizePassengerMapSoon();
    return;
  }

  const rides = await fetchMyRides();
  const activeRide = rides.find(ride => !['Completed', 'Cancelled', 'Failed', 'Declined'].includes(ride.status)) || null;
  updateRideRequestFormAvailability(Boolean(activeRide));

  if (!activeRide) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    resizePassengerMapSoon();
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'block';
  const createdAt = new Date(activeRide.created_at).toLocaleString();
  const updatedAt = new Date(activeRide.updated_at || activeRide.created_at).toLocaleString();
  const driverName = activeRide.driver_name || 'Awaiting confirmation';
  const statusConfig = getRideStatusConfig(activeRide.status);
  // Once the driver has actually picked the passenger up, cancelling no
  // longer makes sense — they're already in the tricycle. Only Pending
  // (not yet accepted) and Accepted (driver on the way, not arrived yet)
  // allow a cancel.
  const canCancel = ['Pending', 'Accepted'].includes(activeRide.status);
  // A Shared pool stays "Open" to new joiners even after a driver has
  // accepted it early (under 4 riders) — it only closes once full or once
  // the driver actually departs (marked "Picked Up"). So "waiting for more
  // students" can still be true for an already-Accepted ride, not just a
  // Pending one.
  const riderCountSoFar = activeRide.pool_rider_count || 1;
  const poolStillOpen = activeRide.ride_type === 'Shared' && activeRide.pool_status === 'Open' && riderCountSoFar < 4;
  // Two very different shapes of content share this one slot: a short
  // figure ("₱35 so far") that belongs inline on the right, and a long
  // sentence (below) that does not — it gets its own full-width note row
  // instead, flagged for CSS with .is-calculating.
  const fareIsCalculating = activeRide.fare == null;
  const fareText = fareIsCalculating
    ? 'Calculating — waiting for more students to join'
    : activeRide.ride_type === 'Shared'
      ? `₱${Number(activeRide.fare).toFixed(0)}${poolStillOpen ? ' so far' : ''}`
      : formatFareWithDistance(activeRide.fare, activeRide.distance_km);
  const fareTierRow = poolStillOpen ? `
    <div class="fare-tier-row">
      <span class="fare-tier-chip${riderCountSoFar >= 2 ? ' is-active' : ''}">2 · ₱35</span>
      <span class="fare-tier-chip${riderCountSoFar >= 3 ? ' is-active' : ''}">3 · ₱25</span>
      <span class="fare-tier-chip${riderCountSoFar >= 4 ? ' is-active' : ''}">4 · ₱20</span>
    </div>
  ` : '';
  // Been waiting alone for a while with no one else joining the pool yet —
  // offer a way out instead of leaving them stuck indefinitely. Only makes
  // sense before a driver has accepted (accepting already required 2+).
  const waitedMs = Date.now() - new Date(activeRide.created_at).getTime();
  const canConvertToSolo = activeRide.status === 'Pending' && poolStillOpen && riderCountSoFar <= 1 && waitedMs > 5 * 60 * 1000;
  const scheduleText = activeRide.scheduled_at
    ? `Scheduled for ${new Date(activeRide.scheduled_at).toLocaleString()}`
    : 'Requested for now';

  const progressSteps = getRideLifecycleSteps(activeRide.status)
    .map(step => `
      <div class="ride-progress-step${step.active ? ' is-active' : ''}${step.complete ? ' is-complete' : ''}">
        <span class="ride-progress-dot${step.complete ? ' is-complete' : step.active ? ' is-active' : ''}">${step.complete
          ? '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>'
          : step.active ? '<span class="ride-progress-dot-inner"></span>' : ''}</span>
        <span class="ride-progress-label"><span class="copy-full">${escapeHtml(step.label)}</span><span class="copy-short">${escapeHtml(step.shortLabel)}</span></span>
      </div>
    `)
    .join('');
  const driverInitial = driverName.charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="ride-status-head">
      <span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span>
    </div>

    <div class="ride-progress">
      ${progressSteps}
    </div>

    <div class="ride-driver-info">
      <span class="ride-driver-avatar"><img src="../images/tricycle.png" alt="Tricycle"></span>
      <div>
        <strong>${escapeHtml(driverName)}</strong>
        <small>${activeRide.driver_plate ? escapeHtml(activeRide.driver_plate) + ' · ' : ''}${escapeHtml(activeRide.ride_type)}</small>
      </div>
      <span class="fare${fareIsCalculating ? ' is-calculating' : ''}">${escapeHtml(fareText)}</span>
    </div>
    ${fareTierRow}
    ${activeRide.booked_for_name ? `<div class="ride-booked-for">Booked for <strong>${escapeHtml(activeRide.booked_for_name)}</strong> · ${escapeHtml(formatPhMobile(activeRide.booked_for_contact))}</div>` : ''}
    ${rideEtaRowHtml(activeRide, 'passenger')}

    <div class="ride-actions">
      ${activeRide.driver_account_id ? `
        <button type="button" class="btn-secondary-outline" data-action="open-chat" data-ride-id="${activeRide.ride_id}" data-other-name="${escapeHtml(driverName)}">
          💬 Chat with driver${activeRide.unread_message_count > 0 ? `<span class="chat-unread-badge">${activeRide.unread_message_count}</span>` : ''}
        </button>
      ` : ''}
      ${canConvertToSolo ? `<button type="button" class="btn-secondary-outline" data-action="convert-to-solo" data-ride-id="${activeRide.ride_id}">Book as Solo instead (₱60)</button>` : ''}
      ${canCancel ? `<button type="button" class="btn-secondary-outline" data-action="cancel-request" data-ride-id="${activeRide.ride_id}">Cancel request</button>` : ''}
    </div>
  `;

  const convertButton = container.querySelector('[data-action="convert-to-solo"]');
  if (convertButton) {
    convertButton.addEventListener('click', async function() {
      try {
        await convertRideToSoloRemote(activeRide.ride_id);
        showRideFeedback('success', 'Switched to Solo', 'Your ride is now booked as Solo at ₱60.');
        renderPassengerRideStatus();
      } catch (error) {
        showRideFeedback('error', 'Could not switch', error.message || 'Please try again.');
      }
    });
  }

  const chatButton = container.querySelector('[data-action="open-chat"]');
  if (chatButton) {
    chatButton.addEventListener('click', function() {
      openChatModal(this.getAttribute('data-ride-id'), this.getAttribute('data-other-name'));
    });
  }

  const cancelButton = container.querySelector('[data-action="cancel-request"]');
  if (cancelButton) {
    cancelButton.addEventListener('click', async function() {
      try {
        await updateRideStatusRemote(activeRide.ride_id, 'Cancelled');
        showRideFeedback('info', 'Ride cancelled', 'Your ride request has been cancelled.');
        renderPassengerRideStatus();
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not cancel', error.message || 'Please try again.');
      }
    });
  }

  resizePassengerMapSoon();
}

// RIDE MILESTONE POPUPS — surfaces a full-screen moment when the passenger's
// ride hits a key transition (driver on the way, picked up, arrived at
// destination), instead of the ride silently vanishing from the dashboard
// the moment it's marked Completed. Each milestone only shows once per
// ride+status, tracked in localStorage so it doesn't reappear on every
// refresh, poll, or login.
const RIDE_MILESTONES = {
  Accepted: {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    title: 'Your driver is on the way!',
    message: 'Be at your pickup point. This helps your driver find you.'
  },
  'Picked Up': {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5"/></svg>',
    title: "You're on board!",
    message: "Enjoy your ride — you're on the way to your destination."
  },
  Completed: {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 5h11l-2.5 3.5L16 12H5"/></svg>',
    title: 'You have arrived at your destination!',
    message: "See you on your next trip. Don't forget to pay your driver."
  },
  Declined: {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    title: 'Your ride request was declined',
    message: "The driver wasn't able to take this trip. Feel free to request another ride."
  },
  Cancelled: {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    title: 'Your trip was cancelled',
    message: "This ride was cancelled. Feel free to request another ride."
  },
  Failed: {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><circle cx="12" cy="16.2" r="0.4" fill="currentColor"/><path d="M10.3 4.3 2.7 18a1.6 1.6 0 0 0 1.4 2.4h15.8a1.6 1.6 0 0 0 1.4-2.4L13.7 4.3a1.6 1.6 0 0 0-2.8 0z"/></svg>',
    title: 'Your trip could not be completed',
    message: "Something went wrong with this ride. Feel free to request another ride."
  }
};

async function checkRideMilestones() {
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'passenger') return;
  if (document.querySelector('.ride-milestone-overlay')) return;

  const rides = await fetchMyRides();
  if (!rides.length) return;
  const latest = rides[0];
  const milestone = RIDE_MILESTONES[latest.status];
  if (!milestone) return;

  // localStorage, not sessionStorage: the auth token lives in sessionStorage
  // and is cleared on logout, so a milestone marked seen there was forgotten
  // the moment the passenger logged out. Logging back in re-showed the same
  // "your trip was cancelled" popup for a ride they had already dismissed,
  // every single time. localStorage survives logout, so an acknowledged
  // milestone stays acknowledged.
  const seenKey = `ride-milestone-${latest.ride_id}-${latest.status}`;
  if (localStorage.getItem(seenKey)) return;
  localStorage.setItem(seenKey, 'shown');

  // A driver taking the ride is the moment the passenger has been waiting
  // for, so it also chimes and vibrates. The other milestones stay silent.
  if (latest.status === 'Accepted') {
    playRideAlertSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  showRideMilestoneModal(milestone, latest);
}

function showRideMilestoneModal(milestone, ride) {
  const isCompleted = ride.status === 'Completed';
  const showReviewLink = isCompleted && !ride.has_review;

  const overlay = document.createElement('div');
  overlay.className = 'ride-milestone-overlay';
  overlay.innerHTML = `
    <div class="ride-milestone-modal">
      <div class="ride-milestone-icon">${milestone.icon}</div>
      <h2 class="ride-milestone-title">${escapeHtml(milestone.title)}</h2>
      ${ride.status === 'Accepted' && ride.driver_name ? `
        <p class="ride-milestone-driver">
          <strong>${escapeHtml(ride.driver_name)}</strong>${ride.driver_plate ? ` · Plate ${escapeHtml(ride.driver_plate)}` : ''}
        </p>` : ''}
      <p class="ride-milestone-message">${escapeHtml(milestone.message)}</p>
      <button type="button" class="btn-primary ride-milestone-ok">OK!</button>
      ${showReviewLink ? `
        <button type="button" class="ride-milestone-review-link">★ Rate your driver</button>
        <div class="ride-milestone-review" style="display:none;">
          <div class="star-rating">
            ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-star="${n}">★</button>`).join('')}
          </div>
          <textarea class="review-comment" rows="2" placeholder="Optional comment..."></textarea>
          <button type="button" class="btn-secondary-outline milestone-review-submit">Submit review</button>
          <small class="error-msg milestone-review-error"></small>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function closeModal() {
    overlay.remove();
    document.body.style.overflow = '';
  }

  overlay.querySelector('.ride-milestone-ok').addEventListener('click', closeModal);

  const reviewLink = overlay.querySelector('.ride-milestone-review-link');
  const reviewSection = overlay.querySelector('.ride-milestone-review');
  if (reviewLink && reviewSection) {
    let selectedRating = 0;
    const starButtons = Array.from(overlay.querySelectorAll('.star-btn'));

    reviewLink.addEventListener('click', () => {
      reviewSection.style.display = reviewSection.style.display === 'none' ? 'flex' : 'none';
    });

    starButtons.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = Number(star.getAttribute('data-star'));
        starButtons.forEach(s => s.classList.toggle('is-selected', Number(s.getAttribute('data-star')) <= selectedRating));
      });
    });

    overlay.querySelector('.milestone-review-submit').addEventListener('click', async () => {
      const errorEl = overlay.querySelector('.milestone-review-error');
      const commentEl = overlay.querySelector('.review-comment');
      errorEl.textContent = '';
      if (!selectedRating) {
        errorEl.textContent = 'Please select a star rating.';
        return;
      }
      try {
        const res = await fetch(REVIEWS_API_URL, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ride_id: ride.ride_id, rating: selectedRating, comment: commentEl.value.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to submit review');
        closeModal();
        showRideFeedback('success', 'Thanks!', 'Your review has been submitted.');
      } catch (error) {
        errorEl.textContent = error.message || 'Please try again.';
      }
    });
  }
}

// RIDE CHAT — a simple text thread scoped to one ride, shared by both the
// "Chat with driver" button (passenger side) and the per-rider "Chat"
// buttons on a driver's active ride card. No Socket.IO in this codebase, so
// while the modal is open it polls for new messages every 4s; the interval
// is cleared on close (unlike the codebase's other "run forever" pollers —
// there's no point polling a thread nobody's looking at).
async function fetchRideMessages(rideId) {
  const res = await fetch(`${MESSAGES_API_URL}/${rideId}`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load messages');
  return data.messages || [];
}

async function sendRideMessage(rideId, text) {
  const res = await fetch(MESSAGES_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ride_id: rideId, message: text })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not send message');
  return data;
}

function renderChatMessages(overlay, messages) {
  const list = overlay.querySelector('.chat-message-list');
  if (!list) return;
  const accountId = getStoredUser().accountId;

  if (!messages.length) {
    list.innerHTML = '<p class="chat-empty">No messages yet — say hello!</p>';
    return;
  }

  list.innerHTML = messages.map(m => {
    const mine = m.sender_account_id === accountId;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-bubble ${mine ? 'mine' : 'theirs'}">
        <p>${escapeHtml(m.message)}</p>
        <small>${time}</small>
      </div>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function openChatModal(rideId, otherPartyName) {
  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.innerHTML = `
    <div class="chat-modal">
      <div class="chat-modal-header">
        <h3>Chat with ${escapeHtml(otherPartyName || 'the other party')}</h3>
        <button type="button" class="chat-close-btn" aria-label="Close chat">&times;</button>
      </div>
      <div class="chat-message-list"></div>
      <form class="chat-input-row">
        <input type="text" class="chat-input" placeholder="Type a message..." maxlength="500" autocomplete="off" required>
        <button type="submit" class="btn-primary">Send</button>
      </form>
      <small class="error-msg chat-error"></small>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function closeModal() {
    activeChatLoadMessages = null;
    overlay.remove();
    document.body.style.overflow = '';
    // The unread badge on the dashboard only clears once these re-render;
    // opening the chat already marked the thread read server-side.
    renderPassengerRideStatus();
    renderDriverRideRequests();
  }

  overlay.querySelector('.chat-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) closeModal();
  });

  async function loadMessages() {
    try {
      const messages = await fetchRideMessages(rideId);
      renderChatMessages(overlay, messages);
    } catch (error) {
      const errorEl = overlay.querySelector('.chat-error');
      if (errorEl) errorEl.textContent = error.message;
    }
  }

  overlay.querySelector('.chat-input-row').addEventListener('submit', async function(event) {
    event.preventDefault();
    const input = overlay.querySelector('.chat-input');
    const text = input.value.trim();
    if (!text) return;
    const errorEl = overlay.querySelector('.chat-error');
    errorEl.textContent = '';
    try {
      await sendRideMessage(rideId, text);
      input.value = '';
      await loadMessages();
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });

  loadMessages();
  activeChatLoadMessages = loadMessages;
}

// Ride/Booking history's Today/All chips (driver-bookings.html and
// passenger-bookings.html). The driver dashboard's "Today's trips" and
// "Today's earnings" cards link here with ?show=today, "Completed" with
// ?show=all.
// My Rides (driver.html) has the same history card under its pending
// requests, starting on Today (data-default) so the dashboard stays short;
// its stat cards scroll down to it and switch the filter (data-history-show).
const initialShowParam = new URLSearchParams(location.search).get('show');
const rideFilterDefault = (document.querySelector('#ride-filter') || { dataset: {} }).dataset.default;
let rideHistoryFilter = (initialShowParam || rideFilterDefault) === 'today' ? 'today' : 'all';

function setupRideHistoryFilter() {
  const chips = document.querySelectorAll('#ride-filter .ride-filter-chip');
  if (!chips.length) return;
  const sync = () => chips.forEach(chip => {
    const on = chip.getAttribute('data-show') === rideHistoryFilter;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', String(on));
  });
  const setFilter = (value) => {
    if (value === rideHistoryFilter) return;
    rideHistoryFilter = value;
    sync();
    renderBookingsList();
  };
  sync();
  chips.forEach(chip => chip.addEventListener('click', () => setFilter(chip.getAttribute('data-show'))));
  document.querySelectorAll('a[data-history-show]').forEach(link => {
    link.addEventListener('click', (event) => {
      // Phones keep the old My Rides (no history card there, see
      // driver.css): Completed opens the history page as before, the other
      // cards do nothing.
      if (window.matchMedia('(max-width: 720px)').matches) {
        event.preventDefault();
        if (link.getAttribute('data-history-show') === 'all') location.href = 'driver-bookings.html';
        return;
      }
      setFilter(link.getAttribute('data-history-show'));
    });
  });
}

// Driver: "3 trips today · ₱150 earned". Passenger: "3 rides today · ₱150 spent".
function renderRideFilterSummary(summary, isToday, isDriver) {
  const el = document.querySelector('#ride-filter-summary');
  if (!el) return;
  if (!summary) {
    el.innerHTML = '';
    return;
  }
  const noun = isDriver ? 'trip' : 'ride';
  el.innerHTML = `<span><strong>${summary.trips}</strong> ${noun}${summary.trips === 1 ? '' : 's'}${isToday ? ' today' : ''}</span>`
    + `<span><strong>₱${summary.earnings.toFixed(0)}</strong> ${isDriver ? 'earned' : 'spent'}</span>`;
}

async function renderBookingsList() {
  const loading = document.querySelector('#bookings-loading');
  const emptyState = document.querySelector('#bookings-empty');
  const list = document.querySelector('#bookings-list');
  if (!loading || !emptyState || !list) return;

  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'passenger' && user.role !== 'driver')) return;

  const isDriver = user.role === 'driver';
  const allRides = await (isDriver ? fetchDriverRides() : fetchMyRides());
  loading.style.display = 'none';
  // Nothing to filter until there's at least one ride.
  const filterEl = document.querySelector('#ride-filter');
  if (filterEl) filterEl.style.display = allRides.length ? '' : 'none';

  if (!allRides.length) {
    emptyState.style.display = 'flex';
    list.style.display = 'none';
    list.innerHTML = '';
    renderRideFilterSummary(null);
    return;
  }

  // Only the two history pages have the Today/All chips.
  const hasFilter = Boolean(document.querySelector('#ride-filter'));
  const showToday = hasFilter && rideHistoryFilter === 'today';
  const rides = showToday ? allRides.filter(isRideToday) : allRides;
  if (hasFilter) renderRideFilterSummary(summarizeRides(rides), showToday, isDriver);

  emptyState.style.display = 'none';
  list.style.display = 'flex';
  if (!rides.length) {
    list.innerHTML = `<div class="ride-filter-empty">No ${isDriver ? 'trips' : 'rides'} today yet.</div>`;
    return;
  }
  list.innerHTML = rides.map(ride => {
    const statusConfig = getRideStatusConfig(ride.status);
    const fareText = ride.fare != null ? formatFareWithDistance(ride.fare, ride.distance_km) : 'Calculating';
    const otherPartyLabel = isDriver ? 'Passenger' : 'Driver';
    const otherPartyName = (isDriver ? ride.passenger_name : ride.driver_name) || 'Not yet assigned';
    const requestedAt = new Date(ride.created_at).toLocaleString();
    const canReview = !isDriver && ride.status === 'Completed';
    const reviewBlock = !canReview ? '' : ride.has_review
      ? `<p class="review-existing">${'★'.repeat(ride.my_rating)}${'☆'.repeat(5 - ride.my_rating)} You rated this ride</p>`
      : `<div class="review-prompt" data-ride-id="${ride.ride_id}">
          <button type="button" class="btn-secondary-outline review-toggle">Rate this ride</button>
          <div class="review-form" style="display:none;">
            <div class="star-rating">
              ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-star="${n}">★</button>`).join('')}
            </div>
            <textarea class="review-comment" rows="2" placeholder="Optional comment..."></textarea>
            <button type="button" class="btn-primary review-submit">Submit review</button>
            <small class="error-msg review-error"></small>
          </div>
        </div>`;

    // The other party on this ride is who a complaint would be filed
    // against — a driver has passenger_account_id, a passenger has
    // driver_account_id, both selected via `r.*` in rideController.
    const otherPartyAccountId = isDriver ? ride.passenger_account_id : ride.driver_account_id;
    // Categories mirror rules.html's Code of Conduct — a driver can only
    // witness/report the passenger-side violations listed there, and vice
    // versa, so the dropdown must match whoever is filing the complaint.
    const complaintCategories = isDriver
      ? ['No-show', 'Rude behavior', 'Refused to pay', 'Fake booking', 'Misuse of Shared ride', 'Other']
      : ['Reckless driving', 'Overcharging', 'Rude behavior', 'Refused service', 'Unsafe vehicle', 'Cancelled without reason', 'Other'];
    const complaintBlock = !otherPartyAccountId ? '' : `
      <div class="complaint-prompt" data-ride-id="${ride.ride_id}" data-against-account-id="${otherPartyAccountId}">
        <button type="button" class="btn-secondary-outline complaint-toggle">Report a concern</button>
        <div class="complaint-form" style="display:none;">
          <select class="complaint-category">
            <option value="">Select a category</option>
            ${complaintCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <textarea class="complaint-description" rows="2" placeholder="Describe what happened..."></textarea>
          <button type="button" class="btn-primary complaint-submit">Submit report</button>
          <small class="error-msg complaint-error"></small>
        </div>
      </div>`;

    const actionsHtml = (reviewBlock || complaintBlock)
      ? `<div class="booking-divider"></div>
         <div class="booking-actions">${reviewBlock}${complaintBlock}</div>`
      : '';

    return `
      <article class="booking-item">
        <div class="booking-top">
          <div class="booking-info">
            <p class="booking-route">${escapeHtml(shortLocationLabel(ride.pickup_location))} <span class="ride-route-arrow">→</span> ${escapeHtml(shortLocationLabel(ride.dropoff_location))}</p>
            <div class="booking-meta">
              <span>${escapeHtml(ride.ride_type)}</span>
              <span>${escapeHtml(otherPartyLabel)}: ${escapeHtml(otherPartyName)}</span>
              <span>Requested ${escapeHtml(requestedAt)}</span>
            </div>
          </div>
          <div class="booking-status">
            <span class="booking-fare">${escapeHtml(fareText)}</span>
            <span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span>
          </div>
        </div>
        ${actionsHtml}
      </article>
    `;
  }).join('');

  setupReviewPrompts(list);
  setupComplaintPrompts(list);
}

function setupReviewPrompts(container) {
  container.querySelectorAll('.review-prompt').forEach(prompt => {
    const rideId = prompt.getAttribute('data-ride-id');
    const toggleBtn = prompt.querySelector('.review-toggle');
    const form = prompt.querySelector('.review-form');
    const starButtons = Array.from(prompt.querySelectorAll('.star-btn'));
    const commentEl = prompt.querySelector('.review-comment');
    const submitBtn = prompt.querySelector('.review-submit');
    const errorEl = prompt.querySelector('.review-error');
    let selectedRating = 0;

    toggleBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    starButtons.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = Number(star.getAttribute('data-star'));
        starButtons.forEach(s => s.classList.toggle('is-selected', Number(s.getAttribute('data-star')) <= selectedRating));
      });
    });

    submitBtn.addEventListener('click', async () => {
      errorEl.textContent = '';
      if (!selectedRating) {
        errorEl.textContent = 'Please select a star rating.';
        return;
      }
      submitBtn.disabled = true;
      try {
        const res = await fetch(REVIEWS_API_URL, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ride_id: rideId, rating: selectedRating, comment: commentEl.value.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to submit review');
        showRideFeedback('success', 'Thanks!', 'Your review has been submitted.');
        renderBookingsList();
      } catch (error) {
        errorEl.textContent = error.message || 'Please try again.';
        submitBtn.disabled = false;
      }
    });
  });
}

// "Report a concern" — lets a passenger/driver file a complaint against the
// other party on a given ride. Same toggle-a-hidden-form pattern as reviews.
function setupComplaintPrompts(container) {
  container.querySelectorAll('.complaint-prompt').forEach(prompt => {
    const rideId = prompt.getAttribute('data-ride-id');
    const againstAccountId = prompt.getAttribute('data-against-account-id');
    const toggleBtn = prompt.querySelector('.complaint-toggle');
    const form = prompt.querySelector('.complaint-form');
    const categoryEl = prompt.querySelector('.complaint-category');
    const descriptionEl = prompt.querySelector('.complaint-description');
    const submitBtn = prompt.querySelector('.complaint-submit');
    const errorEl = prompt.querySelector('.complaint-error');

    toggleBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    submitBtn.addEventListener('click', async () => {
      errorEl.textContent = '';
      if (!categoryEl.value) {
        errorEl.textContent = 'Please select a category.';
        return;
      }
      if (!descriptionEl.value.trim()) {
        errorEl.textContent = 'Please describe what happened.';
        return;
      }
      submitBtn.disabled = true;
      try {
        const res = await fetch(COMPLAINTS_API_URL, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ride_id: rideId,
            against_account_id: againstAccountId,
            category: categoryEl.value,
            description: descriptionEl.value.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to submit report');
        showRideFeedback('success', 'Report submitted', 'Our admin team will review this shortly.');
        toggleBtn.textContent = 'Report a concern';
        form.style.display = 'none';
        categoryEl.value = '';
        descriptionEl.value = '';
      } catch (error) {
        errorEl.textContent = error.message || 'Please try again.';
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}

// Same "leave in X minutes" scheduled_at a driver's card should surface —
// otherwise a released scheduled ride looks identical to one just booked,
// and the driver has no way to see when the passenger actually wants to go.
function scheduledBadgeHtml(scheduledAt) {
  if (!scheduledAt) return '';
  const label = new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<span class="ride-badge tone-info">Scheduled ${label}</span>`;
}

function renderPendingRideCard(group) {
  if (group.type === 'solo') {
    const ride = group.ride;
    const statusConfig = getRideStatusConfig(ride.status);
    return `
      <article class="driver-card">
        <div class="driver-card-header">
          <div>
            <h3>${escapeHtml(ride.passenger_name || 'Passenger')}</h3>
            <p>${escapeHtml(ride.pickup_location)} → ${escapeHtml(ride.dropoff_location)}</p>
          </div>
          <span class="ride-badge tone-${statusConfig.tone}">Solo</span>
        </div>
        <div class="driver-card-meta">
          <span>Estimated fare: ${escapeHtml(formatFareWithDistance(ride.fare || 0, ride.distance_km))}</span>
          <span>${new Date(ride.created_at).toLocaleString()}</span>
          ${scheduledBadgeHtml(ride.scheduled_at)}
        </div>
        ${bookedForDriverHtml(ride)}
        <div class="driver-card-actions">
          <button type="button" class="btn-primary" data-action="accept-ride" data-ride-id="${ride.ride_id}">Accept</button>
          <button type="button" class="btn-secondary-outline" data-action="decline-ride" data-ride-id="${ride.ride_id}">Decline</button>
        </div>
      </article>
    `;
  }

  const riderCount = group.riders.length;
  const names = group.riders.map(r => escapeHtml(r.passenger_name || 'Passenger')).join(', ');
  const anchorRideId = group.riders[0].ride_id;
  const allRideIds = group.riders.map(r => r.ride_id).join(',');
  const canAccept = riderCount >= 2;

  const fareTierRow = `
    <div class="fare-tier-row">
      <span class="fare-tier-chip${riderCount >= 2 ? ' is-active' : ''}">2 · ₱35</span>
      <span class="fare-tier-chip${riderCount >= 3 ? ' is-active' : ''}">3 · ₱25</span>
      <span class="fare-tier-chip${riderCount >= 4 ? ' is-active' : ''}">4 · ₱20</span>
    </div>
  `;

  const description = !canAccept
    ? `Needs ${2 - riderCount} more student${2 - riderCount === 1 ? '' : 's'} before this can be accepted.`
    : riderCount < 4
      ? 'Wait for more students, or accept now to depart with the current group.'
      : 'Tricycle is full and ready to depart.';

  const acceptButton = canAccept
    ? `<button type="button" class="btn-primary" data-action="accept-ride" data-ride-id="${anchorRideId}">Accept${riderCount < 4 ? ' & depart now' : ''}</button>`
    : `<button type="button" class="btn-secondary-outline" disabled>Waiting for more students</button>`;

  return `
    <article class="driver-card">
      <div class="driver-card-header">
        <div>
          <h3>Shared ride (${riderCount}/4)</h3>
          <p>${escapeHtml(group.pickup_location)} → ${escapeHtml(group.dropoff_location)}</p>
        </div>
        <span class="ride-badge tone-warning">${riderCount}/4 joined</span>
      </div>
      <div class="driver-card-meta">
        <span>${names}</span>
        ${scheduledBadgeHtml(group.scheduled_at)}
      </div>
      ${fareTierRow}
      <p class="driver-card-description">${description}</p>
      <div class="driver-card-actions">
        ${acceptButton}
        <button type="button" class="btn-secondary-outline" data-action="decline-pool" data-ride-ids="${allRideIds}">Decline</button>
      </div>
    </article>
  `;
}

function renderActiveRideCard(group) {
  const anchor = group.riders[0];
  const statusConfig = getRideStatusConfig(anchor.status);
  const names = group.riders.map(r => escapeHtml(r.passenger_name || 'Passenger')).join(', ');
  const allRideIds = group.riders.map(r => r.ride_id).join(',');
  const nextStatusButtons = getNextRideStatusOptions(anchor.status)
    .map(nextStatus => nextStatus === 'Cancelled'
      // Cancelling the whole trip must drop every rider in the pool, not just
      // the anchor — the backend cascade deliberately excludes Cancelled (a
      // passenger cancelling their own seat shouldn't cancel everyone else's),
      // so when the DRIVER cancels the whole trip, every ride_id is targeted
      // explicitly instead, same pattern as the "Decline" pool button.
      ? `<button type="button" class="btn-secondary-outline" data-action="cancel-pool" data-ride-ids="${allRideIds}" data-next-status="${nextStatus}">${escapeHtml(nextStatus)}</button>`
      : `<button type="button" class="btn-secondary-outline" data-action="advance-status" data-ride-id="${anchor.ride_id}" data-next-status="${nextStatus}">${escapeHtml(nextStatus)}</button>`)
    .join('');
  // One chat entry point per rider — a Shared-pool card can hold several
  // riders, each with their own ride_id and their own message thread.
  const chatButtons = group.riders
    .map(r => `
      <button type="button" class="btn-secondary-outline" data-action="open-chat" data-ride-id="${r.ride_id}" data-other-name="${escapeHtml(r.passenger_name || 'Passenger')}">
        💬 Chat${group.riders.length > 1 ? ` (${escapeHtml(r.passenger_name || 'Passenger')})` : ''}${r.unread_message_count > 0 ? `<span class="chat-unread-badge">${r.unread_message_count}</span>` : ''}
      </button>
    `)
    .join('');

  // Accepting a Shared pool early (under 4) doesn't close it — more
  // students can still join this same trip, under this same driver, right
  // up until it's full or the driver marks "Picked Up" (departs).
  const poolStillOpen = anchor.ride_type === 'Shared' && anchor.pool_status === 'Open' && group.riders.length < 4;
  const fareTierRow = poolStillOpen ? `
    <div class="fare-tier-row">
      <span class="fare-tier-chip${group.riders.length >= 2 ? ' is-active' : ''}">2 · ₱35</span>
      <span class="fare-tier-chip${group.riders.length >= 3 ? ' is-active' : ''}">3 · ₱25</span>
      <span class="fare-tier-chip${group.riders.length >= 4 ? ' is-active' : ''}">4 · ₱20</span>
    </div>
  ` : '';
  const waitingNote = poolStillOpen
    ? `<p class="driver-card-description">Still waiting for other students to join — ${group.riders.length}/4 so far. Fare may drop further before you depart.</p>`
    : '';

  return `
    <article class="driver-card">
      <div class="driver-card-header">
        <div>
          <h3>${group.riders.length > 1 ? `Shared trip · ${group.riders.length} students` : escapeHtml(names)}</h3>
          <p>${escapeHtml(anchor.pickup_location)} → ${escapeHtml(anchor.dropoff_location)}</p>
        </div>
        <span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span>
      </div>
      <div class="driver-card-meta">
        <span>${group.riders.length > 1 ? names : escapeHtml(anchor.ride_type)}</span>
        <span>${anchor.ride_type === 'Shared'
          ? `Fare: ₱${Number(anchor.fare || 0).toFixed(0)}/student`
          : `Estimated fare: ${escapeHtml(formatFareWithDistance(anchor.fare || 0, anchor.distance_km))}`}</span>
      </div>
      ${fareTierRow}
      ${waitingNote}
      ${group.riders.length === 1 ? bookedForDriverHtml(anchor) : ''}
      ${rideEtaRowHtml(anchor, 'driver')}
      <p class="driver-card-description">${escapeHtml(statusConfig.description)}</p>
      <div class="driver-card-actions">
        ${chatButtons}
        ${nextStatusButtons}
      </div>
    </article>
  `;
}

// Ride IDs in the driver's pending list at its last load (null before the
// first), for spotting new bookings — see renderDriverRideRequests.
let knownPendingRideIds = null;

async function renderDriverRideRequests() {
  const container = document.querySelector('#driver-ride-requests');
  if (!container) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') {
    container.innerHTML = '<article class="dashboard-card"><p>Log in as a driver to view ride requests.</p></article>';
    return;
  }

  const [pendingGroups, myRides] = await Promise.all([fetchPendingRides(), fetchDriverRides()]);
  const activeGroups = groupRidesByPool(myRides.filter(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status)));

  // Anything pending now that wasn't in the last load is a new booking. The
  // first load only records what's there, so opening the page doesn't alert
  // for requests the driver can already see; a driver mid-trip isn't alerted.
  const groupRideIds = (group) => (group.type === 'solo' ? [group.ride.ride_id] : group.riders.map(r => r.ride_id));
  const newGroups = knownPendingRideIds === null
    ? []
    : pendingGroups.filter(group => groupRideIds(group).some(id => !knownPendingRideIds.has(id)));
  knownPendingRideIds = new Set(pendingGroups.flatMap(groupRideIds));
  if (newGroups.length && !activeGroups.length) alertDriverOfNewRides(newGroups);

  if (!pendingGroups.length && !activeGroups.length) {
    container.innerHTML = '<article class="dashboard-card"><p>No active ride requests right now.</p></article>';
    return;
  }

  container.innerHTML = pendingGroups.map(renderPendingRideCard).join('') + activeGroups.map(renderActiveRideCard).join('');

  container.querySelectorAll('[data-action="accept-ride"]').forEach(button => {
    button.addEventListener('click', async function() {
      const rideId = this.getAttribute('data-ride-id');
      try {
        const result = await acceptRideRemote(rideId);
        showRideFeedback('success', 'Ride accepted', result.fare
          ? (result.poolStillOpen
            ? `Trip assigned to you — currently ₱${result.fare}/student, more students may still join before you depart.`
            : `Trip assigned to you — fare locked at ₱${result.fare}/student.`)
          : 'The trip is now assigned to you.');
        renderPassengerRideStatus();
        renderDriverRideRequests();
        renderDriverDashboardStats();
        // Starts GPS sharing (and the browser's native location prompt)
        // right now instead of waiting for the next 10s poll tick.
        syncDriverLocationSharing();
      } catch (error) {
        showRideFeedback('error', 'Could not accept', error.message || 'Please try again.');
        // The ride may have just been taken by another driver, or this driver
        // may already have an active trip — refresh so the list reflects it.
        renderDriverRideRequests();
      }
    });
  });

  container.querySelectorAll('[data-action="decline-ride"]').forEach(button => {
    button.addEventListener('click', async function() {
      const rideId = this.getAttribute('data-ride-id');
      try {
        await declineRideRemote(rideId);
        showRideFeedback('info', 'Ride declined', 'Removed from your list. Other drivers can still accept it.');
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not decline', error.message || 'Please try again.');
      }
    });
  });

  // Declining a Shared pool declines it for every rider currently in it
  // (not just one) — consistent with Accept, which assigns the whole group
  // at once. Other drivers can still pick up the route fresh afterward.
  container.querySelectorAll('[data-action="decline-pool"]').forEach(button => {
    button.addEventListener('click', async function() {
      const rideIds = this.getAttribute('data-ride-ids').split(',').filter(Boolean);
      try {
        await Promise.all(rideIds.map(id => declineRideRemote(id)));
        showRideFeedback('info', 'Ride declined', 'Removed from your list. Other drivers can still accept it.');
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not decline', error.message || 'Please try again.');
      }
    });
  });

  container.querySelectorAll('[data-action="open-chat"]').forEach(button => {
    button.addEventListener('click', function() {
      openChatModal(this.getAttribute('data-ride-id'), this.getAttribute('data-other-name'));
    });
  });

  // Driver cancelling an active trip drops every rider sharing that pool,
  // not just one — see the comment on allRideIds in renderActiveRideCard.
  container.querySelectorAll('[data-action="cancel-pool"]').forEach(button => {
    button.addEventListener('click', async function() {
      const rideIds = this.getAttribute('data-ride-ids').split(',').filter(Boolean);
      try {
        await Promise.all(rideIds.map(id => updateRideStatusRemote(id, 'Cancelled')));
        showRideFeedback('info', 'Trip cancelled', 'The trip was cancelled and every rider was notified.');
        renderPassengerRideStatus();
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not cancel', error.message || 'Please try again.');
      }
    });
  });

  container.querySelectorAll('[data-action="advance-status"]').forEach(button => {
    button.addEventListener('click', async function() {
      const rideId = this.getAttribute('data-ride-id');
      const nextStatus = this.getAttribute('data-next-status');
      try {
        await updateRideStatusRemote(rideId, nextStatus);
        showRideFeedback('success', 'Status updated', `The ride is now marked as ${nextStatus}.`);
        renderPassengerRideStatus();
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not update', error.message || 'Please try again.');
      }
    });
  });
}

async function renderDriverDashboardStats() {
  const todayCount = document.querySelector('#driver-count-today');
  const pendingCount = document.querySelector('#driver-pending-count');
  const earningsBox = document.querySelector('#driver-earnings');
  const completedCount = document.querySelector('#driver-completed-count');

  if (!todayCount && !pendingCount && !earningsBox && !completedCount) return;

  const user = getStoredUser();
  if (!user.accountId) return;

  const [driverRides, pendingGroups] = await Promise.all([fetchDriverRides(), fetchPendingRides()]);
  const completedRides = driverRides.filter(r => r.status === 'Completed');
  const pendingRideCount = pendingGroups.reduce((sum, g) => sum + (g.type === 'shared' ? g.riders.length : 1), 0);
  const todaySummary = summarizeRides(driverRides.filter(isRideToday));
  const allEarnings = sumRideFares(completedRides);
  const earningsAll = document.querySelector('#driver-earnings-all');

  // "Today's trips" used to count every ride ever completed plus the active
  // ones, with no date filter at all — it's now only today's.
  if (todayCount) todayCount.textContent = String(todaySummary.trips);
  if (pendingCount) pendingCount.textContent = String(pendingRideCount);
  if (earningsBox) earningsBox.textContent = `₱${todaySummary.earnings.toFixed(0)}`;
  if (earningsAll) earningsAll.textContent = `₱${allEarnings.toFixed(0)} all time`;
  if (completedCount) completedCount.textContent = String(completedRides.length);
}

// "Today" for the driver's stats and both history pages: a completed ride counts on
// the day it was completed (its updated_at — nothing changes a ride once
// it's Completed), anything else on the day it was booked.
function isRideToday(ride) {
  const stamp = ride.status === 'Completed' ? (ride.updated_at || ride.created_at) : ride.created_at;
  return new Date(stamp).toDateString() === new Date().toDateString();
}

function sumRideFares(rides) {
  return rides.reduce((sum, r) => sum + Number(r.fare || 0), 0);
}

// A trip is a ride that actually went ahead (active or finished); the money
// total only counts finished ones, since the fare is paid in cash at
// drop-off. Same numbers for both sides: driver earned, passenger spent.
function summarizeRides(rides) {
  const trips = rides.filter(r => ['Accepted', 'Picked Up', 'In Progress', 'Completed'].includes(r.status));
  return {
    trips: trips.length,
    earnings: sumRideFares(trips.filter(r => r.status === 'Completed'))
  };
}
 
// Logout confirmation popup — same overlay mechanics as the other dynamic
// modals in this file (dim+blur backdrop, Esc/click-outside to dismiss)
// but its own centered icon layout, matching the mockup reviewed and
// approved before this was wired up — deliberately calmer/centered rather
// than a left-aligned header+body layout, since logging out isn't a
// destructive action and shouldn't look like one.
function showLogoutConfirm() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'logout-confirm-overlay';
    overlay.innerHTML = `
      <div class="logout-confirm-card">
        <div class="logout-confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
        </div>
        <h3>Are you sure you want to logout?</h3>
        <p>You'll need to sign in again to book or manage rides on this device.</p>
        <div class="logout-confirm-actions">
          <button type="button" class="logout-cancel-btn">Cancel</button>
          <button type="button" class="logout-confirm-btn">Log out</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close(result) {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onKeydown(event) {
      if (event.key === 'Escape') close(false);
    }

    overlay.querySelector('.logout-cancel-btn').addEventListener('click', () => close(false));
    overlay.querySelector('.logout-confirm-btn').addEventListener('click', () => close(true));
    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeydown);
  });
}

function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', async function(event) {
      event.preventDefault();
      const confirmed = await showLogoutConfirm();
      if (!confirmed) return;
      // Best-effort: flip the driver/passenger's is_online off as soon as
      // they log out, so Admin's driver-availability count and Passenger
      // management panel don't show a stale "online" account that's gone.
      // Fired (and AWAITED) before clearStoredUser() wipes the token these
      // calls need — an earlier version fired this without awaiting it,
      // then immediately navigated away, which cancelled the request
      // before the server could process it almost every time.
      const loggedOutRole = getStoredUser().role;
      try {
        if (loggedOutRole === 'driver') {
          await fetch(`${RIDES_API_URL}/driver/availability`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_online: false }),
            keepalive: true
          });
        } else if (loggedOutRole === 'passenger' || loggedOutRole === 'student') {
          // Stored as "passenger" (login normalizes the server's "student"),
          // so checking only "student" meant this call never went out and
          // every passenger stayed Active in admin after logging out.
          await fetch(`${API_BASE_URL}/logout/student`, {
            method: 'POST',
            headers: getAuthHeaders(),
            keepalive: true
          });
        }
      } catch (error) {
        // Best-effort — proceed with logout even if this call fails.
      }
      clearStoredUser();
      window.location.href = 'index.html';
    });

    if (isAuthenticated()) {
      button.style.display = '';
    } else {
      button.style.display = 'none';
    }
  });
}
 
function sanitizeName(value) {
  return value.replace(/[^a-zA-Z\s'-]/g, '').trim();
}
 
function formatName(value) {
  const sanitized = sanitizeName(value);
  return sanitized
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
 
function isValidName(value) {
  const sanitized = sanitizeName(value).trim();
  return sanitized.length >= 2 && /^[a-zA-Z\s'-]+$/.test(sanitized);
}
 
// Philippine LTO driver's license number format: 1 letter + 10 digits,
// displayed as L##-##-###### (e.g. N01-23-456789). Builds the formatted
// string character-by-character from whatever the user actually typed —
// first character must be a letter, the rest must be digits — so invalid
// characters are simply skipped rather than shown as an error mid-typing.
function formatDriverLicenseNumber(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let core = '';
  for (let i = 0; i < raw.length && core.length < 11; i++) {
    const ch = raw[i];
    if (core.length === 0) {
      if (/[A-Z]/.test(ch)) core += ch;
    } else if (/[0-9]/.test(ch)) {
      core += ch;
    }
  }
  const part1 = core.slice(0, 3);
  const part2 = core.slice(3, 5);
  const part3 = core.slice(5, 11);
  return [part1, part2, part3].filter(Boolean).join('-');
}

// Tricycle plate number format: 2 letters + 5 digits, displayed as
// XX-12345 (e.g. CD-64318). Same character-by-character build as the
// license number above — first 2 characters must be letters, the rest
// must be digits, invalid characters are skipped rather than errored on
// mid-typing.
function formatPlateNumber(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let core = '';
  for (let i = 0; i < raw.length && core.length < 7; i++) {
    const ch = raw[i];
    if (core.length < 2) {
      if (/[A-Z]/.test(ch)) core += ch;
    } else if (/[0-9]/.test(ch)) {
      core += ch;
    }
  }
  const part1 = core.slice(0, 2);
  const part2 = core.slice(2, 7);
  return [part1, part2].filter(Boolean).join('-');
}

function isValidPlateNumber(value) {
  return /^[A-Z]{2}-\d{5}$/.test(value);
}

// Tricycle body number format: exactly 5 digits, no letters or hyphen —
// just strips anything non-numeric and caps the length as the user types.
function formatBodyNumber(value) {
  return value.replace(/[^0-9]/g, '').slice(0, 5);
}

function isValidBodyNumber(value) {
  return /^\d{5}$/.test(value);
}

function isValidDriverLicenseNumber(value) {
  return /^[A-Z]\d{2}-\d{2}-\d{6}$/.test(value);
}

function isValidEmail(value) {
  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isValidContactNumber(value) {
  // Philippine mobile format: 09XXXXXXXXX (11 digits, starts with 09)
  return /^09\d{9}$/.test(value);
}

// Strips anything non-numeric and caps it at 11 digits as the user types
// their own contact number — same digit-only masking as the body number.
function formatContactNumber(value) {
  return value.replace(/[^0-9]/g, '').slice(0, 11);
}
 
function checkPasswordStrength(value) {
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(value);
  const isLongEnough = value.length >= 8;
 
  return { hasLower, hasUpper, hasNumber, hasSpecial, isLongEnough };
}
 
function validateStudentIdFormat(id) {
  // Adjust pattern to match your institution's ID format. Currently expects exactly 10 digits.
  return /^\d{10}$/.test(id);
}
 
 
function showAuthFeedback(type, title, message) {
  const modal = document.querySelector('#auth-modal');
  const modalIcon = document.querySelector('#modal-icon');
  const modalTitle = document.querySelector('#modal-title');
  const modalMessage = document.querySelector('#modal-message');
  const modalRedirectText = document.querySelector('#modal-redirect-text');
  const progressBar = document.querySelector('#modal-progress-bar');
  const modalContent = document.querySelector('.auth-modal-content');
  // Only the Pending-login notice offers this; every other message starts
  // without it (see the login submit handler).
  const reuploadBtn = document.querySelector('#modal-reupload-btn');
  if (reuploadBtn) reuploadBtn.classList.add('hidden');

  if (type === 'success') {
    modalIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"/></svg>';
    modalIcon.className = 'auth-modal-icon';
    modalTitle.textContent = title || 'Welcome!';
    modalTitle.style.color = '';
    modalMessage.textContent = message || 'Your account has been created successfully.';
    modalRedirectText.textContent = 'Redirecting to your dashboard...';
    modalRedirectText.style.display = 'block';
  } else if (type === 'error') {
    modalIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    modalIcon.className = 'auth-modal-icon error';
    modalTitle.textContent = title || 'Something went wrong';
    modalTitle.style.color = '';
    if (modalContent) modalContent.classList.add('error');
    modalMessage.textContent = message || 'Something went wrong. Please try again.';
    modalRedirectText.style.display = 'none';
  } else if (type === 'pending') {
    // A driver account awaiting admin verification: not an error, but there
    // is no dashboard to send them to either, so it stays until dismissed.
    modalIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
    modalIcon.className = 'auth-modal-icon neutral';
    modalTitle.textContent = title;
    modalTitle.style.color = '';
    if (modalContent) modalContent.classList.remove('error');
    modalMessage.textContent = message;
    modalRedirectText.style.display = 'none';
  }
 
  // Show modal
  modal.classList.remove('hidden');
 
  // Auto-hide and redirect for success
  if (type === 'success') {
    progressBar.style.width = '0%';
    setTimeout(() => {
      progressBar.style.animation = 'none';
      void progressBar.offsetWidth; // Trigger reflow
      progressBar.style.animation = 'progressFill 2.5s ease forwards';
    }, 10);
 
    setTimeout(() => {
      if (modalContent) modalContent.classList.remove('error');
      modal.classList.add('hidden');
    }, 2500);
  }
}
 
function hideAuthModal() {
  const modal = document.querySelector('#auth-modal');
  modal.classList.add('hidden');
}

// Contact number + password from a login attempt that came back Pending —
// see the login submit handler. Nothing else reads or keeps them.
let pendingDriverCredentials = null;

// "Upload license again", offered on the waiting-for-verification notice.
// A Pending driver has no token, so the upload carries the credentials they
// just logged in with instead (see reuploadDriverLicense in authController).
function setupReuploadLicenseModal() {
  const openBtn = document.querySelector('#modal-reupload-btn');
  const modal = document.querySelector('#reupload-license-modal');
  if (!openBtn || !modal) return;

  const fileInput = document.querySelector('#reupload-license-file');
  const errorEl = document.querySelector('#reupload-license-error');
  const submitBtn = document.querySelector('#reupload-submit-btn');
  const step1 = document.querySelector('#reupload-step-1');
  const step2 = document.querySelector('#reupload-step-2');

  const close = () => {
    modal.classList.add('hidden');
    pendingDriverCredentials = null;
  };

  openBtn.addEventListener('click', () => {
    hideAuthModal();
    fileInput.value = '';
    errorEl.textContent = '';
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    modal.classList.remove('hidden');
  });
  document.querySelector('#reupload-cancel-btn').addEventListener('click', close);
  document.querySelector('#reupload-done-btn').addEventListener('click', close);

  submitBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      errorEl.textContent = "Please choose a photo or scan of your driver's license";
      return;
    }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      errorEl.textContent = 'Only JPG, PNG, or PDF files are allowed';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorEl.textContent = 'File is too large (max 5MB)';
      return;
    }
    if (!pendingDriverCredentials) {
      errorEl.textContent = 'Please log in again first.';
      return;
    }

    const formData = new FormData();
    formData.append('username', pendingDriverCredentials.username);
    formData.append('password', pendingDriverCredentials.password);
    formData.append('licenseDocument', file);

    submitBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE_URL}/reupload-license/driver`, { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorEl.textContent = data.error || 'Could not upload your license. Please try again.';
        return;
      }
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
    } catch (error) {
      errorEl.textContent = 'Could not connect to the server. Please try again.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}
 
// Dismiss modal on OK button or clicking overlay
document.addEventListener('click', function(event) {
  const okBtn = document.querySelector('#modal-ok-btn');
  if (!okBtn) return;
  if (event.target === okBtn) {
    hideAuthModal();
  }
});
 
// Allow clicking the modal overlay to close
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.querySelector('#auth-modal');
  if (!modal) return;
  modal.addEventListener('click', function(e) {
    if (e.target === modal) hideAuthModal();
  });
});
 
// Base URL of the backend API
const API_BASE_URL = '/api/auth';
 
function setupAuthForm() {
  const registerForm = document.querySelector('#register-form');
  const loginForm = document.querySelector('#login-form');
  const authTabs = document.querySelectorAll('.auth-tab');
  const tabContents = document.querySelectorAll('.auth-tab-content');
 
  if (authTabs.length > 0) {
    authTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const targetTab = this.getAttribute('data-tab');
        authTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        this.classList.add('active');
        const targetForm = document.querySelector(`#${targetTab}-form`);
        if (targetForm) targetForm.classList.add('active');
      });
    });

    // A "Login" link elsewhere (e.g. the Home page's nav-cta) points here
    // with ?tab=login so returning users land straight on the login form
    // instead of the Register tab that's active by default.
    if (new URLSearchParams(window.location.search).get('tab') === 'login') {
      const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
      if (loginTab) loginTab.click();
    }
  }
 
  if (registerForm) {
    const fullNameLiveInput = document.querySelector('#reg-fullname');
    const emailInput = document.querySelector('#reg-email');
    const contactInput = document.querySelector('#reg-contact');
    const passwordInput = document.querySelector('#reg-password');
    const roleSelect = document.querySelector('#reg-role');
    const studentSection = document.querySelector('#reg-student-section');
    const studentIdInput = document.querySelector('#reg-student-id');
    const driverSection = document.querySelector('#reg-driver-section');
    const licenseInput = document.querySelector('#reg-license');
    const plateInput = document.querySelector('#reg-plate');
    const bodyInput = document.querySelector('#reg-body');
    const licenseFileInput = document.querySelector('#reg-license-file');
    const otpModal = document.querySelector('#otp-modal');
    const otpModalEmail = document.querySelector('#otp-modal-email');
    const otpStatusEl = document.querySelector('#otp-status');
    const otpVerifyBtn = document.querySelector('#otp-verify-btn');
    const otpCancelBtn = document.querySelector('#otp-cancel-btn');
    const resendOtpBtn = document.querySelector('#reg-resend-otp');
    const OTP_TTL_SECONDS = 600; // matches OTP_TTL_MINUTES in otpController.js

    setupOtpDigitInputs('#reg-otp-digits');
    let stopRegOtpCountdown = () => {};

    // Passenger registration is two steps: send a code, then verify it
    // before the account is actually created (see authController.registerStudent,
    // which rejects the account creation call unless email_otp has a
    // verified, unexpired row for that email). The code entry itself lives
    // in a popup (#otp-modal) rather than inline in the form.
    let otpSent = false;
    let otpVerified = false;

    function resetOtpState() {
      otpSent = false;
      otpVerified = false;
      if (otpModal) otpModal.classList.add('hidden');
      clearOtpDigitInputs('#reg-otp-digits');
      stopRegOtpCountdown();
      const otpErrorEl = document.querySelector('#otp-error');
      if (otpErrorEl) otpErrorEl.textContent = '';
      if (otpStatusEl) otpStatusEl.textContent = '';
    }

    async function sendRegistrationOtp(targetEmail) {
      const response = await fetch(`${OTP_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send verification code');
      return data;
    }

    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', async function() {
        const targetEmail = emailInput.value.trim().toLowerCase();
        if (!targetEmail) return;
        const otpErrorEl = document.querySelector('#otp-error');
        if (otpErrorEl) otpErrorEl.textContent = '';
        if (otpStatusEl) otpStatusEl.textContent = 'Sending...';
        try {
          await sendRegistrationOtp(targetEmail);
          if (otpStatusEl) otpStatusEl.textContent = 'New code sent!';
          clearOtpDigitInputs('#reg-otp-digits');
          stopRegOtpCountdown();
          stopRegOtpCountdown = startOtpCountdown(document.querySelector('#otp-timer'), OTP_TTL_SECONDS);
        } catch (error) {
          if (otpStatusEl) otpStatusEl.textContent = '';
          if (otpErrorEl) otpErrorEl.textContent = error.message;
        }
      });
    }

    if (otpVerifyBtn) {
      // Re-fires the form's submit handler, which now sees otpSent === true
      // and reads the code instead of sending a new one.
      otpVerifyBtn.addEventListener('click', function() {
        registerForm.requestSubmit();
      });
    }

    if (otpCancelBtn) {
      otpCancelBtn.addEventListener('click', resetOtpState);
    }

    // Changing the email after a code was sent, or switching away from
    // Passenger, invalidates the in-progress OTP flow (it was for a
    // different, now-stale, email).
    if (emailInput) emailInput.addEventListener('input', resetOtpState);
    if (roleSelect) roleSelect.addEventListener('change', resetOtpState);

    // FORGOT PASSWORD (passenger only) — 3-step popup: enter email, enter
    // code + new password, success. Reuses the same digit-box/countdown
    // helpers as the registration OTP modal above, and the server's
    // existing /api/otp/verify for the code-check step (purpose-agnostic —
    // it just marks an email_otp row verified either way).
    const forgotPasswordLink = document.querySelector('#forgot-password-link');
    const forgotModal = document.querySelector('#forgot-password-modal');
    const resetStep1 = document.querySelector('#reset-step-1');
    const resetStep2 = document.querySelector('#reset-step-2');
    const resetStep3 = document.querySelector('#reset-step-3');
    const resetEmailInput = document.querySelector('#reset-email');
    const resetModalEmail = document.querySelector('#reset-modal-email');
    const resetNewPasswordInput = document.querySelector('#reset-new-password');

    let resetEmail = '';
    let stopResetCountdown = () => {};

    setupOtpDigitInputs('#reset-otp-digits');

    function showResetStep(step) {
      [resetStep1, resetStep2, resetStep3].forEach((el) => { if (el) el.classList.add('hidden'); });
      const target = step === 1 ? resetStep1 : step === 2 ? resetStep2 : resetStep3;
      if (target) target.classList.remove('hidden');
    }

    function resetForgotPasswordState() {
      resetEmail = '';
      stopResetCountdown();
      if (resetEmailInput) resetEmailInput.value = '';
      if (resetNewPasswordInput) resetNewPasswordInput.value = '';
      clearOtpDigitInputs('#reset-otp-digits');
      const err1 = document.querySelector('#reset-email-error');
      const err2 = document.querySelector('#reset-step2-error');
      if (err1) err1.textContent = '';
      if (err2) err2.textContent = '';
      showResetStep(1);
    }

    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', () => {
        resetForgotPasswordState();
        if (forgotModal) forgotModal.classList.remove('hidden');
      });
    }

    document.querySelectorAll('#reset-cancel-btn-1, #reset-cancel-btn-2').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (forgotModal) forgotModal.classList.add('hidden');
        resetForgotPasswordState();
      });
    });

    const resetSendBtn = document.querySelector('#reset-send-btn');
    if (resetSendBtn) {
      resetSendBtn.addEventListener('click', async () => {
        const email = resetEmailInput ? resetEmailInput.value.trim().toLowerCase() : '';
        const err1 = document.querySelector('#reset-email-error');
        if (err1) err1.textContent = '';
        if (!email) {
          if (err1) err1.textContent = 'Please enter your email';
          return;
        }
        try {
          const response = await fetch(`${OTP_API_URL}/send-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not send reset code');
          resetEmail = email;
          if (resetModalEmail) resetModalEmail.textContent = maskEmail(email);
          showResetStep(2);
          stopResetCountdown();
          stopResetCountdown = startOtpCountdown(document.querySelector('#reset-otp-timer'), OTP_TTL_SECONDS);
        } catch (error) {
          if (err1) err1.textContent = error.message;
        }
      });
    }

    const resetResendBtn = document.querySelector('#reset-resend-btn');
    if (resetResendBtn) {
      resetResendBtn.addEventListener('click', async () => {
        if (!resetEmail) return;
        const err2 = document.querySelector('#reset-step2-error');
        if (err2) err2.textContent = '';
        try {
          const response = await fetch(`${OTP_API_URL}/send-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not resend reset code');
          clearOtpDigitInputs('#reset-otp-digits');
          stopResetCountdown();
          stopResetCountdown = startOtpCountdown(document.querySelector('#reset-otp-timer'), OTP_TTL_SECONDS);
        } catch (error) {
          if (err2) err2.textContent = error.message;
        }
      });
    }

    const resetSubmitBtn = document.querySelector('#reset-submit-btn');
    if (resetSubmitBtn) {
      resetSubmitBtn.addEventListener('click', async () => {
        const err2 = document.querySelector('#reset-step2-error');
        if (err2) err2.textContent = '';
        const code = getOtpDigitValue('#reset-otp-digits');
        const newPassword = resetNewPasswordInput ? resetNewPasswordInput.value : '';

        if (code.length !== 6) {
          if (err2) err2.textContent = 'Please enter the 6-digit code';
          return;
        }
        if (newPassword.length < 8) {
          if (err2) err2.textContent = 'Password must be at least 8 characters';
          return;
        }

        try {
          const verifyResponse = await fetch(`${OTP_API_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code })
          });
          const verifyData = await verifyResponse.json();
          if (!verifyResponse.ok) throw new Error(verifyData.error || 'Incorrect code');

          const resetResponse = await fetch(`${API_BASE_URL}/reset-password/student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, newPassword })
          });
          const resetData = await resetResponse.json();
          if (!resetResponse.ok) throw new Error(resetData.error || 'Could not reset password');

          stopResetCountdown();
          showResetStep(3);
        } catch (error) {
          if (err2) err2.textContent = error.message;
        }
      });
    }

    const resetDoneBtn = document.querySelector('#reset-done-btn');
    if (resetDoneBtn) {
      resetDoneBtn.addEventListener('click', () => {
        if (forgotModal) forgotModal.classList.add('hidden');
        resetForgotPasswordState();
      });
    }

    // Real-time validation for first name
    // Live feedback for the single "Full name" box that replaced the separate
    // first/last inputs. It only flags characters that can't be in a name --
    // the "you also need a surname" check is left to submit, so it doesn't
    // accuse someone of an error while they're still mid-way through typing.
    if (fullNameLiveInput) {
      fullNameLiveInput.addEventListener('input', function() {
        const value = this.value.trim();
        const isEmpty = value.length === 0;
        const isValid = !isEmpty && isValidName(value);
        const errorEl = document.querySelector('#fullname-error');

        this.classList.remove('input-error', 'input-valid');
        if (errorEl) errorEl.textContent = '';

        if (!isEmpty && !isValid) {
          this.classList.add('input-error');
          if (errorEl) errorEl.textContent = 'Only letters allowed (minimum 2 characters)';
        } else if (isValid) {
          this.classList.add('input-valid');
        }
      });
    }
 
    // Real-time validation for confirm password
    const regPasswordConfirm = document.querySelector('#reg-password-confirm');
    if (regPasswordConfirm && passwordInput) {
      regPasswordConfirm.addEventListener('input', function() {
        const val = this.value;
        document.querySelector('#password-confirm-error').textContent = '';
        this.classList.remove('input-error', 'input-valid');
        if (val.length > 0 && passwordInput.value !== val) {
          this.classList.add('input-error');
          document.querySelector('#password-confirm-error').textContent = 'Passwords do not match';
        } else if (val.length > 0 && passwordInput.value === val) {
          this.classList.add('input-valid');
        }
      });
    }
 
 
    // Real-time validation for email
    if (emailInput) {
      emailInput.addEventListener('input', function() {
        const isEmpty = this.value.trim().length === 0;
        const isValid = !isEmpty && isValidEmail(this.value.trim().toLowerCase());
        
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#email-error').textContent = '';
        
        if (!isEmpty && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#email-error').textContent = 'Please enter a valid email (example@domain.com)';
        } else if (isValid) {
          this.classList.add('input-valid');
        }
      });
    }

    // Real-time formatting + validation for contact number — strips
    // non-digit characters and caps it at 11 digits as the user types their
    // own number, matching the same treatment as the driver fields above.
    if (contactInput) {
      contactInput.addEventListener('input', function() {
        this.value = formatContactNumber(this.value);
        const isComplete = isValidContactNumber(this.value);
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#contact-error').textContent = '';
        if (isComplete) {
          this.classList.add('input-valid');
        }
      });
      contactInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (val.length > 0 && !isValidContactNumber(val)) {
          this.classList.add('input-error');
          document.querySelector('#contact-error').textContent = 'Enter an 11-digit number starting with 09';
        }
      });
    }

    // Passengers now register with name, email and password only. Testing moved
    // off campus to a partner TODA after the bridge collapsed, so the people
    // signing up are members of the public: they have no student number, and
    // their contact number is never shown to a driver anywhere (they coordinate
    // in the in-app chat), so asking for it only adds a field to fail on.
    //
    // Both inputs stay in the DOM rather than being deleted. A driver's contact
    // number is still REQUIRED -- it is their login ID -- and restoring the
    // student field if testing returns to campus is then a matter of flipping
    // this function back, with no markup to rebuild.
    const toggleRoleFields = () => {
      if (!roleSelect) return;
      const isDriver = roleSelect.value === 'driver';

      // Student ID: hidden for everyone now, so it must never block submit.
      if (studentSection) studentSection.style.display = 'none';
      if (studentIdInput) {
        studentIdInput.value = '';
        const studentErr = document.querySelector('#student-id-error');
        if (studentErr) studentErr.textContent = '';
        studentIdInput.classList.remove('input-error', 'input-valid');
        studentIdInput.removeAttribute('required');
      }

      // Contact number: drivers only.
      const contactField = document.querySelector('#reg-contact-field');
      const contactRow = document.querySelector('#reg-email-contact-row');
      const regContact = document.querySelector('#reg-contact');
      if (contactField) contactField.style.display = isDriver ? '' : 'none';
      // That row is a two-column grid holding email + contact, and exactly one
      // of the two is always hidden now: contact for passengers (just above),
      // email for drivers (toggleDriverSection below -- they log in by contact
      // number and have no email). So it collapses unconditionally; a hidden
      // grid item leaves its column standing empty otherwise. The wrapper is
      // kept rather than flattened so restoring either field needs no markup.
      if (contactRow) contactRow.classList.add('is-single-column');
      if (regContact) {
        if (isDriver) {
          regContact.setAttribute('required', 'required');
        } else {
          // Leaving a stale value here would post a contact number the
          // passenger can no longer see or correct.
          regContact.value = '';
          const contactErr = document.querySelector('#contact-error');
          if (contactErr) contactErr.textContent = '';
          regContact.classList.remove('input-error', 'input-valid');
          regContact.removeAttribute('required');
        }
      }
    };
    const toggleStudentSection = toggleRoleFields;
 
    if (roleSelect) roleSelect.addEventListener('change', toggleStudentSection);
    toggleStudentSection();

    // Toggle driver's license field visibility based on role
    const emailField = document.querySelector('#reg-email-field');
    const driverContactNote = document.querySelector('#driver-contact-note');
    const toggleDriverSection = () => {
      if (!driverSection || !roleSelect) return;
      if (roleSelect.value === 'driver') {
        driverSection.style.display = '';
        if (licenseInput) licenseInput.setAttribute('required', 'required');
        if (plateInput) plateInput.setAttribute('required', 'required');
        if (bodyInput) bodyInput.setAttribute('required', 'required');
        if (licenseFileInput) licenseFileInput.setAttribute('required', 'required');
        // Drivers log in with their contact number, not an email — hide the
        // shared email field entirely for this role (see authController.registerDriver).
        if (emailField) emailField.style.display = 'none';
        if (emailInput) {
          emailInput.value = '';
          document.querySelector('#email-error').textContent = '';
          emailInput.classList.remove('input-error', 'input-valid');
          emailInput.removeAttribute('required');
        }
        if (driverContactNote) driverContactNote.style.display = '';
      } else {
        driverSection.style.display = 'none';
        if (licenseInput) {
          licenseInput.value = '';
          document.querySelector('#license-error').textContent = '';
          licenseInput.classList.remove('input-error', 'input-valid');
          licenseInput.removeAttribute('required');
        }
        if (plateInput) {
          plateInput.value = '';
          document.querySelector('#plate-error').textContent = '';
          plateInput.classList.remove('input-error', 'input-valid');
          plateInput.removeAttribute('required');
        }
        if (bodyInput) {
          bodyInput.value = '';
          document.querySelector('#body-error').textContent = '';
          bodyInput.classList.remove('input-error', 'input-valid');
          bodyInput.removeAttribute('required');
        }
        if (licenseFileInput) {
          licenseFileInput.value = '';
          document.querySelector('#license-file-error').textContent = '';
          licenseFileInput.removeAttribute('required');
        }
        if (emailField) emailField.style.display = '';
        if (emailInput) emailInput.setAttribute('required', 'required');
        if (driverContactNote) driverContactNote.style.display = 'none';
      }
    };

    if (roleSelect) roleSelect.addEventListener('change', toggleDriverSection);
    toggleDriverSection();

    // Real-time validation for student ID (passenger only)
    if (studentIdInput) {
      studentIdInput.addEventListener('input', function() {
        const val = this.value.trim();
        const isValid = /^\d{10}$/.test(val); // expect 10 digits; adjust as needed
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#student-id-error').textContent = '';
        if (val.length > 0 && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#student-id-error').textContent = 'Student ID must be 10 digits';
        } else if (isValid) {
          this.classList.add('input-valid');
        }
      });
    }

    // Real-time formatting + validation for driver's license number (driver
    // only) — auto-uppercases and auto-inserts hyphens into the Philippine
    // LTO format (L##-##-######) as the user types their own number; no
    // default value is ever set, this only reformats whatever they type.
    if (licenseInput) {
      licenseInput.addEventListener('input', function() {
        this.value = formatDriverLicenseNumber(this.value);
        const isComplete = isValidDriverLicenseNumber(this.value);
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#license-error').textContent = '';
        if (isComplete) {
          this.classList.add('input-valid');
        }
      });
      licenseInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (val.length > 0 && !isValidDriverLicenseNumber(val)) {
          this.classList.add('input-error');
          document.querySelector('#license-error').textContent = 'Format must be L##-##-###### (e.g. N01-23-456789)';
        }
      });
    }

    // Real-time formatting + validation for plate number (driver only) —
    // auto-uppercases and auto-inserts the hyphen after 2 letters (XX-12345,
    // e.g. CD-64318) as the user types their own plate number.
    if (plateInput) {
      plateInput.addEventListener('input', function() {
        this.value = formatPlateNumber(this.value);
        const isComplete = isValidPlateNumber(this.value);
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#plate-error').textContent = '';
        if (isComplete) {
          this.classList.add('input-valid');
        }
      });
      plateInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (val.length > 0 && !isValidPlateNumber(val)) {
          this.classList.add('input-error');
          document.querySelector('#plate-error').textContent = 'Format must be XX-12345 (2 letters, hyphen, 5 digits)';
        }
      });
    }

    // Real-time formatting + validation for body number (driver only) —
    // strips any non-digit characters and caps it at 5 digits as the user
    // types their own body number.
    if (bodyInput) {
      bodyInput.addEventListener('input', function() {
        this.value = formatBodyNumber(this.value);
        const isComplete = isValidBodyNumber(this.value);
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#body-error').textContent = '';
        if (isComplete) {
          this.classList.add('input-valid');
        }
      });
      bodyInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (val.length > 0 && !isValidBodyNumber(val)) {
          this.classList.add('input-error');
          document.querySelector('#body-error').textContent = 'Body number must be exactly 5 digits';
        }
      });
    }

    // Name extension select -> show/hide 'Other' input
    const extSelect = document.querySelector('#reg-ext');
    const extOtherInput = document.querySelector('#reg-ext-other');
    if (extSelect && extOtherInput) {
      const toggleExtOther = () => {
        if (extSelect.value === 'Other') {
          extOtherInput.style.display = '';
          extOtherInput.setAttribute('required', 'required');
        } else {
          extOtherInput.style.display = 'none';
          extOtherInput.removeAttribute('required');
          extOtherInput.value = '';
          document.querySelector('#ext-error').textContent = '';
        }
      };
      extSelect.addEventListener('change', toggleExtOther);
      toggleExtOther();
      // Live validation for the "Other" extension input
      extOtherInput.addEventListener('input', function() {
        const v = this.value.trim();
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#ext-error').textContent = '';
        if (v.length > 0) {
          this.classList.add('input-valid');
        }
      });
    }
 
    
 
    registerForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const fullNameInput = document.querySelector('#reg-fullname');
      const emailInput = document.querySelector('#reg-email');
      const contactInput = document.querySelector('#reg-contact');
      const passwordInput = document.querySelector('#reg-password');
      const roleSelect = document.querySelector('#reg-role');

      // One visible "Full name" box still has to fill student.first_name and
      // student.last_name, which are both NOT NULL. Splitting on the LAST space
      // keeps multi-word first names intact ("Rica Mae Flores" -> "Rica Mae" +
      // "Flores"), which is what Filipino names usually need.
      const fullNameRaw = fullNameInput ? fullNameInput.value.trim().replace(/\s+/g, ' ') : '';
      const lastSpace = fullNameRaw.lastIndexOf(' ');
      const firstNameRaw = lastSpace === -1 ? fullNameRaw : fullNameRaw.slice(0, lastSpace);
      const lastNameRaw = lastSpace === -1 ? '' : fullNameRaw.slice(lastSpace + 1);
      const email = emailInput.value.trim().toLowerCase();
      const contactNumber = contactInput ? contactInput.value.trim() : '';
      const password = passwordInput.value;
      const role = roleSelect ? roleSelect.value : 'passenger';
      const studentId = studentIdInput ? studentIdInput.value.trim() : '';
      const licenseNumber = licenseInput ? licenseInput.value.trim() : '';
      const plateNumber = plateInput ? plateInput.value.trim().toUpperCase() : '';
      const bodyNumber = bodyInput ? bodyInput.value.trim() : '';
      const extSelect = document.querySelector('#reg-ext');
      const extOtherInput = document.querySelector('#reg-ext-other');
      let extensionRaw = '';
      if (extSelect) {
        if (extSelect.value === 'Other') {
          extensionRaw = extOtherInput ? extOtherInput.value.trim() : '';
        } else {
          extensionRaw = extSelect.value.trim();
        }
      }
 
      let isValid = true;
 
      // Clear all error messages and states
      document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
      document.querySelectorAll('input, select').forEach(el => el.classList.remove('input-error', 'input-valid'));
 
      // Validate full name. isValidName already allows spaces, apostrophes and
      // hyphens, so it takes a whole name as-is. The surname check is what
      // matters here: a single word leaves last_name empty, and that column is
      // NOT NULL -- caught in the browser so it can't reach the server as a
      // confusing 500.
      const fullNameError = document.querySelector('#fullname-error');
      if (!fullNameRaw) {
        if (fullNameInput) fullNameInput.classList.add('input-error');
        if (fullNameError) fullNameError.textContent = 'Full name is required';
        isValid = false;
      } else if (!isValidName(fullNameRaw)) {
        if (fullNameInput) fullNameInput.classList.add('input-error');
        if (fullNameError) fullNameError.textContent = 'Name must contain only letters (minimum 2 characters)';
        isValid = false;
      } else if (!lastNameRaw) {
        if (fullNameInput) fullNameInput.classList.add('input-error');
        if (fullNameError) fullNameError.textContent = 'Please enter both your first name and surname';
        isValid = false;
      } else if (fullNameInput) {
        fullNameInput.classList.add('input-valid');
      }
 
      // Validate email (drivers don't have an email field — they log in by contact number)
      if (role === 'driver') {
        // no-op
      } else if (!email) {
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'Email is required';
        isValid = false;
      } else if (!isValidEmail(email)) {
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'Please enter a valid email (example@domain.com)';
        isValid = false;
      } else {
        emailInput.classList.add('input-valid');
      }

      // Validate contact number -- drivers only. It is a driver's login ID, so
      // it stays required for them; passengers no longer see the field at all,
      // and validating a hidden empty box would block every signup.
      if (role === 'driver') {
        if (!contactNumber) {
          document.querySelector('#contact-error').textContent = 'Contact number is required';
          if (contactInput) contactInput.classList.add('input-error');
          isValid = false;
        } else if (!isValidContactNumber(contactNumber)) {
          document.querySelector('#contact-error').textContent = 'Enter an 11-digit number starting with 09';
          if (contactInput) contactInput.classList.add('input-error');
          isValid = false;
        } else if (contactInput) {
          contactInput.classList.add('input-valid');
        }
      }

      // No student-ID validation any more -- the field is hidden and passengers
      // are members of the public. The server-side check this used to call
      // (/api/validate-student-id) was never implemented: it 404'd and the
      // helper returned true regardless, so nothing is actually lost here.
 
      // Validate driver's license number for drivers
      if (role === 'driver') {
        if (!licenseNumber) {
          document.querySelector('#license-error').textContent = "Driver's license number is required";
          if (licenseInput) licenseInput.classList.add('input-error');
          isValid = false;
        } else if (!isValidDriverLicenseNumber(licenseNumber)) {
          document.querySelector('#license-error').textContent = 'Format must be L##-##-###### (e.g. N01-23-456789)';
          if (licenseInput) licenseInput.classList.add('input-error');
          isValid = false;
        } else if (licenseInput) {
          licenseInput.classList.add('input-valid');
        }

        if (!plateNumber) {
          document.querySelector('#plate-error').textContent = 'Plate number is required';
          if (plateInput) plateInput.classList.add('input-error');
          isValid = false;
        } else if (!isValidPlateNumber(plateNumber)) {
          document.querySelector('#plate-error').textContent = 'Format must be XX-12345 (2 letters, hyphen, 5 digits)';
          if (plateInput) plateInput.classList.add('input-error');
          isValid = false;
        } else if (plateInput) {
          plateInput.classList.add('input-valid');
        }

        if (!bodyNumber) {
          document.querySelector('#body-error').textContent = 'Body number is required';
          if (bodyInput) bodyInput.classList.add('input-error');
          isValid = false;
        } else if (!isValidBodyNumber(bodyNumber)) {
          document.querySelector('#body-error').textContent = 'Body number must be exactly 5 digits';
          if (bodyInput) bodyInput.classList.add('input-error');
          isValid = false;
        } else if (bodyInput) {
          bodyInput.classList.add('input-valid');
        }

        const licenseFile = licenseFileInput && licenseFileInput.files ? licenseFileInput.files[0] : null;
        if (!licenseFile) {
          document.querySelector('#license-file-error').textContent = "Please upload a photo or scan of your driver's license";
          isValid = false;
        } else if (licenseFile.size > 5 * 1024 * 1024) {
          document.querySelector('#license-file-error').textContent = 'File is too large (max 5MB)';
          isValid = false;
        } else if (!['image/jpeg', 'image/png', 'application/pdf'].includes(licenseFile.type)) {
          document.querySelector('#license-file-error').textContent = 'Only JPG, PNG, or PDF files are allowed';
          isValid = false;
        }
      }

      // Validate extension 'Other' text when selected
      const extSelectVal = extSelect ? extSelect.value : '';
      if (extSelectVal === 'Other') {
        const otherVal = extOtherInput ? extOtherInput.value.trim() : '';
        if (!otherVal) {
          document.querySelector('#ext-error').textContent = 'Please enter a name extension or choose another option';
          if (extOtherInput) extOtherInput.classList.add('input-error');
          isValid = false;
        }
      }
 
      // Validate password (basic length requirement)
      if (!password) {
        document.querySelector('#password-error').textContent = 'Password is required';
        isValid = false;
      } else if (password.length < 8) {
        document.querySelector('#password-error').textContent = 'Password must be at least 8 characters';
        isValid = false;
      }
 
      // Confirm password
      const confirmPasswordInput = document.querySelector('#reg-password-confirm');
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
      if (!confirmPassword) {
        document.querySelector('#password-confirm-error').textContent = 'Please confirm your password';
        if (confirmPasswordInput) confirmPasswordInput.classList.add('input-error');
        isValid = false;
      } else if (confirmPassword !== password) {
        document.querySelector('#password-confirm-error').textContent = 'Passwords do not match';
        if (confirmPasswordInput) confirmPasswordInput.classList.add('input-error');
        isValid = false;
      }

      // Agree-to-terms checkbox
      const agreeTermsInput = document.querySelector('#reg-agree-terms');
      if (agreeTermsInput && !agreeTermsInput.checked) {
        document.querySelector('#agree-terms-error').textContent = 'Please read and agree to the Rules & Terms to continue.';
        isValid = false;
      }

      if (!isValid) return;

      // Passenger registration requires a verified email OTP before the
      // account is actually created. Drivers skip this entirely.
      if (role === 'passenger' && !otpVerified) {
        const otpErrorEl = document.querySelector('#otp-error');
        if (otpErrorEl) otpErrorEl.textContent = '';

        if (!otpSent) {
          try {
            await sendRegistrationOtp(email);
            otpSent = true;
            if (otpModalEmail) otpModalEmail.textContent = maskEmail(email);
            if (otpStatusEl) otpStatusEl.textContent = '';
            if (otpModal) otpModal.classList.remove('hidden');
            stopRegOtpCountdown();
            stopRegOtpCountdown = startOtpCountdown(document.querySelector('#otp-timer'), OTP_TTL_SECONDS);
          } catch (error) {
            showAuthFeedback('error', 'Could Not Send Code', error.message);
          }
          return;
        }

        const code = getOtpDigitValue('#reg-otp-digits');
        if (code.length !== 6) {
          if (otpErrorEl) otpErrorEl.textContent = 'Please enter the 6-digit code';
          return;
        }

        try {
          const verifyResponse = await fetch(`${OTP_API_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
          });
          const verifyData = await verifyResponse.json();
          if (!verifyResponse.ok) {
            if (otpErrorEl) otpErrorEl.textContent = verifyData.error || 'Incorrect code';
            return;
          }
          otpVerified = true;
          stopRegOtpCountdown();
          if (otpModal) otpModal.classList.add('hidden');
        } catch (error) {
          if (otpErrorEl) otpErrorEl.textContent = 'Could not verify code. Please try again.';
          return;
        }
        // Falls through to the registration POST below now that otpVerified is true.
      }

      // Format names
      const firstName = formatName(firstNameRaw);
      const lastName = formatName(lastNameRaw);
      const fullName = `${firstName} ${lastName}${extensionRaw ? ' ' + extensionRaw : ''}`.trim();
 
      // Build the request for the correct backend endpoint depending on role.
      // Passengers log in by email (stored as "username" in the backend).
      // Drivers log in by contact number instead — no email at all, so the
      // backend uses contact_number as their username.
      const apiUrl = role === 'driver'
        ? `${API_BASE_URL}/register/driver`
        : `${API_BASE_URL}/register/student`;

      // Driver registration includes a file, so it goes over multipart
      // FormData instead of JSON — the license upload middleware (multer)
      // needs multipart parsing, and the browser sets the correct
      // multipart boundary itself as long as we don't set Content-Type.
      let fetchOptions;
      if (role === 'driver') {
        const formData = new FormData();
        formData.append('password', password);
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('driver_license_no', licenseNumber);
        formData.append('plate_number', plateNumber);
        formData.append('body_number', bodyNumber);
        formData.append('contact_number', contactNumber);
        const licenseFile = licenseFileInput && licenseFileInput.files ? licenseFileInput.files[0] : null;
        if (licenseFile) formData.append('licenseDocument', licenseFile);
        fetchOptions = { method: 'POST', body: formData };
      } else {
        // student_number and contact_number are both nullable now and neither is
        // collected from a passenger, so they go up as null rather than ''. An
        // empty string would land in a UNIQUE column and make the SECOND
        // passenger to register fail on a duplicate key.
        const payload = {
          username: email,
          password: password,
          first_name: firstName,
          last_name: lastName,
          student_number: studentId || null,
          contact_number: contactNumber || null
        };
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        };
      }

      try {
        const response = await fetch(apiUrl, fetchOptions);

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 409 && /student id/i.test(data.error || '')) {
            if (studentIdInput) studentIdInput.classList.add('input-error');
            document.querySelector('#student-id-error').textContent = data.error;
            showAuthFeedback('error', 'Student ID Already Registered', data.error);
          } else if (response.status === 409 && /contact number/i.test(data.error || '')) {
            if (contactInput) contactInput.classList.add('input-error');
            document.querySelector('#contact-error').textContent = data.error;
            showAuthFeedback('error', 'Contact Number Already Registered', 'This contact number is already being used. Try logging in instead!');
          } else if (response.status === 409) {
            emailInput.classList.add('input-error');
            document.querySelector('#email-error').textContent = 'This email is already registered';
            showAuthFeedback('error', 'Email Already Registered', 'This email is already being used. Try logging in instead!');
          } else {
            showAuthFeedback('error', 'Registration Failed', data.error || 'Something went wrong. Please try again.');
          }
          return;
        }
 
        // A new driver isn't signed in: the account starts "Pending" and
        // can't log in until an admin verifies the license and approves it.
        // Leave them on the Login tab with their number already filled in,
        // ready for when that happens.
        if (role === 'driver') {
          const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
          if (loginTab) loginTab.click();
          const loginRole = document.querySelector('#login-role');
          if (loginRole) {
            loginRole.value = 'driver';
            loginRole.dispatchEvent(new Event('change'));
          }
          const loginContact = document.querySelector('#login-contact');
          if (loginContact) loginContact.value = contactNumber;
          registerForm.reset();
          showAuthFeedback('pending', 'Registration submitted',
            'Your account is now waiting for verification by the TODA admin, who will check your driver\'s license. You can log in once it has been approved.');
          return;
        }

        // A passenger goes straight to their dashboard. The redirect fires
        // immediately (no delay) rather than after the usual few-second
        // feedback pause — Edge's native "Save your password?" prompt can
        // appear during that window (this form has password fields) and
        // blocks the page from navigating away while it's showing, which
        // silently strands the user on this page. Navigating right away
        // beats the prompt to it.
        setStoredUser({ name: fullName, role, email, accountId: data.accountId, token: data.token }, true);
        redirectToDashboard(role);
 
      } catch (error) {
        console.error('Registration request failed', error);
        showAuthFeedback('error', 'Connection Error', 'Could not connect to the server. Please make sure the backend is running.');
      }
    });
  }
 
  // Attach login-password listener outside of registerForm block so it runs regardless
  const loginPasswordInputGlobal = document.querySelector('#login-password');
  if (loginPasswordInputGlobal) {
    loginPasswordInputGlobal.addEventListener('input', function() {
      const checks = checkPasswordStrength(this.value);
      const strengthBar = document.querySelector('#strength-bar-login');
      const strengthText = document.querySelector('#strength-text-login');
      const checklist = document.querySelector('#password-checklist-login');
 
      const setClass = (id, ok) => {
        const el = document.querySelector(id);
        if (!el) return;
        el.className = ok ? 'check-item valid' : 'check-item';
      };
 
      setClass('#check-lower-login', checks.hasLower);
      setClass('#check-upper-login', checks.hasUpper);
      setClass('#check-number-login', checks.hasNumber);
      setClass('#check-special-login', checks.hasSpecial);
      setClass('#check-length-login', checks.isLongEnough);
 
      const passCount = Object.values(checks).filter(Boolean).length;
      const strengthPercentage = (passCount / 5) * 100;
      const colors = ['#e5e7eb', '#dc2626', '#f97316', '#eab308', '#22c55e'];
      const labels = ['', '⚠️ Weak password', '⚠️ Fair password', '✓ Good password', '✓ Strong password!'];
 
      if (!strengthBar || !strengthText) return;
 
      if (this.value.length === 0) {
        strengthBar.style.width = '0%';
        strengthText.textContent = '';
        strengthBar.style.backgroundColor = colors[0];
        if (checklist) checklist.classList.remove('complete');
      } else {
        strengthBar.style.width = strengthPercentage + '%';
        strengthText.textContent = labels[passCount];
        strengthBar.style.backgroundColor = colors[passCount];
        if (checklist) {
          if (passCount === 5) checklist.classList.add('complete');
          else checklist.classList.remove('complete');
        }
      }
    });
  }
 
  // Attach register-password listener as well
  const regPasswordInput = document.querySelector('#reg-password');
  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', function() {
      const checks = checkPasswordStrength(this.value);
      const strengthBar = document.querySelector('#strength-bar');
      const strengthText = document.querySelector('#strength-text');
      const checklist = document.querySelector('#password-checklist');
 
      const setClass = (id, ok) => {
        const el = document.querySelector(id);
        if (!el) return;
        el.className = ok ? 'check-item valid' : 'check-item';
      };
 
      setClass('#check-lower', checks.hasLower);
      setClass('#check-upper', checks.hasUpper);
      setClass('#check-number', checks.hasNumber);
      setClass('#check-special', checks.hasSpecial);
      setClass('#check-length', checks.isLongEnough);
 
      const passCount = Object.values(checks).filter(Boolean).length;
      const colors = ['#e5e7eb', '#dc2626', '#f97316', '#eab308', '#22c55e'];
      const labels = ['', '⚠️ Weak password', '⚠️ Fair password', '✓ Good password', '✓ Strong password!'];
 
      if (!strengthBar || !strengthText) return;
 
      if (this.value.length === 0) {
        strengthBar.style.width = '0%';
        strengthText.textContent = '';
        strengthBar.style.backgroundColor = colors[0];
        if (checklist) checklist.classList.remove('complete');
      } else {
        strengthBar.style.width = (passCount / 5) * 100 + '%';
        strengthText.textContent = labels[passCount];
        strengthBar.style.backgroundColor = colors[passCount];
        if (checklist) {
          if (passCount === 5) checklist.classList.add('complete');
          else checklist.classList.remove('complete');
        }
      }
    });
  }
 
    
 
    // Passenger logs in by email; driver logs in by contact number (matches
    // the account.username value set at registration for each role). Swap
    // which identifier field is shown when the role select changes.
    const loginRoleSelect = document.querySelector('#login-role');
    const loginEmailField = document.querySelector('#login-email-field');
    const loginContactField = document.querySelector('#login-contact-field');
    const loginEmailInput = document.querySelector('#login-email');
    const loginContactInput = document.querySelector('#login-contact');
    const forgotPasswordRow = document.querySelector('#forgot-password-row');
    const toggleLoginIdentifier = () => {
      if (!loginRoleSelect) return;
      const isDriver = loginRoleSelect.value === 'driver';
      if (loginEmailField) loginEmailField.style.display = isDriver ? 'none' : '';
      if (loginContactField) loginContactField.style.display = isDriver ? '' : 'none';
      if (loginEmailInput) {
        if (isDriver) loginEmailInput.removeAttribute('required');
        else loginEmailInput.setAttribute('required', 'required');
      }
      // Password resets for drivers are handled manually by the admin, not
      // self-service by email — hide the passenger-only forgot-password link.
      if (forgotPasswordRow) forgotPasswordRow.style.display = isDriver ? 'none' : '';
    };
    if (loginRoleSelect) {
      loginRoleSelect.addEventListener('change', toggleLoginIdentifier);
      toggleLoginIdentifier();
    }

    if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const role = loginRoleSelect ? loginRoleSelect.value : 'passenger';
      const password = document.querySelector('#login-password').value.trim();
      const errorEl = document.querySelector('#login-error');
      if (errorEl) errorEl.textContent = '';

      const isDriver = role === 'driver';
      const identifier = isDriver
        ? (loginContactInput ? loginContactInput.value.trim() : '')
        : (loginEmailInput ? loginEmailInput.value.trim().toLowerCase() : '');

      if (!identifier || !password) {
        if (errorEl) errorEl.textContent = isDriver
          ? 'Please enter your contact number and password.'
          : 'Please enter email and password.';
        return;
      }

      if (isDriver && !isValidContactNumber(identifier)) {
        if (errorEl) errorEl.textContent = 'Enter an 11-digit number starting with 09';
        return;
      }

      const payload = JSON.stringify({ username: identifier, password: password });
      const headers = { 'Content-Type': 'application/json' };
      const endpoint = isDriver ? 'login/driver' : 'login/student';

      try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
          method: 'POST', headers, body: payload
        });
        const data = await response.json();

        if (!response.ok) {
          if (data.accountStatus === 'Pending') {
            // Kept so the re-upload form can prove it's the same driver
            // without asking for the number and password a second time.
            pendingDriverCredentials = { username: identifier, password };
            showAuthFeedback('pending', 'Waiting for verification', data.error);
            const reuploadBtn = document.querySelector('#modal-reupload-btn');
            if (reuploadBtn) reuploadBtn.classList.remove('hidden');
            return;
          }
          if (data.code === 'ACCOUNT_SUSPENDED') {
            showAuthFeedback('error', 'Account suspended', data.error);
            return;
          }
          if (errorEl) errorEl.textContent = data.error || 'Invalid credentials.';
          return;
        }

        // The backend stores passenger accounts with role "student" (it matches
        // the `student` table), but every dashboard/redirect check in this file
        // uses "passenger" as the role name. Normalize it here, once, right
        // where the server response comes in.
        const normalizedRole = data.user.role === 'student' ? 'passenger' : data.user.role;
        // Set BEFORE setStoredUser so it sees the current choice — an
        // unchecked box must overwrite a "true" left over from a previous
        // login, not just skip setting it.
        const rememberMe = document.querySelector('#login-remember-me');
        localStorage.setItem('rememberMe', rememberMe && rememberMe.checked ? 'true' : 'false');
        setStoredUser({ name: data.user.name, role: normalizedRole, email: data.user.username, accountId: data.user.accountId, accountStatus: data.user.accountStatus, token: data.token }, true);
        redirectToDashboard(normalizedRole);

      } catch (error) {
        console.error('Login request failed', error);
        if (errorEl) errorEl.textContent = 'Could not connect to the server. Please make sure the backend is running.';
      }
    });
}
}
 
// Live push updates (Socket.IO) replace the old setInterval polling —
// same render/fetch functions as before, just triggered by a server push
// instead of a timer. One connection per tab, kept in sync with login
// state by manageRealtimeConnection() below (called from refreshAuthState,
// so it "just works" on login, logout, and page load alike).
let realtimeSocket = null;
// Sole registered chat modal's own loadMessages(), if one is currently
// open — see openChatModal()/closeModal(). Lets the global 'chat:message'
// handler refresh whichever thread is on screen without tracking rideId.
let activeChatLoadMessages = null;

function manageRealtimeConnection() {
  if (!isAuthenticated()) {
    if (realtimeSocket) {
      realtimeSocket.disconnect();
      realtimeSocket = null;
    }
    return;
  }
  if (realtimeSocket) {
    // A back/forward-cache restore (common when navigating between pages)
    // kills the underlying connection but leaves this variable set — without
    // this check, refreshAuthState()'s pageshow-triggered call would see a
    // non-null realtimeSocket and skip reconnecting forever, silently
    // freezing that tab's live updates until a hard refresh.
    if (!realtimeSocket.connected) realtimeSocket.connect();
    return;
  }

  realtimeSocket = io(SOCKET_URL, { auth: { token: getStoredUser().token } });

  // Every one of these is the exact same function the old setInterval used
  // to call — each already no-ops via its own DOM/state check when it
  // doesn't apply to the current page or role, so one shared handler can
  // safely call all of them without re-deriving which page/role is active.
  realtimeSocket.on('ride:updated', function() {
    checkRideMilestones();
    renderPassengerRideStatus();
    renderDriverRideRequests();
    renderDriverMapTracking();
    syncDriverLocationSharing();
    syncDriverSelfLocationSharing();
    syncPassengerSelfLocationSharing();
    // These render the booking history, the driver's own counters, and the
    // admin dashboard. They were left out originally, so those screens only
    // ever showed whatever was true at page load — a completed ride or a new
    // booking wouldn't appear until someone manually refreshed.
    renderBookingsList();
    renderDriverDashboardStats();
    renderAdminBookings();
    renderAdminStats();
  });

  realtimeSocket.on('driver:location', function() {
    pollDriverLocation();
  });

  realtimeSocket.on('drivers:availability-changed', function() {
    renderAvailableDriversIndicator();
    renderAdminDriverManagement();
  });

  // Sent to admins only, whenever a passenger opens the app or has been
  // gone past the grace period — keeps the Active/Offline pills current.
  realtimeSocket.on('complaint:filed', function() {
    renderAdminComplaints();
  });

  realtimeSocket.on('passengers:presence-changed', function() {
    renderAdminPassengerManagement();
  });

  realtimeSocket.on('driver:account-status-changed', function() {
    syncDriverAccountStatus();
  });

  realtimeSocket.on('chat:message', function() {
    if (activeChatLoadMessages) activeChatLoadMessages();
    renderPassengerRideStatus();
    renderDriverRideRequests();
  });

  realtimeSocket.on('complaint:updated', function() {
    renderMyReports();
  });

  realtimeSocket.on('violation:issued', function() {
    renderMyViolations();
    renderAccountStanding();
  });

  realtimeSocket.on('account:suspended', function(payload) {
    forceSuspendedLogout(payload && payload.message);
  });

  // Every driver who could take the passenger's ride has declined it. The
  // ride is still open; they choose whether to keep waiting or cancel.
  realtimeSocket.on('ride:no-drivers', function(payload) {
    const rideId = payload && payload.rideId;
    if (!rideId || getStoredUser().role !== 'passenger') return;
    showActionPopup({
      tone: 'info',
      title: 'No driver has taken your ride yet',
      message: 'All available drivers have passed on this request. You can keep waiting for another driver to come online, or cancel it.',
      primaryLabel: 'Keep waiting',
      secondaryLabel: 'Cancel request',
      onSecondary: async () => {
        try {
          await updateRideStatusRemote(rideId, 'Cancelled');
          showRideFeedback('info', 'Ride cancelled', 'Your ride request has been cancelled.');
        } catch (error) {
          showRideFeedback('error', 'Could not cancel', error.message || 'Please try again.');
        }
        renderPassengerRideStatus();
      }
    });
  });

  realtimeSocket.on('loyalty:granted', function() {
    renderLoyaltyStatus();
    checkNewLoyaltyCertificate();
  });
}

// Bundles every function whose only job is to reflect the current
// sessionStorage auth state onto the page (nav links, banners, dashboards).
// Re-running these is always safe (they just re-check state and re-render),
// unlike the setup* functions below which attach event listeners and would
// double-fire if called twice on the same static elements.
function refreshAuthState() {
  manageRealtimeConnection();
  enforceDashboardAccess();
  hideAdminLinkForNonAdmin();
  updateDriverLinkVisibility();
  updatePassengerLinkVisibility();
  updateMarketingLinksVisibility();
  updateHomeCtaVisibility();
  showDriverApprovalBanner();
  renderAuthStatus();
  fillDashboardWelcome();
  renderPassengerRideStatus();
  renderDriverRideRequests();
  renderDriverDashboardStats();
  showAdminDashboardIfLoggedIn();
  renderAdminDriverManagement();
  renderAdminPassengerManagement();
  renderAdminBookings();
  renderAdminComplaints();
  renderAdminStats();
  renderAdminLoyaltyOverview();
  renderLoyaltyStatus();
  renderDriverRating();
  renderDriverRatingsFull();
  renderMyViolations();
  renderAccountStanding();
  renderMyReports();
  renderProfile();
  renderBookingsList();
  renderAvailableDriversIndicator();
  checkRideMilestones();
  syncDriverLocationSharing();
  syncDriverSelfLocationSharing();
  syncPassengerSelfLocationSharing();
  pollDriverLocation();
  renderDriverMapTracking();
}

document.addEventListener('DOMContentLoaded', function() {
  // Must run before refreshAuthState() below -- setupPassengerMap()/
  // setupDriverMap() are what actually create passengerMapInstance/
  // driverMapInstance, and every map-drawing function refreshAuthState()
  // calls (renderDriverMapTracking, pollDriverLocation,
  // syncPassengerSelfLocationSharing) silently no-ops if that instance
  // doesn't exist yet. Calling refreshAuthState() first meant the route
  // line/markers never drew on initial load or refresh -- they only ever
  // appeared later once a socket event happened to trigger a redraw.
  setupPassengerMap();
  setupDriverMap();
  refreshAuthState();
  setupLoginNavLink();
  setupViolationModal();
  showSuspendedNoticeIfAny();
  setupRideHistoryFilter();
  setupLicenseModal();
  setupAdminFareSettings();
  setupAdminPanelCollapse();
  setupLoyaltyHistoryToggle();
  setupLoyaltyRoleTabs();
  setupDashboardCardCollapse();
  setupProfilePanelCollapse();
  setupNavMenu();
  setupNavDrawerAccordion();
  setupBackToTop();
  setupHowItWorksPage();
  setupHowItWorksFares();
  setupFooterReportLink();
  setupHeroBookButton();
  setupGettingStartedPage();
  highlightActiveNav();
  setupScrollReveal();
  setupAuthForm();
  setupPasswordToggles();
  setupReuploadLicenseModal();
  setupAdminLoginForm();
  setupLogoutButtons();
  setupCertificateDownload();
  setupPassengerRideRequestForm();
  setupRideTypeToggle();
  setupOthersDropoff();
  setupPlaceSuggestions('dropoff');
  setupPlaceSuggestions('pickup');
  setupFareEstimate();
  setupRideAlerts();
  checkNewLoyaltyCertificate();
  checkDriverApprovalWelcome();
  if (window.location.hash === '#loyalty-card') openLoyaltyCard();
  setupProfileForm();
  setupChangePasswordForm();
  setupAvailabilityToggle();
  setupAvailabilityIndicatorClick();
  setupAccountStandingToggle();
  setupRulesLegendFilter();

  // Live updates for both roles now arrive via Socket.IO (see
  // manageRealtimeConnection(), wired into refreshAuthState() above) —
  // ride status, driver location, chat, availability, and driver account
  // approval all push instead of poll. Still worth one immediate check at
  // load for whichever of these applies right now, same as before.
  if (getStoredUser().role === 'driver') {
    syncDriverAccountStatus();
  }
});

// Chrome/Edge can restore a page from the "back/forward cache" (a frozen
// snapshot) instead of re-running the whole page load — when that happens,
// DOMContentLoaded does NOT fire again, so nav links/dashboards can go
// stale if the user logged in/out on another page and then hit Back.
// `pageshow` fires in both cases; `event.persisted` tells us it was a
// bfcache restore, so we only need to refresh state, not re-attach listeners.
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    refreshAuthState();
  }
});

// A cold first visit (e.g. tapping a link from Google's in-app browser)
// paints before the two web fonts (Google Fonts + Fontshare) finish
// loading. Some mobile browsers snapshot "does this page scroll?" at that
// first paint and don't re-check it once the fonts swap in and the page
// grows taller — leaving it stuck non-scrollable until some other DOM
// change (e.g. opening the avatar dropdown) forces a recheck. Nudging the
// body's height after everything (fonts included, via document.fonts)
// has finished loading forces that recheck without any visible change.
window.addEventListener('load', function() {
  function nudgeScrollRecalc() {
    const h = document.body.offsetHeight;
    document.body.style.minHeight = (h + 1) + 'px';
    requestAnimationFrame(function() {
      document.body.style.minHeight = '';
    });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(nudgeScrollRecalc);
  } else {
    nudgeScrollRecalc();
  }
});

