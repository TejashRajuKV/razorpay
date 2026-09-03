/**
 * Route-shape tests: recoveryRoutes mounts detect + batch + simulate + stats.
 */
const router = require('../../src/routes/recoveryRoutes');

function routes() {
  return (router.stack || [])
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
}

describe('recoveryRoutes', () => {
  test('exposes detect, run-batch, simulate-batch, stats', () => {
    const r = routes();
    expect(r).toContain('POST /detect');
    expect(r).toContain('POST /run-batch');
    expect(r).toContain('POST /simulate-batch');
    expect(r).toContain('GET /stats');
  });
});
