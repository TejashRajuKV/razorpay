/**
 * Route-shape tests: dashboardRoutes mounts overview + breakdowns.
 */
const router = require('../../src/routes/dashboardRoutes');

function routes() {
  return (router.stack || [])
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
}

describe('dashboardRoutes', () => {
  test('exposes overview, revenue-at-risk, customer-segments', () => {
    const r = routes();
    expect(r).toContain('GET /overview');
    expect(r).toContain('GET /revenue-at-risk');
    expect(r).toContain('GET /customer-segments');
  });
});
