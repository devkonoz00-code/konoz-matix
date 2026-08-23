/**
 * Enterprise Luxury Login Page Module (§16)
 * World-Class Security, Brand Storytelling, Multi-Language & One-Click Demo Logins
 */
import { api } from '../js/api.js';
import { router } from '../js/router.js';
import { showToast, playSuccessChime, playConfirmBeep, playErrorTone } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export function renderLogin(container) {
  const currentLang = localStorage.getItem('matix_lang') || 'ar';
  const savedEmail = localStorage.getItem('matix_remember_email') || '';

  container.innerHTML = `
    <div class="login-page-wrapper">
      <div class="login-master-card">
        
        <!-- Left Hero Enterprise Branding Panel (Desktop) -->
        <div class="login-hero-pane">
          <div class="login-hero-glow"></div>
          
          <div class="login-hero-header">
            <div class="login-hero-badge">
              <span class="status-dot"></span>
              <span>MATIX Cloud Infrastructure • Live</span>
            </div>
            <h1 class="login-hero-title">
              Enterprise Project <br>
              <span class="gradient-text">Logistics & Ledger</span>
            </h1>
            <p class="login-hero-desc">
              Integrated real-time material tracking, multi-project ledger accounting, high-speed mobile scanning, and immutable compliance audit.
            </p>
          </div>

          <!-- Feature Highlights -->
          <div class="login-features-list">
            <div class="login-feature-item">
              <div class="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              </div>
              <div class="login-feature-text">
                <h4>Real-Time Inventory & Movements</h4>
                <p>Derived stock balances from confirmed immutable ledger entries.</p>
              </div>
            </div>

            <div class="login-feature-item">
              <div class="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div class="login-feature-text">
                <h4>Multi-Site Project Governance</h4>
                <p>Dynamic on-hand asset value and cumulative cost consumption per site.</p>
              </div>
            </div>

            <div class="login-feature-item">
              <div class="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div class="login-feature-text">
                <h4>Multi-Tier RBAC & Audit Trail</h4>
                <p>Role-enforced approvals with tamper-evident cryptographic logging.</p>
              </div>
            </div>
          </div>

          <!-- Hero Footer -->
          <div class="login-hero-footer">
            <div class="login-hero-cert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>TLS 1.3 / 256-Bit Encrypted</span>
            </div>
            <span>v2.4 Enterprise</span>
          </div>
        </div>

        <!-- Right Form Panel -->
        <div class="login-form-pane">
          <div>
            <!-- Top Bar: Brand + Language Pill -->
            <div class="login-form-top-bar">
              <div class="login-brand-group">
                <div class="login-brand-logo">
                  <img src="./assets/logo.png" alt="Konoz MATIX">
                </div>
                <div class="login-brand-text">
                  <h3>MATIX</h3>
                  <span>Logistics Cloud</span>
                </div>
              </div>

              <!-- Quick Language Switcher -->
              <div class="login-lang-pill">
                <button type="button" class="login-lang-btn ${currentLang === 'ar' ? 'active' : ''}" data-lang="ar">العربية</button>
                <button type="button" class="login-lang-btn ${currentLang === 'fr' ? 'active' : ''}" data-lang="fr">FR</button>
                <button type="button" class="login-lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
              </div>
            </div>

            <!-- Header Titles -->
            <div class="login-form-header">
              <h2 data-i18n="msg_login_title">Sign in to your account</h2>
              <p data-i18n="msg_login_subtitle">Enter your corporate credentials to access the platform</p>
            </div>

            <!-- Login Form -->
            <form id="login-form" novalidate>
              <!-- Email Input -->
              <div class="form-group" style="margin-bottom: 1.15rem;">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600;" data-i18n="lbl_email">Email Address</label>
                <div class="login-input-wrapper">
                  <span class="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </span>
                  <input
                    type="email"
                    id="login-email"
                    class="login-input-field"
                    placeholder="name@company.com"
                    value="${savedEmail}"
                    required
                    autocomplete="username"
                    dir="ltr"
                  >
                </div>
              </div>

              <!-- Password Input -->
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                  <label class="form-label" style="margin: 0; font-size: 0.82rem; font-weight: 600;" data-i18n="lbl_password">Password</label>
                  <span id="caps-warning" style="display: none; font-size: 0.72rem; color: var(--warning); font-weight: 600;">⚠️ Caps Lock is ON</span>
                </div>
                <div class="login-input-wrapper">
                  <span class="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input
                    type="password"
                    id="login-password"
                    class="login-input-field"
                    placeholder="••••••••••••"
                    required
                    autocomplete="current-password"
                    dir="ltr"
                  >
                  <button type="button" class="login-input-action" id="btn-toggle-password" title="Show/Hide Password" aria-label="Toggle Password Visibility">
                    <svg id="eye-icon-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg id="eye-icon-hide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </div>

              <!-- Options: Remember Me -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); cursor: pointer; user-select: none;">
                  <input type="checkbox" id="chk-remember-me" ${savedEmail ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer;">
                  <span>Remember my email</span>
                </label>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="login-submit-btn" id="btn-submit-login">
                <span id="btn-login-text" data-i18n="btn_signin">Sign In to MATIX</span>
                <svg id="btn-login-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>

            <!-- Quick Demo Accounts One-Click Selector -->
            <div class="login-demo-section">
              <div class="login-demo-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7.5" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                <span data-i18n="msg_demo_accounts">Quick Access Demo Profiles</span>
              </div>
              <div class="login-demo-grid">
                <div class="login-demo-chip" data-email="admin@matix.local" data-pass="Admin123!" title="System Administrator">
                  <span class="chip-role">👑 Admin</span>
                  <span class="chip-sub">مدير النظام</span>
                </div>
                <div class="login-demo-chip" data-email="warehouse@matix.local" data-pass="Warehouse123!" title="Warehouse & Stock Manager">
                  <span class="chip-role">🏬 Warehouse</span>
                  <span class="chip-sub">المستودعات</span>
                </div>
                <div class="login-demo-chip" data-email="supervisor@matix.local" data-pass="Supervisor123!" title="Field Logistics Supervisor">
                  <span class="chip-role">👷 Supervisor</span>
                  <span class="chip-sub">المشرف العام</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div class="login-form-footer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Protected by MATIX Enterprise Zero-Trust Shield</span>
          </div>

        </div>

      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Bind Language Switcher Buttons
  container.querySelectorAll('.login-lang-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang');
      playConfirmBeep();
      await i18n.setLanguage(lang);
      renderLogin(container);
    });
  });

  // Password Visibility Toggle
  const passInput = container.querySelector('#login-password');
  const togglePassBtn = container.querySelector('#btn-toggle-password');
  const eyeShow = container.querySelector('#eye-icon-show');
  const eyeHide = container.querySelector('#eye-icon-hide');

  togglePassBtn?.addEventListener('click', () => {
    playConfirmBeep();
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeShow.style.display = 'none';
      eyeHide.style.display = 'block';
    } else {
      passInput.type = 'password';
      eyeShow.style.display = 'block';
      eyeHide.style.display = 'none';
    }
    passInput.focus();
  });

  // Caps Lock Detection
  const capsWarning = container.querySelector('#caps-warning');
  passInput?.addEventListener('keyup', (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      capsWarning.style.display = 'inline';
    } else {
      capsWarning.style.display = 'none';
    }
  });

  // Quick Demo Account Buttons
  const emailInput = container.querySelector('#login-email');
  const rememberCheckbox = container.querySelector('#chk-remember-me');

  container.querySelectorAll('.login-demo-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      playConfirmBeep();
      const email = chip.getAttribute('data-email');
      const pass = chip.getAttribute('data-pass');

      emailInput.value = email;
      passInput.value = pass;
      emailInput.style.borderColor = 'var(--primary)';
      passInput.style.borderColor = 'var(--primary)';

      setTimeout(() => {
        emailInput.style.borderColor = '';
        passInput.style.borderColor = '';
      }, 600);

      passInput.focus();
    });
  });

  // Handle Form Submission
  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#btn-submit-login');
  const submitBtnText = container.querySelector('#btn-login-text');
  const submitBtnArrow = container.querySelector('#btn-login-arrow');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      showToast('Please enter both email and password', 'error');
      playErrorTone();
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtnText.textContent = currentLang === 'ar' ? 'جاري التحقق من الهوية...' : 'Authenticating...';
      submitBtnArrow.style.display = 'none';

      // Remember me
      if (rememberCheckbox?.checked) {
        localStorage.setItem('matix_remember_email', email);
      } else {
        localStorage.removeItem('matix_remember_email');
      }

      const res = await api.post('/auth/login', { email, password });
      if (res.success && res.data) {
        playSuccessChime();
        api.setTokens(res.data.accessToken, res.data.refreshToken);
        api.setCurrentUser(res.data.user);

        showToast(
          currentLang === 'ar'
            ? `مرحباً بك مجدداً، ${res.data.user.fullName}!`
            : `Welcome back, ${res.data.user.fullName}!`,
          'success'
        );

        // SUPERVISOR role lands directly on the Mobile Scanner (§13)
        if (res.data.user.role === 'SUPERVISOR') {
          router.navigate('/scanner');
        } else {
          router.navigate('/dashboard');
        }
      }
    } catch (err) {
      playErrorTone();
      showToast(err.message || 'Invalid credentials', 'error');
      passInput.value = '';
      passInput.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtnText.textContent = currentLang === 'ar' ? 'تسجيل الدخول إلى MATIX' : 'Sign In to MATIX';
      submitBtnArrow.style.display = 'block';
    }
  });
}
