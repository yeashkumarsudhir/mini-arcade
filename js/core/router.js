// router.js: very small hash router (#/, #/game/snake, #/profile).
export class Router {
  constructor(routes = {}) {
    this.routes = routes;
    this.current = '#/';
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    this.handleRoute();
  }

  navigate(hash) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      this.handleRoute();
    }
  }

  handleRoute() {
    const hash = window.location.hash || '#/';
    this.current = hash;

    if (hash.startsWith('#/game/')) {
      const gameKey = hash.replace('#/game/', '');
      this.routes['#/game']?.(gameKey);
    } else if (this.routes[hash]) {
      this.routes[hash]();
    } else {
      this.routes['#/']?.();
    }
  }
}