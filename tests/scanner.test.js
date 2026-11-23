'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express5 = require('express');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 2 - Route Scanner & Nested Routers', () => {
  for (const [version, express] of [['Express 4', express4], ['Express 5', express5]]) {
    describe(version, () => {
      test('discovers root and basic routes', () => {
        const app = express();
        app.get('/', (req, res) => res.send('home'));
        app.post('/login', (req, res) => res.send('login'));

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.routes[0].method, 'GET');
        assert.equal(report.routes[0].path, '/');
        assert.equal(report.routes[1].method, 'POST');
        assert.equal(report.routes[1].path, '/login');
      });

      test('discovers single level nested router', () => {
        const app = express();
        const api = express.Router();
        api.get('/health', (req, res) => res.send('ok'));
        api.post('/echo', (req, res) => res.send('echo'));
        app.use('/api', api);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.routes[0].method, 'GET');
        assert.equal(report.routes[0].path, '/api/health');
        assert.equal(report.routes[1].method, 'POST');
        assert.equal(report.routes[1].path, '/api/echo');
      });

      test('discovers multi-level nested routers (3 levels deep)', () => {
        const app = express();
        const apiRouter = express.Router();
        const v1Router = express.Router();
        const usersRouter = express.Router();

        usersRouter.get('/', (req, res) => res.send('list'));
        usersRouter.get('/:id', (req, res) => res.send('user'));

        v1Router.use('/users', usersRouter);
        apiRouter.use('/v1', v1Router);
        app.use('/api', apiRouter);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.routes[0].method, 'GET');
        assert.equal(report.routes[0].path, '/api/v1/users');
        assert.deepEqual(report.routes[0].parameters, []);

        assert.equal(report.routes[1].method, 'GET');
        assert.equal(report.routes[1].path, '/api/v1/users/:id');
        assert.deepEqual(report.routes[1].parameters, ['id']);
      });

      test('discovers router mounted at root with app.use(router)', () => {
        const app = express();
        const r = express.Router();
        r.get('/standalone', (req, res) => res.send('ok'));
        app.use(r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].method, 'GET');
        assert.equal(report.routes[0].path, '/standalone');
      });

      test('discovers router mounted at root with app.use("/", router)', () => {
        const app = express();
        const r = express.Router();
        r.get('/users', (req, res) => res.send('ok'));
        app.use('/', r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].path, '/users');
      });

      test('handles multi-path mounted routers', () => {
        const app = express();
        const r = express.Router();
        r.get('/ping', (req, res) => res.send('pong'));
        app.use(['/api/v1', '/api/v2'], r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 2);
        assert.equal(report.routes[0].path, '/api/v1/ping');
        assert.equal(report.routes[1].path, '/api/v2/ping');
      });

      test('handles circular router references safely', () => {
        const app = express();
        const r1 = express.Router();
        const r2 = express.Router();

        r1.get('/hello', (req, res) => res.send('hello'));
        r2.get('/world', (req, res) => res.send('world'));

        // Create cycle: r1 mounts r2, r2 mounts r1
        r1.use('/sub2', r2);
        r2.use('/sub1', r1);
        app.use('/test', r1);

        const radar = createRadar(app);
        const report = radar.scan();

        // Must not crash or hang; must record warning
        assert.ok(report.warnings.length > 0);
        const hasCircularWarning = report.warnings.some((w) =>
          w.includes('Circular router reference detected')
        );
        assert.ok(hasCircularWarning, 'Expected circular router warning');
      });

      test('repeated scans do not accumulate duplicate routes or stale state', () => {
        const app = express();
        app.get('/one', (req, res) => res.send('1'));

        const radar = createRadar(app);
        const report1 = radar.scan();
        const report2 = radar.scan();

        assert.equal(report1.routes.length, 1);
        assert.equal(report2.routes.length, 1);
        assert.deepEqual(report1.routes, report2.routes);
      });

      test('handles empty mounted routers without crashing', () => {
        const app = express();
        const emptyRouter = express.Router();
        app.use('/empty', emptyRouter);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 0);
      });

      test('handles malformed layer entries in router stack safely', () => {
        const app = express();
        const r = express.Router();
        r.get('/valid', (req, res) => res.send('ok'));
        // Manually introduce malformed layers
        r.stack.unshift(null);
        r.stack.push({});
        r.stack.push({ handle: null });
        app.use('/malformed', r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].path, '/malformed/valid');
      });

      test('verifies consistent route structure, params, handlers, inferred flag and source', () => {
        const app = express();
        const r = express.Router();
        function getUserHandler(req, res) { res.send('ok'); }
        r.get('/:userId', getUserHandler);
        app.use('/api', r);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        const route = report.routes[0];

        assert.equal(route.method, 'GET');
        assert.equal(route.path, '/api/:userId');
        assert.equal(route.fullPath, '/api/:userId');
        assert.deepEqual(route.params, ['userId']);
        assert.deepEqual(route.parameters, ['userId']);
        assert.deepEqual(route.handlers, ['getUserHandler']);
        assert.equal(route.handler, 'getUserHandler');
        assert.equal(route.source.framework, 'express');

        if (version === 'Express 4') {
          assert.equal(route.source.version, 4);
          assert.equal(route.inferred, true); // Reconstructed from regexp
        } else {
          assert.equal(route.source.version, 5);
          assert.equal(route.inferred, false); // Read from layer.rawPath
        }
      });

      test('discovers deeply nested routers (5 levels deep)', () => {
        const app = express();
        const r1 = express.Router();
        const r2 = express.Router();
        const r3 = express.Router();
        const r4 = express.Router();
        const r5 = express.Router();

        r5.get('/leaf', (req, res) => res.send('deep'));
        r4.use('/l5', r5);
        r3.use('/l4', r4);
        r2.use('/l3', r3);
        r1.use('/l2', r2);
        app.use('/l1', r1);

        const radar = createRadar(app);
        const report = radar.scan();

        assert.equal(report.routes.length, 1);
        assert.equal(report.routes[0].path, '/l1/l2/l3/l4/l5/leaf');
      });

      test('never executes route handlers during scanning', () => {
        let handlerCallCount = 0;
        let mwCallCount = 0;

        const app = express();
        const mw = (req, res, next) => {
          mwCallCount++;
          next();
        };
        const handler = (req, res) => {
          handlerCallCount++;
          res.send('ok');
        };

        app.use(mw);
        app.get('/test', handler);

        const radar = createRadar(app);
        radar.scan();

        assert.equal(handlerCallCount, 0, 'Handler must not be executed');
        assert.equal(mwCallCount, 0, 'Middleware must not be executed');
      });
    });
  }
});
