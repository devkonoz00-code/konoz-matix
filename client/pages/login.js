/**
 * Login Page Module (§16)
 * Supports real Go-Live authentication and quick logins for the 3 reference accounts.
 */
import { api } from '../js/api.js';
import { router } from '../js/router.js';
import { showToast } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div class="card" style="width: 100%; max-width: 440px; padding: 2.25rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <div class="brand-logo" style="margin: 0 auto 1rem; width: 72px; height: 72px; box-shadow: none;">
            <img src="./assets/logo.png" alt="Konoz Logo" style="width: 100%; height: 100%; object-fit: contain;">
          </div>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary);">MATIX</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;" data-i18n="msg_login_subtitle">
            Cloud tracking layer for material movements & site logistics
          </p>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label" data-i18n="lbl_email">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@company.com" required autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="lbl_password">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem;" id="btn-submit-login">
            <span data-i18n="btn_signin">Sign In to MATIX</span>
          </button>
        </form>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Handle Form Submit
  const form = container.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-submit-login');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      const res = await api.post('/auth/login', { email, password });
      if (res.success && res.data) {
        api.setTokens(res.data.accessToken, res.data.refreshToken);
        api.setCurrentUser(res.data.user);
        showToast(`Welcome back, ${res.data.user.fullName}!`, 'success');

        // SUPERVISOR's primary experience is scanner-first (§13)
        if (res.data.user.role === 'SUPERVISOR') {
          router.navigate('/scanner');
        } else {
          router.navigate('/dashboard');
        }
      }
    } catch (err) {
      showToast(err.message || 'Invalid credentials', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to MATIX';
    }
  });
}
