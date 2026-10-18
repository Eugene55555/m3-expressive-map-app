export const ROUTES = ['home', 'search', 'saved', 'settings'] as const;

export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = 'home';

export function isRoute(value: unknown): value is Route {
  return typeof value === 'string' && (ROUTES as readonly string[]).includes(value);
}

/** Parse a location hash such as "#/saved" into a known route. */
export function parseRoute(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '').split('?')[0]?.trim().toLowerCase() ?? '';
  return isRoute(cleaned) ? cleaned : DEFAULT_ROUTE;
}

export function routeToHash(route: Route): string {
  return `#/${route}`;
}

export function readLocationRoute(): Route {
  if (typeof window === 'undefined') return DEFAULT_ROUTE;
  return parseRoute(window.location.hash);
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  if (options.replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function onRouteChange(callback: (route: Route) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(readLocationRoute());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
