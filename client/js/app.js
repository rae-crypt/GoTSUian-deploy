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
  const revealItems = document.querySelectorAll('.feature-card, .step-card, .support-card, .testimonial-card');
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
 
function getStoredUser() {
  const rawUser = sessionStorage.getItem('authUser');
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

function setStoredUser(user) {
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
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  refreshAuthState();
}

function getAuthHeaders() {
  const token = getStoredUser().token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function clearStoredUser() {
  sessionStorage.removeItem('authUser');
  sessionStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
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
          <a class="nav-user-dropdown-dashboard" href="#">Booking</a>
          <a href="index.html">Home</a>
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

    // Admin has no profile page — leave the header un-clickable for them.
    const headerLink = menu.querySelector('.nav-user-dropdown-header');
    if (profileHref !== '#') {
      headerLink.href = profileHref;
    } else {
      headerLink.removeAttribute('href');
    }

    const dashboardLink = menu.querySelector('.nav-user-dropdown-dashboard');
    dashboardLink.href = dashboardHref;
    dashboardLink.textContent = user.role === 'admin' ? 'Dashboard' : 'Booking';
    dashboardLink.style.display = dashboardHref !== '#' ? '' : 'none';
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

function redirectBookingIfAuthenticated() {
  // booking.html is a logged-out landing/teaser page ("Sign in / Register").
  // Without this, an already-logged-in user landing here (via the home page,
  // a bookmark, or the browser Back button) sees a sign-in prompt again
  // instead of being sent to the dashboard they're already signed into.
  if (document.body.getAttribute('data-page') !== 'booking') return;
  if (!isAuthenticated()) return;
  redirectToDashboard(getStoredUser().role);
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

// booking.html redirects an already-authenticated visitor straight back to
// their own dashboard (see redirectBookingIfAuthenticated), so once logged
// in, "Booking" just points to the same place "Driver"/"Passenger" already
// do — hide it to avoid a link that visibly goes nowhere new.
function updateBookingLinkVisibility() {
  const bookingLink = document.querySelector('.nav-links a[data-page="booking"]');
  if (!bookingLink) return;
  if (isAuthenticated()) {
    bookingLink.classList.add('hidden');
  } else {
    bookingLink.classList.remove('hidden');
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

  if (authenticated && isDriverOrPassenger) {
    loginLink.classList.add('hidden');
    return;
  }
  loginLink.classList.remove('hidden');

  const label = loginLink.querySelector('span');
  const text = authenticated ? 'Logout' : 'Login';
  if (label) {
    label.textContent = text;
  } else {
    loginLink.textContent = text;
  }
}

function setupLoginNavLink() {
  const loginLink = document.querySelector('.nav-links a[data-page="auth"]');
  if (!loginLink) return;

  loginLink.addEventListener('click', function(event) {
    if (isAuthenticated()) {
      event.preventDefault();
      clearStoredUser();
      window.location.href = 'auth.html';
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

      setStoredUser({ name: data.user.name, role: data.user.role, email: data.user.username, token: data.token });
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
 
  if (isAuthenticated() && user.role === 'admin') {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
  } else {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
}

// index.html's nav-cta has a static "Sign up" link — hide it once someone
// browses back to the home page already logged in (the avatar badge next to
// it covers account access instead). Safe no-op on every page without
// #cta-signup.
function updateHomeCtaVisibility() {
  const signupLink = document.querySelector('#cta-signup');
  if (!signupLink) return;
  signupLink.style.display = isAuthenticated() ? 'none' : '';
}

// LOYALTY / REWARDS — only present on passenger-rewards.html, so this is a
// safe no-op on every other page (all the elements it looks for won't exist).
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

  const { completedRides, threshold, eligible } = data;
  const percent = Math.min(100, Math.round((completedRides / threshold) * 100));
  const role = getStoredUser().role;
  const title = role === 'driver' ? 'Loyal Driver' : 'Loyal Passenger';

  document.querySelector('#loyalty-current').textContent = completedRides;
  document.querySelector('#loyalty-threshold').textContent = threshold;
  document.querySelector('#loyalty-progress-fill').style.width = `${percent}%`;

  const messageEl = document.querySelector('#loyalty-message');
  messageEl.classList.remove('eligible', 'in-progress');
  if (eligible) {
    messageEl.textContent = `🏆 Congratulations! You are now a ${title}.`;
    messageEl.classList.add('eligible');
  } else {
    const remaining = threshold - completedRides;
    messageEl.textContent = `${remaining} more completed ride${remaining === 1 ? '' : 's'} to become a ${title}.`;
    messageEl.classList.add('in-progress');
  }

  const certificateEl = document.querySelector('#loyalty-certificate');
  if (certificateEl) {
    if (eligible) {
      const user = getStoredUser();
      const nameEl = certificateEl.querySelector('#certificate-name');
      const countEl = certificateEl.querySelector('#certificate-count');
      const titleEl = certificateEl.querySelector('#certificate-title');
      const dateEl = certificateEl.querySelector('#certificate-date');
      if (nameEl) nameEl.textContent = user.name || 'GoTSUian Member';
      if (countEl) countEl.textContent = completedRides;
      if (titleEl) titleEl.textContent = title;
      if (dateEl) dateEl.textContent = `Awarded ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      certificateEl.style.display = 'block';
    } else {
      certificateEl.style.display = 'none';
    }
  }

  loadingEl.style.display = 'none';
  detailsEl.style.display = 'block';
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
 
// PASSENGER MAP — only present on passenger.html, so this is a safe no-op
// everywhere else. Static markers for now (the two fixed campus points);
// GPS tracking gets layered on top of this once the map itself works.
let passengerMapInstance = null;
let driverLocationMarker = null;

// Keeps both maps locked to the Tarlac area — without this, a user can
// zoom/pan all the way out to a world view, which is disorienting for a
// system that only ever serves two fixed points a few km apart.
const TARLAC_BOUNDS = [[15.35, 120.45], [15.65, 120.75]];

function setupPassengerMap() {
  const mapEl = document.querySelector('#map');
  if (!mapEl || typeof L === 'undefined') return;

  passengerMapInstance = L.map('map', {
    minZoom: 12,
    maxBounds: TARLAC_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView([15.494, 120.583], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(passengerMapInstance);

  L.marker([15.485196, 120.587386]).addTo(passengerMapInstance).bindPopup('Main Campus');
  L.marker([15.502741, 120.578814]).addTo(passengerMapInstance).bindPopup('San Isidro Campus');
}

// Polls for the assigned driver's live position while there's an active
// ride, and moves (or creates/removes) a marker on top of the static campus
// pins. Only present on passenger.html — safe no-op everywhere else.
let driverRouteLine = null;
let driverTrackedRideId = null;

function clearDriverTracking() {
  if (driverLocationMarker) {
    passengerMapInstance.removeLayer(driverLocationMarker);
    driverLocationMarker = null;
  }
  if (driverRouteLine) {
    passengerMapInstance.removeLayer(driverRouteLine);
    driverRouteLine = null;
  }
  driverRouteFull = null;
  driverTrackedRideId = null;
}

// Both of our routes only ever run between the same two fixed points, so we
// can tell direction from the ride's own pickup/dropoff text instead of
// asking a routing API which way to go.
function getRouteForRide(ride) {
  const pickupIsSanIsidro = (ride.pickup_location || '').includes('San Isidro');
  return pickupIsSanIsidro ? ROUTE_SAN_ISIDRO_TO_MAIN : ROUTE_MAIN_TO_SAN_ISIDRO;
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

let driverRouteFull = null;

async function pollDriverLocation() {
  if (!passengerMapInstance) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'passenger') return;

  const rides = await fetchMyRides();
  const activeRide = rides.find(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (!activeRide) {
    if (driverTrackedRideId !== null) clearDriverTracking();
    return;
  }

  // A new ride (different ride_id) means a fresh trip — wipe any leftover
  // marker/route from a previous ride instead of leaving it on the map.
  if (driverTrackedRideId !== null && driverTrackedRideId !== activeRide.ride_id) {
    clearDriverTracking();
  }

  if (driverTrackedRideId !== activeRide.ride_id) {
    driverTrackedRideId = activeRide.ride_id;
    driverRouteFull = getRouteForRide(activeRide);
    driverRouteLine = L.polyline(driverRouteFull, {
      color: '#7f1d1d', weight: 5, opacity: 0.75, lineCap: 'round', lineJoin: 'round'
    }).addTo(passengerMapInstance);
  }

  try {
    const res = await fetch(`${RIDES_API_URL}/${activeRide.ride_id}/driver-location`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (data.lat == null || data.lng == null) return;

    const point = [data.lat, data.lng];

    if (driverRouteFull && driverRouteLine) {
      const nearestIndex = findNearestRouteIndex(driverRouteFull, point);
      driverRouteLine.setLatLngs(driverRouteFull.slice(nearestIndex));
    }

    if (!driverLocationMarker) {
      const driverIcon = L.divIcon({ className: 'driver-location-icon', html: '<span class="driver-location-badge">🛺</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
      driverLocationMarker = L.marker(point, { icon: driverIcon, zIndexOffset: 1000 }).addTo(passengerMapInstance).bindPopup('Your driver');
    } else {
      driverLocationMarker.setLatLng(point);
    }
  } catch (error) {
    console.warn('Unable to fetch driver location', error);
  }
}

// DRIVER'S OWN MAP — mirrors the passenger-side map: static campus markers
// plus, while there's an active ride, the same shrinking route line and a
// marker for the driver's own live GPS fix. Only present on driver.html —
// safe no-op everywhere else.
let driverMapInstance = null;
let driverMapMarker = null;
let driverMapRouteLine = null;
let driverMapRouteFull = null;
let driverMapTrackedRideId = null;
let lastKnownDriverPosition = null;

function setupDriverMap() {
  const mapEl = document.querySelector('#driver-map');
  if (!mapEl || typeof L === 'undefined') return;

  driverMapInstance = L.map('driver-map', {
    minZoom: 12,
    maxBounds: TARLAC_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView([15.494, 120.583], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(driverMapInstance);

  L.marker([15.485196, 120.587386]).addTo(driverMapInstance).bindPopup('Main Campus');
  L.marker([15.502741, 120.578814]).addTo(driverMapInstance).bindPopup('San Isidro Campus');
}

function clearDriverMapTracking() {
  if (driverMapMarker) {
    driverMapInstance.removeLayer(driverMapMarker);
    driverMapMarker = null;
  }
  if (driverMapRouteLine) {
    driverMapInstance.removeLayer(driverMapRouteLine);
    driverMapRouteLine = null;
  }
  driverMapRouteFull = null;
  driverMapTrackedRideId = null;
}

// Draws the driver's progress on their own map: while an active ride
// exists, shows the route line (shrinking as they advance, same as what
// the passenger sees) plus a marker at the driver's last known GPS fix.
// Runs on the same polling cadence as the location-sharing sync.
async function renderDriverMapTracking() {
  if (!driverMapInstance) return;
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  const rides = await fetchDriverRides();
  const activeRide = rides.find(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));

  if (!activeRide) {
    if (driverMapTrackedRideId !== null) clearDriverMapTracking();
    return;
  }

  if (driverMapTrackedRideId !== null && driverMapTrackedRideId !== activeRide.ride_id) {
    clearDriverMapTracking();
  }

  if (driverMapTrackedRideId !== activeRide.ride_id) {
    driverMapTrackedRideId = activeRide.ride_id;
    driverMapRouteFull = getRouteForRide(activeRide);
    driverMapRouteLine = L.polyline(driverMapRouteFull, {
      color: '#7f1d1d', weight: 5, opacity: 0.75, lineCap: 'round', lineJoin: 'round'
    }).addTo(driverMapInstance);
  }

  if (!lastKnownDriverPosition) return;
  const point = lastKnownDriverPosition;

  if (driverMapRouteFull && driverMapRouteLine) {
    const nearestIndex = findNearestRouteIndex(driverMapRouteFull, point);
    driverMapRouteLine.setLatLngs(driverMapRouteFull.slice(nearestIndex));
  }

  if (!driverMapMarker) {
    const driverIcon = L.divIcon({ className: 'driver-location-icon', html: '<span class="driver-location-badge">🛺</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
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

async function renderAdminDriverManagement() {
  const tbody = document.querySelector('#admin-drivers-tbody');
  if (!tbody) return;

  const drivers = await fetchAdminDrivers();

  if (!drivers.length) {
    tbody.innerHTML = '<tr><td colspan="4">No drivers registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = drivers.map(driver => {
    const actions = driver.account_status === 'Pending'
      ? `<button type="button" class="btn-primary" data-action="approve-driver" data-driver-id="${driver.driver_id}">Approve</button>
         <button type="button" class="btn-secondary" data-action="reject-driver" data-driver-id="${driver.driver_id}">Reject</button>`
      : '—';
    return `
      <tr>
        <td>${escapeHtml(driver.first_name + ' ' + driver.last_name)}</td>
        <td>${escapeHtml(driver.contact_number || '—')}</td>
        <td>${escapeHtml(driver.account_status)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-action="approve-driver"]').forEach(button => {
    button.addEventListener('click', async function() {
      const driverId = this.getAttribute('data-driver-id');
      try {
        await updateDriverStatusRemote(driverId, 'Active');
        renderAdminDriverManagement();
      } catch (error) {
        alert(error.message || 'Could not approve driver');
      }
    });
  });

  tbody.querySelectorAll('[data-action="reject-driver"]').forEach(button => {
    button.addEventListener('click', async function() {
      const driverId = this.getAttribute('data-driver-id');
      if (!confirm('Reject this driver application?')) return;
      try {
        await updateDriverStatusRemote(driverId, 'Rejected');
        renderAdminDriverManagement();
      } catch (error) {
        alert(error.message || 'Could not reject driver');
      }
    });
  });
}

// ADMIN — passenger management table, only present on admin.html.
async function renderAdminPassengerManagement() {
  const tbody = document.querySelector('#admin-passengers-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/passengers`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const passengers = data.passengers || [];

    if (!passengers.length) {
      tbody.innerHTML = '<tr><td colspan="4">No passengers registered yet.</td></tr>';
      return;
    }

    tbody.innerHTML = passengers.map(p => {
      const lastBooking = p.last_booking ? new Date(p.last_booking).toLocaleDateString() : '—';
      const status = p.ride_count > 0 ? 'Active' : 'No bookings yet';
      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.ride_count}</td>
          <td>${escapeHtml(lastBooking)}</td>
          <td>${escapeHtml(status)}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.warn('Unable to fetch passengers', error);
  }
}

// ADMIN — all-bookings audit table, only present on admin.html.
async function renderAdminBookings() {
  const tbody = document.querySelector('#admin-bookings-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${ADMIN_API_URL}/bookings`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const bookings = data.bookings || [];

    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="7">No bookings yet.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(b => {
      const statusConfig = getRideStatusConfig(b.status);
      const fareText = b.fare != null ? `₱${Number(b.fare).toFixed(0)}` : '—';
      return `
        <tr>
          <td>${escapeHtml(b.passenger_name)}</td>
          <td>${escapeHtml(b.driver_name || '—')}</td>
          <td>${escapeHtml(b.pickup_location)} → ${escapeHtml(b.dropoff_location)}</td>
          <td>${escapeHtml(b.ride_type)}</td>
          <td>${fareText}</td>
          <td><span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span></td>
          <td>${new Date(b.created_at).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.warn('Unable to fetch bookings', error);
  }
}

function fillDashboardWelcome() {
  const welcomeName = document.querySelector('[data-dashboard-welcome]');
  if (!welcomeName) return;
  const user = getStoredUser();
  const displayName = user.name || user.role || 'User';
  welcomeName.textContent = displayName;
}
 
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
 
function showRideFeedback(type, title, message) {
  const existing = document.querySelector('[data-ride-feedback]');
  if (existing) existing.remove();
 
  const feedback = document.createElement('div');
  feedback.setAttribute('data-ride-feedback', '');
  feedback.style.position = 'fixed';
  feedback.style.right = '1rem';
  feedback.style.bottom = '1rem';
  feedback.style.zIndex = '1200';
  feedback.style.maxWidth = '320px';
  feedback.style.padding = '0.95rem 1rem';
  feedback.style.borderRadius = '14px';
  feedback.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.18)';
  feedback.style.background = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#dbeafe';
  feedback.style.color = type === 'error' ? '#991b1b' : type === 'success' ? '#166534' : '#1d4ed8';
  feedback.style.transform = 'translateY(12px)';
  feedback.style.opacity = '0';
  feedback.style.transition = 'all 180ms ease';
  feedback.innerHTML = `
    <div style="font-weight:700; margin-bottom:0.25rem;">${escapeHtml(title)}</div>
    <div style="font-size:0.95rem; line-height:1.4;">${escapeHtml(message)}</div>
  `;
 
  document.body.appendChild(feedback);
  window.setTimeout(() => {
    feedback.style.opacity = '1';
    feedback.style.transform = 'translateY(0)';
  }, 10);
 
  window.setTimeout(() => {
    feedback.style.opacity = '0';
    feedback.style.transform = 'translateY(12px)';
    window.setTimeout(() => feedback.remove(), 180);
  }, 2800);
}
 
function getRideLifecycleSteps(status) {
  const steps = ['Pending', 'Accepted', 'Picked Up', 'In Progress', 'Completed'];
  const statusIndex = steps.indexOf(status);
 
  return steps.map((step, index) => ({
    label: step,
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

const RIDES_API_URL = 'http://localhost:3000/api/rides';
const ADMIN_API_URL = 'http://localhost:3000/api/admin';
const PROFILE_API_URL = 'http://localhost:3000/api/profile';
const REVIEWS_API_URL = 'http://localhost:3000/api/reviews';

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

// DRIVER's own "I'm on shift" switch — only present on driver.html, and
// only wired up if the driver role is logged in, so this is a safe no-op
// everywhere else.
function setupAvailabilityToggle() {
  const toggleBtn = document.querySelector('#availability-switch');
  const label = document.querySelector('#availability-label');
  if (!toggleBtn || !label) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') return;

  function updateUI(isOnline) {
    toggleBtn.classList.toggle('is-on', isOnline);
    toggleBtn.setAttribute('aria-pressed', String(isOnline));
    label.textContent = isOnline ? 'Online — accepting rides' : 'Offline';
  }

  toggleBtn.addEventListener('click', async () => {
    const nextState = !toggleBtn.classList.contains('is-on');
    toggleBtn.disabled = true;
    try {
      const res = await fetch(`${RIDES_API_URL}/driver/availability`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_online: nextState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update availability');
      updateUI(data.is_online);
    } catch (error) {
      showRideFeedback('error', 'Could not update', error.message || 'Please try again.');
    } finally {
      toggleBtn.disabled = false;
    }
  });

  fetch(`${RIDES_API_URL}/driver/availability`, { headers: getAuthHeaders() })
    .then(res => res.ok ? res.json() : null)
    .then(data => { if (data) updateUI(data.is_online); })
    .catch(error => console.warn('Unable to fetch availability', error));
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
      text.textContent = 'No drivers online right now — requests may take a bit longer.';
    }
  } catch (error) {
    console.warn('Unable to fetch available drivers count', error);
  }
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

    const pickupLocation = document.querySelector('#pickup-location').value;
    const dropoffLocation = document.querySelector('#dropoff-location').value;
    const rideType = document.querySelector('#ride-type').value;
    const scheduleSelect = document.querySelector('#ride-schedule');
    const scheduleMinutes = scheduleSelect ? parseInt(scheduleSelect.value, 10) : 0;
    const scheduledAt = scheduleMinutes > 0 ? toMySQLDateTime(new Date(Date.now() + scheduleMinutes * 60000)) : null;
    const routeError = document.querySelector('#route-error');
    if (routeError) routeError.textContent = '';

    if (!pickupLocation || !dropoffLocation) {
      if (routeError) routeError.textContent = 'Please select both a pickup and a drop-off point.';
      return;
    }

    if (pickupLocation === dropoffLocation) {
      if (routeError) routeError.textContent = 'Pickup and drop-off must be different campuses.';
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await createRideRequest({
        passenger_account_id: user.accountId,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        ride_type: rideType,
        scheduled_at: scheduledAt
      });

      form.reset();
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
    Failed: { label: 'Failed', description: 'The ride could not be completed.', tone: 'danger' }
  };
 
  return configs[status] || { label: status || 'Unknown', description: 'Status update received.', tone: 'warning' };
}
 
function getNextRideStatusOptions(currentStatus) {
  if (currentStatus === 'Pending') return ['Accepted', 'Cancelled'];
  if (currentStatus === 'Accepted') return ['Picked Up', 'Cancelled'];
  if (currentStatus === 'Picked Up') return ['In Progress', 'Completed', 'Cancelled'];
  if (currentStatus === 'In Progress') return ['Completed', 'Failed'];
  return [];
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
    return;
  }

  const rides = await fetchMyRides();
  const activeRide = rides.find(ride => !['Completed', 'Cancelled', 'Failed'].includes(ride.status)) || null;

  if (!activeRide) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'block';
  const createdAt = new Date(activeRide.created_at).toLocaleString();
  const updatedAt = new Date(activeRide.updated_at || activeRide.created_at).toLocaleString();
  const driverName = activeRide.driver_name || 'Awaiting confirmation';
  const statusConfig = getRideStatusConfig(activeRide.status);
  const canCancel = !['Completed', 'Cancelled', 'Failed'].includes(activeRide.status);
  const fareText = activeRide.fare != null
    ? `₱${Number(activeRide.fare).toFixed(0)}`
    : 'Calculating — waiting for more students to join';
  const scheduleText = activeRide.scheduled_at
    ? `Scheduled for ${new Date(activeRide.scheduled_at).toLocaleString()}`
    : 'Requested for now';

  const progressSteps = getRideLifecycleSteps(activeRide.status)
    .map(step => `
      <div class="ride-progress-step${step.active ? ' is-active' : ''}">
        <span class="ride-progress-dot${step.complete ? ' is-complete' : step.active ? ' is-active' : ''}"></span>
        <span class="ride-progress-label">${escapeHtml(step.label)}</span>
      </div>
    `)
    .join('');
  const nextStepText = activeRide.status === 'Pending'
    ? (activeRide.ride_type === 'Shared'
      ? 'Waiting for the tricycle to fill up, or for a driver to depart early.'
      : 'Waiting for a driver to accept your request.')
    : activeRide.status === 'Accepted'
      ? 'Your driver is on the way to your pickup point.'
      : activeRide.status === 'Picked Up'
        ? 'The trip is underway and the driver is heading to your destination.'
        : activeRide.status === 'In Progress'
          ? 'You are on your way to your destination.'
          : activeRide.status === 'Completed'
            ? 'The ride has been completed successfully.'
            : 'This ride has reached a terminal state.';

  container.innerHTML = `
    <div class="ride-status-head">
      <div class="ride-status-summary">
        <h4>${escapeHtml(activeRide.pickup_location)} <span class="ride-route-arrow">→</span> ${escapeHtml(activeRide.dropoff_location)}</h4>
        <div class="ride-meta">
          <span><strong>Ride type:</strong> ${escapeHtml(activeRide.ride_type)}</span>
          <span><strong>Driver:</strong> ${escapeHtml(driverName)}</span>
          ${activeRide.driver_contact ? `<span><strong>Driver contact:</strong> ${escapeHtml(activeRide.driver_contact)}</span>` : ''}
          <span><strong>Fare:</strong> ${escapeHtml(fareText)}</span>
        </div>
        <div class="ride-timestamps">
          <small>${escapeHtml(scheduleText)}</small>
          <small>Requested ${escapeHtml(createdAt)}</small>
          <small>Last updated ${escapeHtml(updatedAt)}</small>
        </div>
      </div>
      <span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span>
    </div>

    <div class="ride-status-detail">
      <p class="ride-description">${escapeHtml(statusConfig.description)}</p>
      <p class="ride-next-step">${escapeHtml(nextStepText)}</p>
    </div>

    <div class="ride-progress">
      ${progressSteps}
    </div>

    <div class="ride-actions">
      ${canCancel ? `<button type="button" class="btn-secondary-outline" data-action="cancel-request" data-ride-id="${activeRide.ride_id}">Cancel request</button>` : ''}
    </div>
  `;

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
}

// RIDE MILESTONE POPUPS — surfaces a full-screen moment when the passenger's
// ride hits a key transition (driver on the way, picked up, arrived at
// destination), instead of the ride silently vanishing from the dashboard
// the moment it's marked Completed. Each milestone only shows once per
// ride+status, tracked in sessionStorage so it doesn't reappear on every
// refresh or poll.
const RIDE_MILESTONES = {
  Accepted: {
    icon: '🛺',
    title: 'Your driver is on the way!',
    message: 'Be sure to be at your pickup point — this helps your driver find you.'
  },
  'Picked Up': {
    icon: '🙋',
    title: "You're on board!",
    message: "Enjoy your ride — you're on the way to your destination."
  },
  Completed: {
    icon: '🏁',
    title: 'You have arrived at your destination!',
    message: "See you on your next trip. Don't forget to pay your driver."
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

  const seenKey = `ride-milestone-${latest.ride_id}-${latest.status}`;
  if (sessionStorage.getItem(seenKey)) return;
  sessionStorage.setItem(seenKey, 'shown');

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

async function renderBookingsList() {
  const loading = document.querySelector('#bookings-loading');
  const emptyState = document.querySelector('#bookings-empty');
  const list = document.querySelector('#bookings-list');
  if (!loading || !emptyState || !list) return;

  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'passenger' && user.role !== 'driver')) return;

  const isDriver = user.role === 'driver';
  const rides = await (isDriver ? fetchDriverRides() : fetchMyRides());
  loading.style.display = 'none';

  if (!rides.length) {
    emptyState.style.display = 'flex';
    list.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = rides.map(ride => {
    const statusConfig = getRideStatusConfig(ride.status);
    const fareText = ride.fare != null ? `₱${Number(ride.fare).toFixed(0)}` : 'Calculating';
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
    return `
      <article class="booking-item">
        <div>
          <p class="booking-route">${escapeHtml(ride.pickup_location)} <span class="ride-route-arrow">→</span> ${escapeHtml(ride.dropoff_location)}</p>
          <div class="booking-meta">
            <span>${escapeHtml(ride.ride_type)}</span>
            <span>${escapeHtml(otherPartyLabel)}: ${escapeHtml(otherPartyName)}</span>
            <span>Requested ${escapeHtml(requestedAt)}</span>
          </div>
          ${reviewBlock}
        </div>
        <div class="booking-meta" style="align-items:center; gap:14px;">
          <span class="booking-fare">${escapeHtml(fareText)}</span>
          <span class="ride-badge tone-${statusConfig.tone}">${escapeHtml(statusConfig.label)}</span>
        </div>
      </article>
    `;
  }).join('');

  setupReviewPrompts(list);
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
          <span>Fare: ₱${Number(ride.fare || 60).toFixed(0)}</span>
          <span>${new Date(ride.created_at).toLocaleString()}</span>
        </div>
        <div class="driver-card-actions">
          <button type="button" class="btn-primary" data-action="accept-ride" data-ride-id="${ride.ride_id}">Accept</button>
          <button type="button" class="btn-secondary-outline" data-action="decline-ride" data-ride-id="${ride.ride_id}">Decline</button>
        </div>
      </article>
    `;
  }

  const riderCount = group.riders.length;
  const fareGuess = riderCount >= 4 ? 20 : riderCount === 3 ? 25 : riderCount === 2 ? 30 : 60;
  const names = group.riders.map(r => escapeHtml(r.passenger_name || 'Passenger')).join(', ');
  const anchorRideId = group.riders[0].ride_id;

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
        <span>Fare if accepted now: ₱${fareGuess}/student</span>
        <span>${names}</span>
      </div>
      <p class="driver-card-description">${riderCount < 4 ? 'Wait for more students, or accept now to depart with the current group.' : 'Tricycle is full and ready to depart.'}</p>
      <div class="driver-card-actions">
        <button type="button" class="btn-primary" data-action="accept-ride" data-ride-id="${anchorRideId}">Accept${riderCount < 4 ? ' & depart now' : ''}</button>
      </div>
    </article>
  `;
}

function renderActiveRideCard(group) {
  const anchor = group.riders[0];
  const statusConfig = getRideStatusConfig(anchor.status);
  const names = group.riders.map(r => escapeHtml(r.passenger_name || 'Passenger')).join(', ');
  const nextStatusButtons = getNextRideStatusOptions(anchor.status)
    .map(nextStatus => `<button type="button" class="btn-secondary-outline" data-action="advance-status" data-ride-id="${anchor.ride_id}" data-next-status="${nextStatus}">${escapeHtml(nextStatus)}</button>`)
    .join('');

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
        <span>Fare: ₱${Number(anchor.fare || 0).toFixed(0)}/student</span>
      </div>
      <p class="driver-card-description">${escapeHtml(statusConfig.description)}</p>
      <div class="driver-card-actions">
        ${nextStatusButtons}
      </div>
    </article>
  `;
}

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
        showRideFeedback('success', 'Ride accepted', result.fare ? `Trip assigned to you — fare locked at ₱${result.fare}/student.` : 'The trip is now assigned to you.');
        renderPassengerRideStatus();
        renderDriverRideRequests();
        renderDriverDashboardStats();
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
        await updateRideStatusRemote(rideId, 'Cancelled');
        showRideFeedback('info', 'Ride declined', 'The request was declined and removed from your queue.');
        renderDriverRideRequests();
        renderDriverDashboardStats();
      } catch (error) {
        showRideFeedback('error', 'Could not decline', error.message || 'Please try again.');
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
  const activeRides = driverRides.filter(r => ['Accepted', 'Picked Up', 'In Progress'].includes(r.status));
  const completedRides = driverRides.filter(r => r.status === 'Completed');
  const pendingRideCount = pendingGroups.reduce((sum, g) => sum + (g.type === 'shared' ? g.riders.length : 1), 0);
  const earnings = completedRides.reduce((sum, r) => sum + Number(r.fare || 0), 0);

  if (todayCount) todayCount.textContent = String(activeRides.length + completedRides.length);
  if (pendingCount) pendingCount.textContent = String(pendingRideCount);
  if (earningsBox) earningsBox.textContent = `₱${earnings.toFixed(0)}`;
  if (completedCount) completedCount.textContent = String(completedRides.length);
}
 
function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      // Best-effort: take a driver off the "available" count as soon as they
      // log out, so passengers don't see a stale online driver who's gone.
      // Fired before clearStoredUser() wipes the token this call needs.
      if (getStoredUser().role === 'driver') {
        fetch(`${RIDES_API_URL}/driver/availability`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ is_online: false })
        }).catch(() => {});
      }
      clearStoredUser();
      window.location.href = 'auth.html';
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
 
function isValidEmail(value) {
  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isValidContactNumber(value) {
  // Philippine mobile format: 09XXXXXXXXX (11 digits, starts with 09)
  return /^09\d{9}$/.test(value);
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
 
async function validateStudentIdServer(id) {
  // Local preview runs from a static server, so skip the backend check there to avoid noisy errors.
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    return true;
  }
 
  try {
    const res = await fetch('/api/validate-student-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: id })
    });
    if (!res.ok) return true;
    const data = await res.json();
    return Boolean(data && data.valid);
  } catch (e) {
    console.warn('Student ID server validation failed', e);
    return true;
  }
}
 
 
function showAuthFeedback(type, title, message) {
  const modal = document.querySelector('#auth-modal');
  const modalIcon = document.querySelector('#modal-icon');
  const modalTitle = document.querySelector('#modal-title');
  const modalMessage = document.querySelector('#modal-message');
  const modalRedirectText = document.querySelector('#modal-redirect-text');
  const progressBar = document.querySelector('#modal-progress-bar');
  const modalContent = document.querySelector('.auth-modal-content');
 
  if (type === 'success') {
    modalIcon.textContent = '✓';
    modalIcon.className = 'auth-modal-icon';
    modalTitle.textContent = title || '🎉 Welcome!';
    modalMessage.textContent = message || 'Your account has been created successfully.';
    modalRedirectText.textContent = 'Redirecting to your dashboard...';
    modalRedirectText.style.display = 'block';
  } else if (type === 'error') {
    modalIcon.textContent = '!';
    modalIcon.className = 'auth-modal-icon error';
    modalTitle.textContent = 'Oops!';
    modalTitle.style.color = '#dc2626';
    if (modalContent) modalContent.classList.add('error');
    modalMessage.textContent = message || 'Something went wrong. Please try again.';
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
const API_BASE_URL = 'http://localhost:3000/api/auth';
 
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
  }
 
  if (registerForm) {
    const fnameInput = document.querySelector('#reg-fname');
    const lnameInput = document.querySelector('#reg-lname');
    const emailInput = document.querySelector('#reg-email');
    const contactInput = document.querySelector('#reg-contact');
    const passwordInput = document.querySelector('#reg-password');
    const roleSelect = document.querySelector('#reg-role');
    const studentSection = document.querySelector('#reg-student-section');
    const studentIdInput = document.querySelector('#reg-student-id');
    const driverSection = document.querySelector('#reg-driver-section');
    const licenseInput = document.querySelector('#reg-license');
 
    // Real-time validation for first name
    if (fnameInput) {
      fnameInput.addEventListener('input', function() {
        const sanitized = sanitizeName(this.value.trim());
        const isEmpty = this.value.trim().length === 0;
        const isValid = !isEmpty && isValidName(this.value.trim());
        
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#fname-error').textContent = '';
        
        if (!isEmpty && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#fname-error').textContent = 'Only letters allowed (minimum 2 characters)';
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
 
    // Real-time validation for last name
    if (lnameInput) {
      lnameInput.addEventListener('input', function() {
        const sanitized = sanitizeName(this.value.trim());
        const isEmpty = this.value.trim().length === 0;
        const isValid = !isEmpty && isValidName(this.value.trim());
        
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#lname-error').textContent = '';
        
        if (!isEmpty && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#lname-error').textContent = 'Only letters allowed (minimum 2 characters)';
        } else if (isValid) {
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

    // Real-time validation for contact number
    if (contactInput) {
      contactInput.addEventListener('input', function() {
        const isEmpty = this.value.trim().length === 0;
        const isValid = !isEmpty && isValidContactNumber(this.value.trim());

        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#contact-error').textContent = '';

        if (!isEmpty && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#contact-error').textContent = 'Enter an 11-digit number starting with 09';
        } else if (isValid) {
          this.classList.add('input-valid');
        }
      });
    }

    // Toggle student ID visibility based on role
    const toggleStudentSection = () => {
      if (!studentSection || !roleSelect) return;
      if (roleSelect.value === 'passenger') {
        studentSection.style.display = '';
        if (studentIdInput) studentIdInput.setAttribute('required', 'required');
      } else {
        studentSection.style.display = 'none';
        if (studentIdInput) {
          studentIdInput.value = '';
          document.querySelector('#student-id-error').textContent = '';
          studentIdInput.classList.remove('input-error', 'input-valid');
          studentIdInput.removeAttribute('required');
        }
      }
    };
 
    if (roleSelect) roleSelect.addEventListener('change', toggleStudentSection);
    toggleStudentSection();

    // Toggle driver's license field visibility based on role
    const toggleDriverSection = () => {
      if (!driverSection || !roleSelect) return;
      if (roleSelect.value === 'driver') {
        driverSection.style.display = '';
        if (licenseInput) licenseInput.setAttribute('required', 'required');
      } else {
        driverSection.style.display = 'none';
        if (licenseInput) {
          licenseInput.value = '';
          document.querySelector('#license-error').textContent = '';
          licenseInput.classList.remove('input-error', 'input-valid');
          licenseInput.removeAttribute('required');
        }
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

    // Real-time validation for driver's license number (driver only)
    if (licenseInput) {
      licenseInput.addEventListener('input', function() {
        const val = this.value.trim();
        const isValid = val.length >= 5;
        this.classList.remove('input-error', 'input-valid');
        document.querySelector('#license-error').textContent = '';
        if (val.length > 0 && !isValid) {
          this.classList.add('input-error');
          document.querySelector('#license-error').textContent = 'Enter a valid license number';
        } else if (isValid) {
          this.classList.add('input-valid');
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
      const fnameInput = document.querySelector('#reg-fname');
      const lnameInput = document.querySelector('#reg-lname');
      const emailInput = document.querySelector('#reg-email');
      const contactInput = document.querySelector('#reg-contact');
      const passwordInput = document.querySelector('#reg-password');
      const roleSelect = document.querySelector('#reg-role');

      const firstNameRaw = fnameInput.value.trim();
      const lastNameRaw = lnameInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const contactNumber = contactInput ? contactInput.value.trim() : '';
      const password = passwordInput.value;
      const role = roleSelect ? roleSelect.value : 'passenger';
      const studentId = studentIdInput ? studentIdInput.value.trim() : '';
      const licenseNumber = licenseInput ? licenseInput.value.trim() : '';
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
 
      // Validate first name
      if (!firstNameRaw) {
        fnameInput.classList.add('input-error');
        document.querySelector('#fname-error').textContent = 'First name is required';
        isValid = false;
      } else if (!isValidName(firstNameRaw)) {
        fnameInput.classList.add('input-error');
        document.querySelector('#fname-error').textContent = 'First name must contain only letters (minimum 2 characters)';
        isValid = false;
      } else {
        fnameInput.classList.add('input-valid');
      }
 
      // Validate last name
      if (!lastNameRaw) {
        lnameInput.classList.add('input-error');
        document.querySelector('#lname-error').textContent = 'Last name is required';
        isValid = false;
      } else if (!isValidName(lastNameRaw)) {
        lnameInput.classList.add('input-error');
        document.querySelector('#lname-error').textContent = 'Last name must contain only letters (minimum 2 characters)';
        isValid = false;
      } else {
        lnameInput.classList.add('input-valid');
      }
 
      // Validate email
      if (!email) {
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'Email is required';
        isValid = false;
      } else if (!isValidEmail(email)) {
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'Please enter a valid email (example@domain.com)';
        isValid = false;
      } else if (role === 'passenger' && !email.endsWith('@student.tsu.edu.ph')) {
        // Passengers must register using the official school email
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'Passengers must use a valid @student.tsu.edu.ph email';
        isValid = false;
      } else {
        emailInput.classList.add('input-valid');
      }

      // Validate contact number
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

      // Validate student ID for passengers
      if (role === 'passenger') {
        if (!studentId) {
          document.querySelector('#student-id-error').textContent = 'Student ID is required for passengers';
          if (studentIdInput) studentIdInput.classList.add('input-error');
          isValid = false;
        } else if (!/^\d{10}$/.test(studentId)) {
          document.querySelector('#student-id-error').textContent = 'Student ID must be 10 digits';
          if (studentIdInput) studentIdInput.classList.add('input-error');
          isValid = false;
        } else {
          // Optionally perform server-side check to verify the student ID belongs to a student
          try {
            const serverOk = await validateStudentIdServer(studentId);
            if (!serverOk) {
              document.querySelector('#student-id-error').textContent = 'Student ID not recognized';
              if (studentIdInput) studentIdInput.classList.add('input-error');
              isValid = false;
            }
          } catch (e) {
            // On network failure, allow registration but log the issue
            console.warn('Student ID server validation failed, proceeding locally', e);
          }
        }
      }
 
      // Validate driver's license number for drivers
      if (role === 'driver') {
        if (!licenseNumber) {
          document.querySelector('#license-error').textContent = "Driver's license number is required";
          if (licenseInput) licenseInput.classList.add('input-error');
          isValid = false;
        } else if (licenseNumber.length < 5) {
          document.querySelector('#license-error').textContent = 'Enter a valid license number';
          if (licenseInput) licenseInput.classList.add('input-error');
          isValid = false;
        } else if (licenseInput) {
          licenseInput.classList.add('input-valid');
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
 
      if (!isValid) return;
 
      // Format names
      const firstName = formatName(firstNameRaw);
      const lastName = formatName(lastNameRaw);
      const fullName = `${firstName} ${lastName}${extensionRaw ? ' ' + extensionRaw : ''}`.trim();
 
      // Build the request for the correct backend endpoint depending on role.
      // Note: the "email" field the user typed is stored as the "username"
      // in the backend, since the database schema (based on the ERD) uses
      // a username column rather than a separate email column.
      const apiUrl = role === 'driver'
        ? `${API_BASE_URL}/register/driver`
        : `${API_BASE_URL}/register/student`;
 
      const payload = role === 'driver'
        ? {
            username: email,
            password: password,
            first_name: firstName,
            last_name: lastName,
            driver_license_no: licenseNumber,
            contact_number: contactNumber
          }
        : {
            username: email,
            password: password,
            first_name: firstName,
            last_name: lastName,
            student_number: studentId,
            contact_number: contactNumber
          };
 
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
 
        const data = await response.json();
 
        if (!response.ok) {
          if (response.status === 409 && /student id/i.test(data.error || '')) {
            if (studentIdInput) studentIdInput.classList.add('input-error');
            document.querySelector('#student-id-error').textContent = data.error;
            showAuthFeedback('error', 'Student ID Already Registered', data.error);
          } else if (response.status === 409) {
            emailInput.classList.add('input-error');
            document.querySelector('#email-error').textContent = 'This email is already registered';
            showAuthFeedback('error', 'Email Already Registered', 'This email is already being used. Try logging in instead!');
          } else {
            showAuthFeedback('error', 'Registration Failed', data.error || 'Something went wrong. Please try again.');
          }
          return;
        }
 
        // Registered successfully in the database.
        // Drivers aren't allowed to log in yet — their account starts as
        // "Pending" until an admin verifies their license/MTOP/TODA
        // registration — so send them to the login tab instead of a
        // dashboard they can't actually use.
        if (role === 'driver') {
          showAuthFeedback(
            'success',
            `Thanks, ${firstName}!`,
            'Your driver account was created and is pending admin approval. You can log in once it has been verified.'
          );
          setTimeout(() => {
            hideAuthModal();
            const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
            if (loginTab) loginTab.click();
          }, 2500);
        } else {
          setStoredUser({ name: fullName, role, email, accountId: data.accountId, token: data.token });
          showAuthFeedback('success', `Welcome, ${firstName}!`, `Your ${role} account is ready. Let's get you started!`);
          setTimeout(() => {
            redirectToDashboard(role);
          }, 2500);
        }
 
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
 
    
 
    if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const email = document.querySelector('#login-email').value.trim().toLowerCase();
      const password = document.querySelector('#login-password').value.trim();
      const errorEl = document.querySelector('#login-error');
      if (errorEl) errorEl.textContent = '';

      if (!email || !password) {
        if (errorEl) errorEl.textContent = 'Please enter email and password.';
        return;
      }

      const payload = JSON.stringify({ username: email, password: password });
      const headers = { 'Content-Type': 'application/json' };
 
      try {
        // We don't ask the user to pick a role on this form, so we try each
        // role's login endpoint in turn: student first, then driver, then admin.
        let response = await fetch(`${API_BASE_URL}/login/student`, {
          method: 'POST', headers, body: payload
        });
        let data = await response.json();
 
        // A 403 means the username/password matched a real account but it's
        // blocked for another reason (e.g. a driver still pending admin
        // approval) — that's the definitive answer, so stop trying the next
        // role instead of masking it with the admin endpoint's 401 later.
        if (!response.ok && response.status !== 403) {
          response = await fetch(`${API_BASE_URL}/login/driver`, {
            method: 'POST', headers, body: payload
          });
          data = await response.json();
        }

        if (!response.ok && response.status !== 403) {
          response = await fetch(`${API_BASE_URL}/login/admin`, {
            method: 'POST', headers, body: payload
          });
          data = await response.json();
        }
 
        if (!response.ok) {
          if (errorEl) errorEl.textContent = data.error || 'Invalid email or password.';
          return;
        }

        // The backend stores passenger accounts with role "student" (it matches
        // the `student` table), but every dashboard/redirect check in this file
        // uses "passenger" as the role name. Normalize it here, once, right
        // where the server response comes in.
        const role = data.user.role === 'student' ? 'passenger' : data.user.role;
        setStoredUser({ name: data.user.name, role, email: data.user.username, accountId: data.user.accountId, accountStatus: data.user.accountStatus, token: data.token });
        redirectToDashboard(role);

      } catch (error) {
        console.error('Login request failed', error);
        if (errorEl) errorEl.textContent = 'Could not connect to the server. Please make sure the backend is running.';
      }
    });
}
}
 
// Bundles every function whose only job is to reflect the current
// sessionStorage auth state onto the page (nav links, banners, dashboards).
// Re-running these is always safe (they just re-check state and re-render),
// unlike the setup* functions below which attach event listeners and would
// double-fire if called twice on the same static elements.
function refreshAuthState() {
  enforceDashboardAccess();
  redirectBookingIfAuthenticated();
  hideAdminLinkForNonAdmin();
  updateDriverLinkVisibility();
  updateBookingLinkVisibility();
  updatePassengerLinkVisibility();
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
  renderAdminStats();
  renderLoyaltyStatus();
  renderDriverRating();
  renderProfile();
  renderBookingsList();
  renderAvailableDriversIndicator();
  checkRideMilestones();
  syncDriverLocationSharing();
  pollDriverLocation();
  renderDriverMapTracking();
}

document.addEventListener('DOMContentLoaded', function() {
  refreshAuthState();
  setupLoginNavLink();
  setupNavMenu();
  setupBackToTop();
  highlightActiveNav();
  setupAuthForm();
  setupAdminLoginForm();
  setupLogoutButtons();
  setupPassengerRideRequestForm();
  setupProfileForm();
  setupAvailabilityToggle();
  setupPassengerMap();
  setupDriverMap();

  // A passenger's ride status can change (driver accepts / arrives /
  // completes) while they're just sitting on the dashboard — poll every 15s
  // so the milestone popup shows up without needing a manual refresh.
  if (getStoredUser().role === 'passenger') {
    setInterval(checkRideMilestones, 15000);
    setInterval(pollDriverLocation, 7000);
  }

  // A driver's ride can go from "no active ride" to "just accepted one"
  // without a page reload — recheck periodically so location sharing turns
  // on/off promptly instead of only at the next full refresh.
  if (getStoredUser().role === 'driver') {
    setInterval(syncDriverLocationSharing, 10000);
    setInterval(renderDriverMapTracking, 7000);
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

