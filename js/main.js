/* =========================================================
   Longchase Enterprise Limited — site behaviors
   Small, dependency-free, reusable helpers.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- mobile nav toggle ---------- */
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');

  const closeNav = () => {
    mainNav.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // close the mobile menu after a link is chosen
  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));

  /* ---------- sticky header shadow on scroll ---------- */
  const header = document.getElementById('header');
  const applyHeaderShadow = () => {
    header.style.boxShadow = window.scrollY > 8 ? '0 4px 14px rgba(11,26,51,.08)' : 'none';
  };
  applyHeaderShadow();
  window.addEventListener('scroll', applyHeaderShadow, { passive: true });

  /* ---------- footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- contact form validation ---------- */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  const validators = {
    name: value => value.trim().length > 1 || 'Please enter your name.',
    email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Please enter a valid email address.',
    message: value => value.trim().length > 4 || 'Please add a short message.'
  };

  const showFieldError = (field, message) => {
    const row = field.closest('.form-row');
    const errorEl = document.getElementById(`${field.id}-error`);
    if (message) {
      row.classList.add('invalid');
      if (errorEl) errorEl.textContent = message;
    } else {
      row.classList.remove('invalid');
      if (errorEl) errorEl.textContent = '';
    }
  };

  const validateField = (field) => {
    const rule = validators[field.name];
    if (!rule) return true;
    const result = rule(field.value);
    showFieldError(field, result === true ? '' : result);
    return result === true;
  };

  ['name', 'email', 'message'].forEach(id => {
    const field = document.getElementById(id);
    field.addEventListener('blur', () => validateField(field));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');
    const messageField = document.getElementById('message');
    const submitBtn = form.querySelector('.form-submit');

    const isValid = [nameField, emailField, messageField]
      .map(validateField)
      .every(Boolean);

    if (!isValid) {
      status.textContent = 'Please fix the highlighted fields.';
      return;
    }

    const payload = {
      name: nameField.value.trim(),
      email: emailField.value.trim(),
      phone: phoneField.value.trim(),
      message: messageField.value.trim()
    };

    submitBtn.disabled = true;
    status.textContent = 'Sending…';

    try {
      // Preferred path: the Node/Express backend in /server, which
      // validates again server-side, stores the enquiry, and emails
      // it on if SMTP has been configured.
      const response = await fetch('https://longchase-entreprise.onrender.com/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        status.textContent = data.message || "Thanks, we've received your message.";
        form.reset();
      } else if (data.errors) {
        Object.entries(data.errors).forEach(([field, message]) => {
          const el = document.getElementById(field);
          if (el) showFieldError(el, message);
        });
        status.textContent = 'Please fix the highlighted fields.';
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err) {
      // Fallback path: no backend reachable — e.g. the site is being
      // opened as static files, or hosted somewhere without the
      // /server app running. Hand the message to the visitor's email
      // client instead, addressed and pre-filled.
      const subject = encodeURIComponent(`Website enquiry from ${payload.name}`);
      const bodyLines = [
        payload.message,
        '',
        `Name: ${payload.name}`,
        `Email: ${payload.email}`,
        payload.phone ? `Phone: ${payload.phone}` : null
      ].filter(Boolean);
      const body = encodeURIComponent(bodyLines.join('\n'));

      window.location.href = `mailto:info@longchase.co.ke?subject=${subject}&body=${body}`;
      status.textContent = 'Opening your email app to send this message…';
      form.reset();
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- active nav link on scroll ---------- */
  const sections = ['services', 'printing', 'why-us', 'contact']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const navLinks = Array.from(mainNav.querySelectorAll('a'));

  const setActiveLink = () => {
    const scrollPos = window.scrollY + 120;
    let currentId = null;
    sections.forEach(section => {
      if (section.offsetTop <= scrollPos) currentId = section.id;
    });
    navLinks.forEach(link => {
      link.style.color = link.getAttribute('href') === `#${currentId}` ? 'var(--gold-600)' : '';
    });
  };
  setActiveLink();
  window.addEventListener('scroll', setActiveLink, { passive: true });
});
