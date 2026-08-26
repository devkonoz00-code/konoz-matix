/**
 * SPA Router for MATIX
 * Handles hash routes (e.g. #/projects, #/items/:id, #/scanner)
 */
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.currentParams = {};
    this.beforeHooks = [];
    window.addEventListener('hashchange', () => this.handleRouting());
  }

  add(path, handler) {
    this.routes[path] = handler;
  }

  beforeEach(hook) {
    this.beforeHooks.push(hook);
  }

  navigate(path) {
    window.location.hash = path.startsWith('#') ? path : `#${path}`;
  }

  async handleRouting() {
    const fullHash = window.location.hash.slice(1) || '/dashboard';
    const [pathPart, queryPart] = fullHash.split('?');
    const queryParams = Object.fromEntries(new URLSearchParams(queryPart || ''));

    let matchedHandler = null;
    let matchedParams = {};

    // Match exact or parameterized route (e.g. /items/:id)
    for (const routePath in this.routes) {
      const paramNames = [];
      const regexPath = routePath.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^\\/]+)';
      });
      const regex = new RegExp(`^${regexPath}$`);
      const match = pathPart.match(regex);

      if (match) {
        matchedHandler = this.routes[routePath];
        paramNames.forEach((name, i) => {
          matchedParams[name] = decodeURIComponent(match[i + 1]);
        });
        break;
      }
    }

    if (!matchedHandler) {
      // 404 or default fallback
      matchedHandler = this.routes['/dashboard'] || this.routes['/login'];
    }

    this.currentParams = { ...matchedParams, ...queryParams };

    // Execute before hooks (e.g. Auth guards)
    for (const hook of this.beforeHooks) {
      const allowed = await hook(pathPart, this.currentParams);
      if (!allowed) return;
    }

    const appContainer = document.getElementById('main-content');
    if (appContainer && matchedHandler) {
      if (window.innerWidth <= 900 && typeof window.closeMobileMenu === 'function') {
        window.closeMobileMenu();
      }
      window.scrollTo(0, 0);
      try {
        await matchedHandler(appContainer, this.currentParams);
      } catch (err) {
        console.error('Error rendering page:', err);
        appContainer.innerHTML = `
          <div class="card error-container">
            <h3>Something went wrong</h3>
            <p>${err.message || 'Error loading page'}</p>
            <button class="btn btn-primary" onclick="window.location.reload()">Reload</button>
          </div>
        `;
      }
    }

    // Highlight active nav item
    this.updateActiveNav(pathPart);
  }

  updateActiveNav(pathPart) {
    const baseSegment = '/' + (pathPart.split('/')[1] || 'dashboard');
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach((el) => {
      const href = el.getAttribute('href') || '';
      if (href === `#${baseSegment}` || (baseSegment === '/dashboard' && href === '#/')) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  start() {
    this.handleRouting();
  }
}

export const router = new Router();
