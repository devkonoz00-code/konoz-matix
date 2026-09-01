/**
 * MATIX secure sign-in experience.
 * Credentials are intentionally never displayed, prefilled, or persisted here.
 */
import { api } from '../js/api.js';
import { router } from '../js/router.js';
import { showToast, playSuccessChime, playConfirmBeep, playErrorTone, setupWebPushNotifications } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export function renderLogin(container) {
  const currentLang = localStorage.getItem('matix_lang') || 'ar';

  // Remove the legacy remembered identifier from older MATIX releases.
  localStorage.removeItem('matix_remember_email');

  container.innerHTML = `
    <main class="login-page-wrapper" aria-labelledby="login-page-title">
      <div class="login-orb login-orb-one" aria-hidden="true"></div>
      <div class="login-orb login-orb-two" aria-hidden="true"></div>

      <section class="login-master-card">
        <aside class="login-hero-pane" aria-label="MATIX platform overview">
          <div class="login-hero-grid" aria-hidden="true"></div>
          <div class="login-hero-glow" aria-hidden="true"></div>

          <div class="login-hero-content">
            <div class="login-hero-brand">
              <span class="login-hero-logo"><img src="./assets/logo.png" alt=""></span>
              <span>
                <strong>MATIX</strong>
                <small data-i18n="login_brand_subtitle">Material intelligence platform</small>
              </span>
            </div>

            <div class="login-hero-copy">
              <span class="login-hero-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                <span data-i18n="login_eyebrow">Secure organizational workspace</span>
              </span>
              <h1 class="login-hero-title" data-i18n="login_hero_title">Every material movement. One trusted record.</h1>
              <p class="login-hero-desc" data-i18n="login_hero_description">Coordinate warehouses, projects, requests, and field operations from one clear logistics workspace.</p>
            </div>

            <div class="login-capability-list" aria-label="Platform capabilities">
              <article class="login-capability-item">
                <span class="login-capability-number">01</span>
                <span>
                  <strong data-i18n="login_capability_ledger_title">Ledger-based inventory</strong>
                  <small data-i18n="login_capability_ledger_desc">Trace quantities and value across every location.</small>
                </span>
              </article>
              <article class="login-capability-item">
                <span class="login-capability-number">02</span>
                <span>
                  <strong data-i18n="login_capability_access_title">Controlled operations</strong>
                  <small data-i18n="login_capability_access_desc">Role-based workflows for accountable teams.</small>
                </span>
              </article>
              <article class="login-capability-item">
                <span class="login-capability-number">03</span>
                <span>
                  <strong data-i18n="login_capability_mobile_title">Built for the field</strong>
                  <small data-i18n="login_capability_mobile_desc">Responsive access with barcode and QR scanning.</small>
                </span>
              </article>
            </div>
          </div>

          <div class="login-hero-footer">
            <span data-i18n="login_hero_footer">Material tracking & project logistics</span>
            <span class="login-language-summary">AR&nbsp;&nbsp;•&nbsp;&nbsp;FR&nbsp;&nbsp;•&nbsp;&nbsp;EN</span>
          </div>
        </aside>

        <div class="login-form-pane">
          <div class="login-form-shell">
            <div class="login-form-top-bar">
              <div class="login-brand-group">
                <span class="login-brand-logo"><img src="./assets/logo.png" alt="MATIX"></span>
                <span class="login-brand-text">
                  <strong>MATIX</strong>
                  <small data-i18n="login_brand_subtitle">Material intelligence platform</small>
                </span>
              </div>

              <div class="login-lang-pill" role="group" aria-label="Language">
                <button type="button" class="login-lang-btn ${currentLang === 'ar' ? 'active' : ''}" data-lang="ar" lang="ar" aria-pressed="${currentLang === 'ar'}">ع</button>
                <button type="button" class="login-lang-btn ${currentLang === 'fr' ? 'active' : ''}" data-lang="fr" lang="fr" aria-pressed="${currentLang === 'fr'}">FR</button>
                <button type="button" class="login-lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" lang="en" aria-pressed="${currentLang === 'en'}">EN</button>
              </div>
            </div>

            <div class="login-mobile-intro">
              <span class="login-mobile-kicker" data-i18n="login_eyebrow">Secure organizational workspace</span>
              <p data-i18n="login_mobile_intro">A single workspace for materials, projects, and field logistics.</p>
            </div>

            <header class="login-form-header">
              <span class="login-form-kicker" data-i18n="login_welcome_label">Welcome back</span>
              <h2 id="login-page-title" data-i18n="msg_login_title">Sign in to MATIX</h2>
              <p data-i18n="msg_login_subtitle">Use your organization credentials to continue.</p>
            </header>

            <form id="login-form" novalidate>
              <div class="login-field-group">
                <label class="login-field-label" for="login-email" data-i18n="lbl_email">Email address</label>
                <div class="login-input-wrapper">
                  <span class="login-input-icon" aria-hidden="true">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m22 6-10 7L2 6"/></svg>
                  </span>
                  <input
                    type="email"
                    id="login-email"
                    class="login-input-field"
                    data-i18n-placeholder="login_email_placeholder"
                    placeholder="name@company.com"
                    required
                    autocomplete="username"
                    inputmode="email"
                    autocapitalize="none"
                    spellcheck="false"
                    dir="ltr"
                  >
                </div>
              </div>

              <div class="login-field-group">
                <div class="login-label-row">
                  <label class="login-field-label" for="login-password" data-i18n="lbl_password">Password</label>
                  <span id="caps-warning" class="login-caps-warning" data-i18n="login_caps_warning">Caps Lock is on</span>
                </div>
                <div class="login-input-wrapper">
                  <span class="login-input-icon" aria-hidden="true">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>
                  </span>
                  <input
                    type="password"
                    id="login-password"
                    class="login-input-field login-password-field"
                    data-i18n-placeholder="login_password_placeholder"
                    placeholder="Enter your password"
                    required
                    autocomplete="current-password"
                    dir="ltr"
                  >
                  <button type="button" class="login-input-action" id="btn-toggle-password" data-i18n-title="login_toggle_password" title="Show or hide password" aria-label="Show or hide password" aria-pressed="false">
                    <svg id="eye-icon-show" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                    <svg id="eye-icon-hide" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" hidden><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.1 3.1M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.5"/></svg>
                  </button>
                </div>
              </div>

              <div id="login-inline-alert" class="login-inline-alert" role="alert" aria-live="polite"></div>

              <button type="submit" class="login-submit-btn" id="btn-submit-login">
                <span class="login-spinner" id="login-spinner" aria-hidden="true"></span>
                <span id="btn-login-text" data-i18n="btn_signin">Sign in securely</span>
                <svg id="btn-login-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
              </button>
            </form>

            <div class="login-access-note">
              <span class="login-access-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
              </span>
              <span>
                <strong data-i18n="login_access_title">Authorized access only</strong>
                <small data-i18n="login_access_description">Account details are never displayed or prefilled on this page.</small>
              </span>
            </div>
          </div>

          <footer class="login-form-footer">
            <span data-i18n="login_security_note">Private organizational access</span>
            <span aria-hidden="true">•</span>
            <span>MATIX</span>
          </footer>
        </div>
      </section>
    </main>
  `;

  i18n.translateDOM(container);
  translatePlaceholders(container);

  container.querySelectorAll('.login-lang-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang');
      playConfirmBeep();
      await i18n.setLanguage(lang);
      renderLogin(container);
    });
  });

  const form = container.querySelector('#login-form');
  const emailInput = container.querySelector('#login-email');
  const passInput = container.querySelector('#login-password');
  const togglePassBtn = container.querySelector('#btn-toggle-password');
  const eyeShow = container.querySelector('#eye-icon-show');
  const eyeHide = container.querySelector('#eye-icon-hide');
  const capsWarning = container.querySelector('#caps-warning');
  const inlineAlert = container.querySelector('#login-inline-alert');
  const submitBtn = container.querySelector('#btn-submit-login');
  const submitBtnText = container.querySelector('#btn-login-text');
  const submitBtnArrow = container.querySelector('#btn-login-arrow');
  const spinner = container.querySelector('#login-spinner');

  togglePassBtn?.addEventListener('click', () => {
    playConfirmBeep();
    const showPassword = passInput.type === 'password';
    passInput.type = showPassword ? 'text' : 'password';
    eyeShow.hidden = showPassword;
    eyeHide.hidden = !showPassword;
    togglePassBtn.setAttribute('aria-pressed', String(showPassword));
    passInput.focus();
  });

  const updateCapsLock = (event) => {
    const isOn = Boolean(event.getModifierState?.('CapsLock'));
    capsWarning.classList.toggle('is-visible', isOn);
  };
  passInput?.addEventListener('keydown', updateCapsLock);
  passInput?.addEventListener('keyup', updateCapsLock);
  passInput?.addEventListener('blur', () => capsWarning.classList.remove('is-visible'));

  [emailInput, passInput].forEach((input) => {
    input?.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      inlineAlert.textContent = '';
      inlineAlert.classList.remove('is-visible');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password || !emailInput.validity.valid) {
      const message = i18n.t('login_required', 'Enter a valid email address and password.');
      inlineAlert.textContent = message;
      inlineAlert.classList.add('is-visible');
      emailInput.setAttribute('aria-invalid', String(!email || !emailInput.validity.valid));
      passInput.setAttribute('aria-invalid', String(!password));
      (!email || !emailInput.validity.valid ? emailInput : passInput).focus();
      playErrorTone();
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/auth/login', { email, password });

      if (res.success && res.data) {
        playSuccessChime();
        api.setTokens(res.data.accessToken, res.data.refreshToken);
        api.setCurrentUser(res.data.user);

        // Sync phone Web Push subscription in background
        if ('Notification' in window && Notification.permission === 'granted') {
          setupWebPushNotifications(false).catch(() => {});
        }

        showToast(
          currentLang === 'ar'
            ? `مرحباً بك، ${res.data.user.fullName}`
            : currentLang === 'fr'
              ? `Bienvenue, ${res.data.user.fullName}`
              : `Welcome, ${res.data.user.fullName}`,
          'success'
        );

        if (res.data.user.role === 'WORKER') {
          router.navigate('/worker-requests');
        } else if (res.data.user.role === 'SUPERVISOR') {
          router.navigate('/scanner');
        } else {
          router.navigate('/dashboard');
        }
      }
    } catch (error) {
      playErrorTone();
      const message = error.code === 'INVALID_CREDENTIALS'
        ? i18n.t('login_invalid_credentials', 'The email address or password is incorrect.')
        : (error.message || i18n.t('login_unavailable', 'Sign-in is temporarily unavailable. Please try again.'));
      inlineAlert.textContent = message;
      inlineAlert.classList.add('is-visible');
      passInput.value = '';
      passInput.setAttribute('aria-invalid', 'true');
      passInput.focus();
    } finally {
      setSubmitting(false);
    }
  });

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.setAttribute('aria-busy', String(isSubmitting));
    spinner.classList.toggle('is-visible', isSubmitting);
    submitBtnArrow.hidden = isSubmitting;
    submitBtnText.textContent = isSubmitting
      ? i18n.t('login_authenticating', 'Verifying access...')
      : i18n.t('btn_signin', 'Sign in securely');
  }
}

function translatePlaceholders(container) {
  container.querySelectorAll('[data-i18n-placeholder]').forEach((input) => {
    const key = input.getAttribute('data-i18n-placeholder');
    input.setAttribute('placeholder', i18n.t(key, input.getAttribute('placeholder') || ''));
  });
}
