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
      email: ''
    };
  }

  try {
    const parsedUser = JSON.parse(rawUser);
    return {
      name: parsedUser.name || '',
      role: parsedUser.role || '',
      email: parsedUser.email || ''
    };
  } catch (error) {
    console.warn('Unable to read stored session user', error);
    return {
      name: '',
      role: '',
      email: ''
    };
  }
}

function setStoredUser(user) {
  const payload = {
    name: user.name || '',
    role: user.role || '',
    email: user.email || ''
  };

  sessionStorage.setItem('authUser', JSON.stringify(payload));
  sessionStorage.setItem('isAuthenticated', 'true');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  renderAuthStatus();
}

function clearStoredUser() {
  sessionStorage.removeItem('authUser');
  sessionStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  renderAuthStatus();
}

function renderAuthStatus() {
  const navCta = document.querySelector('.nav-cta');
  if (!navCta) return;

  const user = getStoredUser();
  const authenticated = isAuthenticated();
  let badge = navCta.querySelector('.nav-user-badge');

  if (authenticated && user.name) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-user-badge';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.marginRight = '0.75rem';
      badge.style.padding = '0.45rem 0.75rem';
      badge.style.borderRadius = '999px';
      badge.style.background = 'rgba(34, 197, 84, 0.14)';
      badge.style.color = '#166534';
      badge.style.fontSize = '0.9rem';
      badge.style.fontWeight = '600';
      badge.style.whiteSpace = 'nowrap';
      navCta.insertBefore(badge, navCta.firstChild);
    }
    badge.textContent = `Signed in as ${user.name}`;
    badge.style.display = 'inline-flex';
  } else if (badge) {
    badge.remove();
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

function setupAdminLoginForm() {
  const adminLoginForm = document.querySelector('#admin-login-form');
  if (!adminLoginForm) return;

  adminLoginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.querySelector('#admin-name').value.trim();
    const password = document.querySelector('#admin-password').value.trim();

    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'admin123';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setStoredUser({
        name: 'Administrator',
        role: 'admin',
        email: 'admin@gotsUian.local'
      });
      redirectToDashboard('admin');
    } else {
      alert('Invalid admin credentials');
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

function getRideRequests() {
  try {
    return JSON.parse(localStorage.getItem('gotsUianRideRequests') || '[]');
  } catch (error) {
    console.warn('Unable to read ride requests', error);
    return [];
  }
}

function saveRideRequests(requests) {
  localStorage.setItem('gotsUianRideRequests', JSON.stringify(requests));
}

function updateRideRequest(requestId, updates) {
  const requests = getRideRequests().map(request => {
    if (request.id !== requestId) return request;
    return {
      ...request,
      ...updates,
      updatedAt: updates.status ? new Date().toISOString() : request.updatedAt || request.createdAt
    };
  });
  saveRideRequests(requests);
  renderPassengerRideStatus();
  renderDriverRideRequests();
  renderDriverDashboardStats();
  return requests;
}

function setupPassengerRideRequestForm() {
  const form = document.querySelector('#ride-request-form');
  if (!form) return;

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    const user = getStoredUser();

    if (!isAuthenticated() || user.role !== 'passenger') {
      alert('Please log in to request a ride.');
      return;
    }

    const pickupLocation = document.querySelector('#pickup-location').value.trim();
    const dropoffLocation = document.querySelector('#dropoff-location').value.trim();
    const rideType = document.querySelector('#ride-type').value;
    const notes = document.querySelector('#ride-notes').value.trim();

    if (!pickupLocation || !dropoffLocation) {
      alert('Please enter both pickup and drop-off locations.');
      return;
    }

    const newRequest = {
      id: `ride-${Date.now()}`,
      passengerName: user.name || 'Passenger',
      passengerEmail: user.email,
      pickupLocation,
      dropoffLocation,
      rideType,
      notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const requests = getRideRequests();
    requests.unshift(newRequest);
    saveRideRequests(requests);
    form.reset();
    renderPassengerRideStatus();
    renderDriverRideRequests();
    renderDriverDashboardStats();
    showRideFeedback('success', 'Ride requested', 'Your trip request is now waiting for a driver.');
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

function renderPassengerRideStatus() {
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

  const requests = getRideRequests()
    .filter(request => request.passengerEmail === user.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const activeRequest = requests.find(request => !['Completed', 'Cancelled', 'Failed'].includes(request.status)) || null;

  if (!activeRequest) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'block';
  const createdAt = new Date(activeRequest.createdAt).toLocaleString();
  const updatedAt = new Date(activeRequest.updatedAt || activeRequest.createdAt).toLocaleString();
  const driverName = activeRequest.driverName || 'Awaiting confirmation';
  const statusConfig = getRideStatusConfig(activeRequest.status);
  const canCancel = !['Completed', 'Cancelled', 'Failed'].includes(activeRequest.status);
  const progressSteps = getRideLifecycleSteps(activeRequest.status)
    .map(step => `
      <div style="display:flex; align-items:center; gap:0.65rem; padding:0.45rem 0.6rem; border-radius:10px; background:${step.active ? '#e0f2fe' : '#f8fafc'}; color:${step.active ? '#0f172a' : '#64748b'};">
        <span style="width:0.7rem; height:0.7rem; border-radius:999px; background:${step.complete ? '#16a34a' : step.active ? '#2563eb' : '#cbd5e1'};"></span>
        <span style="font-weight:${step.active ? '700' : '500'};">${escapeHtml(step.label)}</span>
      </div>
    `)
    .join('');
  const nextStepText = activeRequest.status === 'Pending'
    ? 'Waiting for a driver to accept your request.'
    : activeRequest.status === 'Accepted'
      ? 'Your driver is on the way to your pickup point.'
      : activeRequest.status === 'Picked Up'
        ? 'The trip is underway and the driver is heading to your destination.'
        : activeRequest.status === 'In Progress'
          ? 'You are on your way to your destination.'
          : activeRequest.status === 'Completed'
            ? 'The ride has been completed successfully.'
            : 'This ride has reached a terminal state.';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:1rem; align-items:flex-start;">
      <div>
        <h4>${escapeHtml(statusConfig.label)}</h4>
        <p><strong>${escapeHtml(activeRequest.pickupLocation)}</strong> → <strong>${escapeHtml(activeRequest.dropoffLocation)}</strong></p>
        <p><strong>Ride type:</strong> ${escapeHtml(activeRequest.rideType)}</p>
        <p><strong>Driver:</strong> ${escapeHtml(driverName)}</p>
        <p><small>Requested ${escapeHtml(createdAt)}</small></p>
        <p><small>Last updated ${escapeHtml(updatedAt)}</small></p>
        <p>${escapeHtml(activeRequest.notes || 'No notes added.')}</p>
      </div>
      <span style="padding:0.35rem 0.7rem; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-weight:600;">${escapeHtml(statusConfig.label)}</span>
    </div>
    <div style="margin-top:1rem;">
      <p style="margin:0; color:#475569;">${escapeHtml(statusConfig.description)}</p>
      <p style="margin:0.5rem 0 0; color:#0f172a; font-weight:600;">${escapeHtml(nextStepText)}</p>
    </div>
    <div style="margin-top:1rem; display:grid; gap:0.5rem;">
      ${progressSteps}
    </div>
    <div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
      ${canCancel ? `<button type="button" class="btn-secondary-outline" data-action="cancel-request" data-request-id="${activeRequest.id}">Cancel request</button>` : ''}
    </div>
  `;

  const cancelButton = container.querySelector('[data-action="cancel-request"]');
  if (cancelButton) {
    cancelButton.addEventListener('click', function() {
      updateRideRequest(activeRequest.id, { status: 'Cancelled' });
      showRideFeedback('info', 'Ride cancelled', 'Your ride request has been cancelled.');
    });
  }
}

function renderDriverRideRequests() {
  const container = document.querySelector('#driver-ride-requests');
  if (!container) return;

  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'driver') {
    container.innerHTML = '<article class="dashboard-card"><p>Log in as a driver to view ride requests.</p></article>';
    return;
  }

  const requests = getRideRequests()
    .filter(request => ['Pending', 'Accepted', 'Picked Up', 'In Progress'].includes(request.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!requests.length) {
    container.innerHTML = '<article class="dashboard-card"><p>No active ride requests right now.</p></article>';
    return;
  }

  container.innerHTML = requests.map(request => {
    const statusConfig = getRideStatusConfig(request.status);
    const nextStatusButtons = getNextRideStatusOptions(request.status)
      .map(nextStatus => `<button type="button" class="btn-secondary-outline" data-action="advance-status" data-request-id="${request.id}" data-next-status="${nextStatus}">${escapeHtml(nextStatus)}</button>`)
      .join('');

    const pendingActions = request.status === 'Pending'
      ? `
        <button type="button" class="btn-primary" data-action="accept-request" data-request-id="${request.id}">Accept</button>
        <button type="button" class="btn-secondary-outline" data-action="decline-request" data-request-id="${request.id}">Decline</button>
      `
      : nextStatusButtons;

    return `
      <article class="driver-card">
        <div class="driver-card-header">
          <div>
            <h3>${escapeHtml(request.passengerName || 'Passenger')}</h3>
            <p>${escapeHtml(request.pickupLocation)} → ${escapeHtml(request.dropoffLocation)}</p>
          </div>
          <span style="padding:0.35rem 0.7rem; border-radius:999px; background:#dcfce7; color:#15803d; font-weight:600;">${escapeHtml(statusConfig.label)}</span>
        </div>
        <div class="driver-card-meta">
          <span>${escapeHtml(request.rideType)}</span>
          <span>${new Date(request.createdAt).toLocaleString()}</span>
        </div>
        <p>${escapeHtml(request.notes || 'No notes provided.')}</p>
        <p style="margin-top:0.6rem; color:#475569;">${escapeHtml(statusConfig.description)}</p>
        <div style="display:flex; gap:0.75rem; margin-top:1rem; flex-wrap:wrap;">
          ${pendingActions}
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-action="accept-request"]').forEach(button => {
    button.addEventListener('click', function() {
      const requestId = this.getAttribute('data-request-id');
      updateRideRequest(requestId, {
        status: 'Accepted',
        driverName: user.name || 'Driver'
      });
      showRideFeedback('success', 'Ride accepted', 'The trip is now assigned to you.');
    });
  });

  container.querySelectorAll('[data-action="decline-request"]').forEach(button => {
    button.addEventListener('click', function() {
      const requestId = this.getAttribute('data-request-id');
      updateRideRequest(requestId, { status: 'Cancelled' });
      showRideFeedback('info', 'Ride declined', 'The request was declined and removed from your queue.');
    });
  });

  container.querySelectorAll('[data-action="advance-status"]').forEach(button => {
    button.addEventListener('click', function() {
      const requestId = this.getAttribute('data-request-id');
      const nextStatus = this.getAttribute('data-next-status');
      updateRideRequest(requestId, {
        status: nextStatus,
        driverName: user.name || 'Driver'
      });
      showRideFeedback('success', 'Status updated', `The ride is now marked as ${nextStatus}.`);
    });
  });
}

function renderDriverDashboardStats() {
  const todayCount = document.querySelector('#driver-count-today');
  const pendingCount = document.querySelector('#driver-pending-count');
  const earningsBox = document.querySelector('#driver-earnings');
  const completedCount = document.querySelector('#driver-completed-count');

  if (!todayCount && !pendingCount && !earningsBox && !completedCount) return;

  const requests = getRideRequests();
  const activeRequests = requests.filter(request => ['Pending', 'Accepted', 'Picked Up', 'In Progress'].includes(request.status));
  const completedRequests = requests.filter(request => request.status === 'Completed');
  const pendingRequests = requests.filter(request => request.status === 'Pending');

  if (todayCount) todayCount.textContent = String(activeRequests.length + completedRequests.length);
  if (pendingCount) pendingCount.textContent = String(pendingRequests.length);
  if (earningsBox) earningsBox.textContent = `₱${completedRequests.length * 120}`;
  if (completedCount) completedCount.textContent = String(completedRequests.length);
}

function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      event.preventDefault();
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
  // Placeholder for server-side validation. Replace URL with your backend endpoint.
  // Returns `true` if server confirms ID is valid; returns true on network errors to avoid blocking registration.
  try {
    const res = await fetch('/api/validate-student-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: id })
    });
    if (!res.ok) return true; // don't block on server errors
    const data = await res.json();
    return data && data.valid;
  } catch (e) {
    console.warn('Student ID server validation failed', e);
    return true; // allow registration when server is unreachable
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
    const mnameInput = document.querySelector('#reg-mname');
    const lnameInput = document.querySelector('#reg-lname');
    const emailInput = document.querySelector('#reg-email');
    const passwordInput = document.querySelector('#reg-password');
    const roleSelect = document.querySelector('#reg-role');
    const studentSection = document.querySelector('#reg-student-section');
    const studentIdInput = document.querySelector('#reg-student-id');

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
      const mnameInput = document.querySelector('#reg-mname');
      const lnameInput = document.querySelector('#reg-lname');
      const emailInput = document.querySelector('#reg-email');
      const passwordInput = document.querySelector('#reg-password');
      const roleSelect = document.querySelector('#reg-role');

      const firstNameRaw = fnameInput.value.trim();
      const middleNameRaw = mnameInput.value.trim();
      const lastNameRaw = lnameInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      const role = roleSelect ? roleSelect.value : 'passenger';
      const studentId = studentIdInput ? studentIdInput.value.trim() : '';
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
      } else {
        emailInput.classList.add('input-valid');
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
      const middleName = middleNameRaw ? formatName(middleNameRaw) : '';
      const lastName = formatName(lastNameRaw);
      const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}${extensionRaw ? ' ' + extensionRaw : ''}`.trim();

      // Check if email already registered
      let users = JSON.parse(localStorage.getItem('gotsUianUsers') || '[]');
      if (users.some(u => u.email.toLowerCase() === email)) {
        emailInput.classList.add('input-error');
        document.querySelector('#email-error').textContent = 'This email is already registered';
        showAuthFeedback('error', 'Email Already Registered', 'This email is already being used. Try logging in instead!');
        return;
      }

      // Register user
      users.push({ name: fullName, email, password, role });
      localStorage.setItem('gotsUianUsers', JSON.stringify(users));
      setStoredUser({ name: fullName, role, email });

      // Show success feedback
      showAuthFeedback('success', `Welcome, ${firstName}!`, `Your ${role} account is ready. Let's get you started!`);

      // Redirect after feedback
      setTimeout(() => {
        redirectToDashboard(role);
      }, 2500);
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
    loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const email = document.querySelector('#login-email').value.trim().toLowerCase();
      const password = document.querySelector('#login-password').value.trim();

      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }

      let users = JSON.parse(localStorage.getItem('gotsUianUsers') || '[]');
      const user = users.find(u => u.email.toLowerCase() === email && u.password === password);

      if (!user) {
        alert('Invalid email or password');
        return;
      }

      setStoredUser({ name: user.name, role: user.role, email: user.email });
      redirectToDashboard(user.role);
    });
}
}

document.addEventListener('DOMContentLoaded', function() {
  enforceDashboardAccess();
  hideAdminLinkForNonAdmin();
  setupNavMenu();
  setupBackToTop();
  highlightActiveNav();
  setupAuthForm();
  setupAdminLoginForm();
  setupLogoutButtons();
  renderAuthStatus();
  fillDashboardWelcome();
  setupPassengerRideRequestForm();
  renderPassengerRideStatus();
  renderDriverRideRequests();
  renderDriverDashboardStats();
  showAdminDashboardIfLoggedIn();
});