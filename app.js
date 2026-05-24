// Mobile navigation toggle
function setupNavMenu() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('open');
    });

    document.addEventListener('click', function(event) {
      if (!navToggle.contains(event.target) && !navLinks.contains(event.target)) {
        navLinks.classList.remove('open');
      }
    });
  }
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

function getStoredUser() {
  return {
    name: localStorage.getItem('userName') || '',
    role: localStorage.getItem('userRole') || '',
    email: localStorage.getItem('userEmail') || ''
  };
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

  if (!user.role) {
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
  if (user.role !== 'admin') {
    adminLink.style.display = 'none';
  } else {
    adminLink.style.display = '';
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
      localStorage.setItem('userName', 'Administrator');
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('userEmail', 'admin@gotsUian.local');
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

  if (user.role === 'admin') {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
  } else {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
  }
}

function fillDashboardWelcome() {
  const welcomeName = document.querySelector('[data-dashboard-welcome]');
  if (!welcomeName) return;
  const user = getStoredUser();
  const displayName = user.name || user.role || 'User';
  welcomeName.textContent = displayName;
}

function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', function() {
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      window.location.href = 'auth.html';
    });
  });
}

function setupPasswordToggle() {
  const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      const input = document.querySelector(this.getAttribute('data-target'));
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      this.innerHTML = isPassword ? eyeOffIcon : eyeIcon;
      this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });
}

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
    registerForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const firstName = document.querySelector('#reg-fname').value.trim();
      const middleName = document.querySelector('#reg-mname').value.trim();
      const lastName = document.querySelector('#reg-lname').value.trim();
      const email = document.querySelector('#reg-email').value.trim();
      const password = document.querySelector('#reg-password').value.trim();
      const role = document.querySelector('#reg-role').value;

      const fullName = `${firstName} ${middleName} ${lastName}`;

      if (!firstName || !middleName || !lastName || !email || !password) {
        alert('Please fill in all fields');
        return;
      }

      let users = JSON.parse(localStorage.getItem('gotsUianUsers') || '[]');
      if (users.some(u => u.email === email)) {
        alert('Email already registered');
        return;
      }

      users.push({ name: fullName, email, password, role });
      localStorage.setItem('gotsUianUsers', JSON.stringify(users));

      localStorage.setItem('userName', fullName);
      localStorage.setItem('userRole', role);
      localStorage.setItem('userEmail', email);

      redirectToDashboard(role);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const email = document.querySelector('#login-email').value.trim();
      const password = document.querySelector('#login-password').value.trim();

      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }

      let users = JSON.parse(localStorage.getItem('gotsUianUsers') || '[]');
      const user = users.find(u => u.email === email && u.password === password);

      if (!user) {
        alert('Invalid email or password');
        return;
      }

      localStorage.setItem('userName', user.name);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userEmail', user.email);

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
  setupPasswordToggle();
  setupAuthForm();
  setupAdminLoginForm();
  setupLogoutButtons();
  fillDashboardWelcome();
  showAdminDashboardIfLoggedIn();
});