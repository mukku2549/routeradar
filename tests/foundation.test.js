'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar, RouteRadar, resolveAdapter } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 1 - Foundation & Adapter Detection', () => {
  test('createRadar is a function', () => {
    assert.equal(typeof createRadar, 'function');
  });

  test('throws TypeError for non-object/non-function input', () => {
    assert.throws(() => createRadar(null), {
      name: 'TypeError',
      message: /RouteRadar requires a valid Express application instance/,
    });
    assert.throws(() => createRadar(undefined), {
      name: 'TypeError',
    });
    assert.throws(() => createRadar('express'), {
      name: 'TypeError',
    });
    assert.throws(() => createRadar(123), {
      name: 'TypeError',
    });
  });

  test('throws Error for unsupported objects or arbitrary functions', () => {
    assert.throws(() => createRadar({}), {
      name: 'Error',
      message: /Unsupported framework or Express version/,
    });
    assert.throws(() => createRadar(() => {}), {
      name: 'Error',
      message: /Unsupported framework or Express version/,
    });
  });

  test('detects Express 4 app (empty and with routes)', () => {
    const appEmpty = express4();
    const radarEmpty = createRadar(appEmpty);
    assert.ok(radarEmpty instanceof RouteRadar);
    assert.equal(radarEmpty.adapter.id, 'express4');

    const appWithRoute = express4();
    appWithRoute.get('/test', (req, res) => res.send('ok'));
    const radarWithRoute = createRadar(appWithRoute);
    assert.equal(radarWithRoute.adapter.id, 'express4');
  });

  test('detects Express 5 app (empty and with routes)', () => {
    const appEmpty = express5();
    const radarEmpty = createRadar(appEmpty);
    assert.ok(radarEmpty instanceof RouteRadar);
    assert.equal(radarEmpty.adapter.id, 'express5');

    const appWithRoute = express5();
    appWithRoute.get('/test', (req, res) => res.send('ok'));
    const radarWithRoute = createRadar(appWithRoute);
    assert.equal(radarWithRoute.adapter.id, 'express5');
  });

  test('options defaults and custom overrides', () => {
    const app = express5();
    const radarDefault = createRadar(app);
    assert.equal(radarDefault.options.includeMiddleware, true);
    assert.equal(radarDefault.options.detectDuplicates, true);
    assert.equal(radarDefault.options.includeStats, true);

    const radarCustom = createRadar(app, {
      includeMiddleware: false,
      detectDuplicates: false,
      includeStats: false,
    });
    assert.equal(radarCustom.options.includeMiddleware, false);
    assert.equal(radarCustom.options.detectDuplicates, false);
    assert.equal(radarCustom.options.includeStats, false);
  });

  test('scan() on empty Express 4 app produces valid schema report and does not mutate app', () => {
    const app = express4();
    assert.equal(app._router, undefined);

    const radar = createRadar(app);
    const report = radar.scan();

    assert.ok(report.metadata);
    assert.equal(report.metadata.tool, 'RouteRadar');
    assert.equal(report.metadata.version, '1.0.0');
    assert.ok(report.metadata.scannedAt);

    assert.equal(report.statistics.totalRoutes, 0);
    assert.equal(report.statistics.totalEndpoints, 0);
    assert.equal(report.statistics.duplicateRoutes, 0);
    assert.deepEqual(report.routes, []);
    assert.deepEqual(report.warnings, []);

    // Verify app was NOT mutated by lazyrouter call
    assert.equal(app._router, undefined);
  });

  test('version detection does not initialize or mutate empty Express 4 or 5 applications', () => {
    // Express 4: _router must remain undefined
    const app4 = express4();
    assert.equal(app4._router, undefined);
    const adapter4 = resolveAdapter(app4);
    assert.equal(adapter4.id, 'express4');
    assert.equal(app4._router, undefined, 'Express 4 _router must not be initialized during detection');

    // Express 5: router closure must not be instantiated
    const app5 = express5();
    const probe = { enabled: () => { throw new Error('NOT_INITIALIZED_PROBE'); } };
    const desc = Object.getOwnPropertyDescriptor(app5, 'router');
    assert.throws(() => desc.get.call(probe), { message: 'NOT_INITIALIZED_PROBE' });

    const adapter5 = resolveAdapter(app5);
    assert.equal(adapter5.id, 'express5');
    assert.throws(() => desc.get.call(probe), { message: 'NOT_INITIALIZED_PROBE' }, 'Express 5 router must not be initialized during detection');
  });

  test('scan() on empty Express 5 app produces valid schema report and does not initialize router', () => {
    const app = express5();
    const probe = { enabled: () => { throw new Error('NOT_INITIALIZED_PROBE'); } };
    const desc = Object.getOwnPropertyDescriptor(app, 'router');

    // Confirm uninitialized before scan
    assert.throws(() => desc.get.call(probe), { message: 'NOT_INITIALIZED_PROBE' });

    const radar = createRadar(app);
    const report = radar.scan();

    assert.ok(report.metadata);
    assert.equal(report.statistics.totalRoutes, 0);
    assert.equal(report.statistics.totalEndpoints, 0);
    assert.equal(report.statistics.duplicateRoutes, 0);
    assert.deepEqual(report.routes, []);
    assert.deepEqual(report.warnings, []);

    // Confirm still uninitialized after scan
    assert.throws(() => desc.get.call(probe), { message: 'NOT_INITIALIZED_PROBE' }, 'Express 5 router must not be initialized by scan()');
  });

  test('adapters expose the required interface', () => {
    const app4 = express4();
    const app5 = express5();
    const a4 = resolveAdapter(app4);
    const a5 = resolveAdapter(app5);

    for (const a of [a4, a5]) {
      assert.ok(typeof a.id === 'string');
      assert.ok(typeof a.detect === 'function');
      assert.ok(typeof a.getRouter === 'function');
      assert.ok(typeof a.isRouterHandle === 'function');
      assert.ok(typeof a.isOpaqueMountedApp === 'function');
      assert.ok(typeof a.mountPath === 'function');
      assert.ok(typeof a.routePath === 'function');
      assert.ok(Array.isArray(a.internalMiddleware));
    }
  });
});
