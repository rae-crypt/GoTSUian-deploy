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

function isStrongPassword(value) {
  const checks = checkPasswordStrength(value);
  return checks.hasLower && checks.hasUpper && checks.hasNumber && checks.hasSpecial && checks.isLongEnough;
}

function showAuthFeedback(type, title, message) {
  const modal = document.querySelector('#auth-modal');
  const modalIcon = document.querySelector('#modal-icon');
  const modalTitle = document.querySelector('#modal-title');
  const modalMessage = document.querySelector('#modal-message');
  const modalRedirectText = document.querySelector('#modal-redirect-text');
  const progressBar = document.querySelector('#modal-progress-bar');

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
      modal.classList.add('hidden');
    }, 2500);
  }
}

function hideAuthModal() {
  const modal = document.querySelector('#auth-modal');
  modal.classList.add('hidden');
}
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

    // Real-time password strength feedback
    if (passwordInput) {
      passwordInput.addEventListener('input', function() {
        const checks = checkPasswordStrength(this.value);
        const strengthBar = document.querySelector('#strength-bar');
        const strengthText = document.querySelector('#strength-text');
        const checklist = document.querySelector('.password-checklist');
        
        // Update checklist items with real-time feedback
        document.querySelector('#check-lower').className = checks.hasLower ? 'check-item valid' : 'check-item';
        document.querySelector('#check-upper').className = checks.hasUpper ? 'check-item valid' : 'check-item';
        document.querySelector('#check-number').className = checks.hasNumber ? 'check-item valid' : 'check-item';
        document.querySelector('#check-special').className = checks.hasSpecial ? 'check-item valid' : 'check-item';
        document.querySelector('#check-length').className = checks.isLongEnough ? 'check-item valid' : 'check-item';
        
        const passCount = Object.values(checks).filter(Boolean).length;
        const strengthPercentage = (passCount / 5) * 100;
        
        const colors = ['#e5e7eb', '#dc2626', '#f97316', '#eab308', '#22c55e'];
        const labels = ['', '⚠️ Weak password', '⚠️ Fair password', '✓ Good password', '✓ Strong password!'];
        
        if (this.value.length === 0) {
          strengthBar.style.width = '0%';
          strengthText.textContent = '';
          strengthBar.style.backgroundColor = colors[0];
          checklist.classList.remove('complete');
        } else {
          strengthBar.style.width = strengthPercentage + '%';
          strengthText.textContent = labels[passCount];
          strengthBar.style.backgroundColor = colors[passCount];
          
          if (passCount === 5) {
            checklist.classList.add('complete');
          } else {
            checklist.classList.remove('complete');
          }
        }
      });
    }

    registerForm.addEventListener('submit', function(event) {
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
      const role = roleSelect.value;

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

      // Validate password
      if (!password) {
        document.querySelector('#password-error').textContent = 'Password is required';
        isValid = false;
      } else if (!isStrongPassword(password)) {
        document.querySelector('#password-error').textContent = 'Please make sure your password meets all the requirements shown above';
        isValid = false;
      }

      if (!isValid) return;

      // Format names
      const firstName = formatName(firstNameRaw);
      const middleName = formatName(middleNameRaw);
      const lastName = formatName(lastNameRaw);
      const fullName = `${firstName} ${middleName} ${lastName}`;

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
      localStorage.setItem('userName', fullName);
      localStorage.setItem('userRole', role);
      localStorage.setItem('userEmail', email);

      // Show success feedback
      showAuthFeedback('success', `Welcome, ${firstName}!`, `Your ${role} account is ready. Let's get you started!`);

      // Redirect after feedback
      setTimeout(() => {
        redirectToDashboard(role);
      }, 2500);
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
  setupAuthForm();
  setupAdminLoginForm();
  setupLogoutButtons();
  fillDashboardWelcome();
  showAdminDashboardIfLoggedIn();
});