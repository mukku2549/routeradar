'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 3 - Middleware & Handler Identification', () => {
  for (const [version, express] of [['Express 4', express4], ['Express 5', express5]]) {
    describe(version, () => {
      test('identifies named route-level middleware and named handler', () => {
        const app = express();
        function authenticate(req, res, next) { next(); }
        function authorize(req, res, next) { next(); }
        function getDashboard(req, res) { res.send('dashboard'); }

        app.get('/admin', authenticate, authorize, getDashboard);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.deepEqual(report.routes[0].middlewares, ['authenticate', 'authorize']);
        assert.equal(report.routes[0].handler, 'getDashboard');
      });

      test('identifies anonymous middleware and anonymous handler using fallback label', () => {
        const app = express();
        app.get(
          '/anon',
          (req, res, next) => next(),
          (req, res) => res.send('ok')
        );

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.deepEqual(report.routes[0].middlewares, ['<anonymous>']);
        assert.equal(report.routes[0].handler, '<anonymous>');
      });

      test('identifies router-level middleware registered with router.use()', () => {
        const app = express();
        const apiRouter = express.Router();

        function apiKeyAuth(req, res, next) { next(); }
        function getProfile(req, res) { res.send('profile'); }

        apiRouter.use(apiKeyAuth);
        apiRouter.get('/profile', getProfile);
        app.use('/api', apiRouter);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.deepEqual(report.routes[0].middlewares, ['apiKeyAuth']);
        assert.equal(report.routes[0].handler, 'getProfile');
      });

      test('scopes application-level middleware to mounted paths', () => {
        const app = express();

        function globalLogger(req, res, next) { next(); }
        function adminOnly(req, res, next) { next(); }
        function getPublic(req, res) { res.send('pub'); }
        function getAdmin(req, res) { res.send('adm'); }

        app.use(globalLogger);
        app.use('/admin', adminOnly);

        app.get('/public', getPublic);
        app.get('/admin/panel', getAdmin);

        const radar = createRadar(app);
        const report = radar.scan();

        const pubRoute = report.routes.find((r) => r.path === '/public');
        const adminRoute = report.routes.find((r) => r.path === '/admin/panel');

        assert.ok(pubRoute);
        assert.ok(adminRoute);

        assert.deepEqual(pubRoute.middlewares, ['globalLogger']);
        assert.deepEqual(adminRoute.middlewares, ['globalLogger', 'adminOnly']);
      });

      test('honors includeMiddleware: false option', () => {
        const app = express();
        function mw(req, res, next) { next(); }
        function handler(req, res) { res.send('ok'); }

        app.use(mw);
        app.get('/test', mw, handler);

        const radar = createRadar(app, { includeMiddleware: false });
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.deepEqual(report.routes[0].middlewares, []);
        assert.equal(report.routes[0].handler, 'handler');
      });
    });
  }
});
