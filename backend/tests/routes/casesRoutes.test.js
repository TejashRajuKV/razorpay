/**
 * Route-shape tests: casesRoutes mounts all expected endpoints.
 * No HTTP calls, no DB — asserts the router contract only.
 */
const router = require('../../src/routes/casesRoutes');

function routes() {
  return (router.stack || [])
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
}

describe('casesRoutes', () => {
  test('exposes CRUD + action + workflow + audit + status routes', () => {
    const r = routes();
    expect(r).toContain('GET /');
    expect(r).toContain('GET /:id');
    expect(r).toContain('POST /:id/action');
    expect(r).toContain('POST /:id/run-workflow');
    expect(r).toContain('GET /:id/audit');
    expect(r).toContain('PUT /:id/status');
  });
});
