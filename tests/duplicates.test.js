'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 3 - Duplicate Route Detection', () => {
  for (const [version, express] of [['Express 4', express4], ['Express 5', express5]]) {
    describe(version, () => {
      test('detects exact duplicate method and path registrations', () => {
        const app = express();
        function handlerOne(req, res) { res.send('one'); }
        function handlerTwo(req, res) { res.send('two'); }

        app.get('/users', handlerOne);
        app.get('/users', handlerTwo);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.statistics.totalRoutes, 2);
        assert.equal(report.statistics.totalEndpoints, 1);
        assert.equal(report.statistics.duplicateRoutes, 1);

        const dupWarning = report.warnings.find((w) =>
          w.includes('Potential duplicate route: GET /users (2 registrations)')
        );
        assert.ok(dupWarning, 'Should include duplicate warning');
      });

      test('detects duplicates with trailing slash differences and case insensitivity', () => {
        const app = express();
        app.get('/Products', () => {});
        app.get('/products/', () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.statistics.duplicateRoutes, 1);
        assert.equal(report.statistics.totalEndpoints, 1);
      });

      test('does not flag different HTTP methods on same path as duplicates', () => {
        const app = express();
        app.get('/items', () => {});
        app.post('/items', () => {});
        app.delete('/items', () => {});

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.statistics.totalRoutes, 3);
        assert.equal(report.statistics.totalEndpoints, 1);
        assert.equal(report.statistics.duplicateRoutes, 0);
        assert.equal(report.warnings.length, 0);
      });

      test('multiple handlers inside one route registration are not duplicates', () => {
        const app = express();
        function mw1(req, res, next) { next(); }
        function mw2(req, res, next) { next(); }
        function finalHandler(req, res) { res.send('ok'); }

        app.get('/chained', mw1, mw2, finalHandler);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.statistics.totalRoutes, 1);
        assert.equal(report.statistics.duplicateRoutes, 0);
        assert.equal(report.warnings.length, 0);
      });

      test('different router mount prefixes for the same router are not duplicates', () => {
        const app = express();
        const r = express.Router();
        r.get('/info', (req, res) => res.send('ok'));

        app.use('/v1', r);
        app.use('/v2', r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.statistics.totalEndpoints, 2);
        assert.equal(report.statistics.duplicateRoutes, 0);
        assert.equal(report.warnings.length, 0);
      });

      test('honors detectDuplicates: false option', () => {
        const app = express();
        app.get('/users', () => {});
        app.get('/users', () => {});

        const radar = createRadar(app, { detectDuplicates: false });
        const report = radar.scan();

        assert.equal(report.statistics.duplicateRoutes, 0);
        assert.equal(report.warnings.length, 0);
      });
    });
  }
});
