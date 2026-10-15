import { describe, it, expect } from 'vitest';
import storeRoutes from '../store.routes.js';
import adminStoreRoutes from '../admin.store.routes.js';
import { categoryRoutes } from '../category.routes.js';
import userRoutes from '../user.routes.js';
import authRoutes from '../auth.routes.js';
import { reportRoutes } from '../report.routes.js';

// Reads the middleware chain of each route, so a route that loses its guard fails here
type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { name: string; handle: Function }[] } };

const routeInfo = (router: any, method: string, path: string) => {
  const layer = (router.stack as Layer[]).find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route!.stack.map((s) => s.name);
};

describe('route guards', () => {
  it('stores: everything is behind authentication', () => {
    const firstLayer = (storeRoutes as any).stack[0];
    expect(firstLayer.name).toBe('authenticateToken');
  });

  it('stores: no public create or list-all route is left', () => {
    const routes = ((storeRoutes as any).stack as Layer[]).filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
    expect(routes).not.toContain('post /');
    expect(routes.sort()).toEqual(['get /', 'get /:id', 'put /:id'].sort());
  });

  it('stores: /:id routes only reach the own store; editing needs admin; deactivate/delete are gone', () => {
    expect(routeInfo(storeRoutes, 'get', '/:id')).toContain('requireOwnStore');
    const chain = routeInfo(storeRoutes, 'put', '/:id');
    expect(chain).toContain('requireOwnStore');
    expect(chain.length).toBeGreaterThanOrEqual(3); // requireOwnStore + authorizeRole(admin) + handler
  });

  it('admin stores: everything needs login and the platform administrator flag', () => {
    const [first, second] = (adminStoreRoutes as any).stack;
    expect(first.name).toBe('authenticateToken');
    expect(second.name).toBe('requirePlatformAdmin');
    const routes = ((adminStoreRoutes as any).stack as Layer[]).filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
    expect(routes.sort()).toEqual(['delete /:id', 'get /', 'patch /:id/activate', 'patch /:id/deactivate', 'put /:id'].sort());
  });

  it('categories: reads for everyone, writes need a role check', () => {
    expect(routeInfo(categoryRoutes, 'get', '/').length).toBe(1);
    for (const [method, path] of [['post', '/'], ['put', '/:id'], ['delete', '/:id']] as const) {
      expect(routeInfo(categoryRoutes, method, path).length).toBe(2); // role guard + handler
    }
  });

  it('users: every route is behind authentication and nothing is public', () => {
    expect((userRoutes as any).stack[0].name).toBe('authenticateToken');
    const routes = ((userRoutes as any).stack as Layer[]).filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
    expect(routes.sort()).toEqual(['get /', 'get /:id', 'patch /:id/deactivate', 'post /', 'post /:id/change-password', 'put /:id'].sort());
  });

  it('users: creating, listing and deactivating need a role check', () => {
    expect(routeInfo(userRoutes, 'post', '/').length).toBe(2);
    expect(routeInfo(userRoutes, 'get', '/').length).toBe(2);
    expect(routeInfo(userRoutes, 'patch', '/:id/deactivate').length).toBe(2);
  });

  it('auth: login and register are rate limited, and there is nothing else public', () => {
    const routes = ((authRoutes as any).stack as Layer[]).filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
    expect(routes.sort()).toEqual(['post /login', 'post /register']);
    expect(routeInfo(authRoutes, 'post', '/login').length).toBe(3); // per-IP limiter, per-account limiter, handler
    expect(routeInfo(authRoutes, 'post', '/register').length).toBe(2); // limiter, handler
  });

  it('reports: login plus admin/manager role check on everything', () => {
    const [first, second] = (reportRoutes as any).stack;
    expect(first.name).toBe('authenticateToken');
    expect(second.name).toBeTruthy(); // authorizeRole('admin', 'manager')
    expect(routeInfo(reportRoutes, 'get', '/overview').length).toBe(1);
  });
});
