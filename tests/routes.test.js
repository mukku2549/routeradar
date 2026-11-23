'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 2 - HTTP Methods, Paths & Parameters', () => {
  for (const [version, express] of [['Express 4', express4], ['Express 5', express5]]) {
    describe(version, () => {
      test('detects all standard HTTP methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD', () => {
        const app = express();
        app.get('/items', () => {});
        app.post('/items', () => {});
        app.put('/items/:id', () => {});
        app.patch('/items/:id', () => {});
        app.delete('/items/:id', () => {});
        app.options('/items', () => {});
        app.head('/items', () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        const methods = report.routes.map((r) => r.method);
        assert.deepEqual(methods, [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS',
          'HEAD',
        ]);
      });

      test('detects app.all() and collapses it to ALL', () => {
        const app = express();
        app.all('/universal', () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].method, 'ALL');
        assert.equal(report.routes[0].path, '/universal');
      });

      test('detects router.route().all() as ALL', () => {
        const app = express();
        const r = express.Router();
        r.route('/endpoint').all(() => {});
        app.use('/r', r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].method, 'ALL');
        assert.equal(report.routes[0].path, '/r/endpoint');
      });

      test('extracts route parameters in appearance order', () => {
        const app = express();
        app.get('/organizations/:orgId/projects/:projectId/issues/:issueId', () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.deepEqual(report.routes[0].parameters, ['orgId', 'projectId', 'issueId']);
      });

      test('combines router mount parameters and route parameters', () => {
        const app = express();
        const tenantRouter = express.Router();
        tenantRouter.get('/users/:userId', () => {});

        app.use('/tenants/:tenantId', tenantRouter);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].path, '/tenants/:tenantId/users/:userId');
        assert.deepEqual(report.routes[0].parameters, ['tenantId', 'userId']);
      });

      test('handles routes registered with an array of paths', () => {
        const app = express();
        app.get(['/apple', '/banana'], () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.routes[0].path, '/apple');
        assert.equal(report.routes[1].path, '/banana');
      });
    });
  }
});
