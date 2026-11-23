'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 3 - Filtering & Statistics API', () => {
  for (const [version, express] of [['Express 4', express4], ['Express 5', express5]]) {
    describe(version, () => {
      test('radar.getStats() returns comprehensive statistics metrics', () => {
        const app = express();
        function mw(req, res, next) { next(); }
        app.get('/users', () => {});
        app.get('/users/:id', mw, () => {});
        app.post('/users', () => {});

        const radar = createRadar(app);
        const stats = radar.getStats();

        assert.equal(stats.totalRoutes, 3);
        assert.equal(stats.totalEndpoints, 2);
        assert.equal(stats.totalUniqueEndpoints, 3);
        assert.equal(stats.duplicateRoutes, 0);
        assert.equal(stats.parameterizedRoutes, 1);
        assert.equal(stats.routesWithMiddleware, 1);
        assert.equal(stats.methods.GET, 2);
        assert.equal(stats.methods.POST, 1);
      });

      test('filters routes by parameter and middleware presence', () => {
        const app = express();
        function mw(req, res, next) { next(); }
        app.get('/static', () => {});
        app.get('/with-param/:id', () => {});
        app.get('/with-mw', mw, () => {});

        const radar = createRadar(app);

        const withParams = radar.getRoutes({ hasParameters: true });
        assert.equal(withParams.length, 1);
        assert.equal(withParams[0].path, '/with-param/:id');

        const withoutParams = radar.getRoutes({ hasParameters: false });
        assert.equal(withoutParams.length, 2);

        const withMw = radar.getRoutes({ hasMiddleware: true });
        assert.equal(withMw.length, 1);
        assert.equal(withMw[0].path, '/with-mw');
      });

      test('radar.getStats() returns accurate statistics before or after scan()', () => {
        const app = express();
        app.get('/users', () => {});
        app.get('/users/:id', () => {});
        app.post('/users', () => {});

        const radar = createRadar(app);
        const stats = radar.getStats();

        assert.equal(stats.totalRoutes, 3);
        assert.equal(stats.totalEndpoints, 2);
        assert.equal(stats.duplicateRoutes, 0);
      });

      test('radar.getRoutes() retrieves all routes when no filters passed', () => {
        const app = express();
        app.get('/a', () => {});
        app.post('/b', () => {});

        const radar = createRadar(app);
        const routes = radar.getRoutes();

        assert.equal(routes.length, 2);
      });

      test('filters routes by HTTP method (case-insensitive and matches ALL by default)', () => {
        const app = express();
        app.get('/users', () => {});
        app.post('/users', () => {});
        app.all('/status', () => {});

        const radar = createRadar(app);

        const getRoutes = radar.getRoutes({ method: 'get' });
        assert.equal(getRoutes.length, 2); // /users (GET) and /status (ALL)

        const exactGetRoutes = radar.getRoutes({ method: 'get', exactMethod: true });
        assert.equal(exactGetRoutes.length, 1);
        assert.equal(exactGetRoutes[0].path, '/users');

        const postRoutes = radar.getRoutes({ method: 'POST' });
        assert.equal(postRoutes.length, 2); // /users (POST) and /status (ALL)
      });

      test('filters routes by path (exact string, prefix, and RegExp)', () => {
        const app = express();
        app.get('/api/v1/users', () => {});
        app.get('/api/v1/products', () => {});
        app.get('/public/home', () => {});

        const radar = createRadar(app);

        // Exact match
        const exact = radar.getRoutes({ path: '/api/v1/users' });
        assert.equal(exact.length, 1);
        assert.equal(exact[0].path, '/api/v1/users');

        // Prefix match
        const prefixed = radar.getRoutes({ path: '/api', prefix: true });
        assert.equal(prefixed.length, 2);

        // RegExp match
        const regexMatched = radar.getRoutes({ path: /products$/ });
        assert.equal(regexMatched.length, 1);
        assert.equal(regexMatched[0].path, '/api/v1/products');
      });

      test('filters routes by composite method and path', () => {
        const app = express();
        app.get('/items', () => {});
        app.post('/items', () => {});
        app.get('/orders', () => {});

        const radar = createRadar(app);
        const filtered = radar.getRoutes({ method: 'POST', path: '/items' });

        assert.equal(filtered.length, 1);
        assert.equal(filtered[0].method, 'POST');
        assert.equal(filtered[0].path, '/items');

        const none = radar.getRoutes({ method: 'DELETE', path: '/items' });
        assert.deepEqual(none, []);
      });
    });
  }
});
