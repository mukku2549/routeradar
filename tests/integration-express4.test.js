'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRadar } = require('../src');
const express4 = require('./fixtures/express4/node_modules/express');

describe('Phase 5 - Comprehensive Express 4 Integration Suite', () => {
  test('scans a full realistic Express 4 application', () => {
    const app = express4();

    let handlerCalls = 0;
    function countCall(req, res, next) {
      handlerCalls++;
      if (next) next();
    }

    // Middleware definitions
    function requestLogger(req, res, next) { countCall(req, res, next); }
    function requireAuth(req, res, next) { countCall(req, res, next); }
    function requireAdmin(req, res, next) { countCall(req, res, next); }

    // Handler definitions
    function getRoot(req, res) { countCall(req, res); }
    function listUsers(req, res) { countCall(req, res); }
    function getUserById(req, res) { countCall(req, res); }
    function createUser(req, res) { countCall(req, res); }
    function updateUser(req, res) { countCall(req, res); }
    function deleteUser(req, res) { countCall(req, res); }
    function getUserPosts(req, res) { countCall(req, res); }
    function getPostDetails(req, res) { countCall(req, res); }
    function duplicateHandler(req, res) { countCall(req, res); }

    // App-level middleware
    app.use(requestLogger);

    // Root routes
    app.get('/', getRoot);
    app.all('/health', (req, res) => countCall(req, res));

    // Nested API routers (3 levels: /api -> /v1 -> /users -> /:userId/posts)
    const apiRouter = express4.Router();
    const v1Router = express4.Router();
    const usersRouter = express4.Router();
    const postsRouter = express4.Router();

    // Posts routes
    postsRouter.get('/', getUserPosts);
    postsRouter.get('/:postId', getPostDetails);

    // Users routes
    usersRouter.get('/', requireAuth, listUsers);
    usersRouter.post('/', requireAuth, requireAdmin, createUser);
    usersRouter.get('/:id', requireAuth, getUserById);
    usersRouter.put('/:id', requireAuth, updateUser);
    usersRouter.delete('/:id', requireAuth, requireAdmin, deleteUser);
    usersRouter.use('/:userId/posts', postsRouter);

    // Duplicate route for detection test
    usersRouter.get('/', duplicateHandler);

    v1Router.use('/users', usersRouter);
    apiRouter.use('/v1', v1Router);
    app.use('/api', apiRouter);

    // Capture app router state before scan
    const stackLengthBefore = app._router.stack.length;

    // Scan with RouteRadar
    const radar = createRadar(app, {
      includeMiddleware: true,
      detectDuplicates: true,
      includeStats: true,
    });

    const report = radar.scan();

    // 1. Verify zero handlers/middlewares executed
    assert.equal(handlerCalls, 0, 'No handlers or middlewares should be executed during scan');

    // 2. Verify router stack was not mutated
    assert.equal(app._router.stack.length, stackLengthBefore, 'App stack length must remain unmodified');

    // 3. Verify metadata
    assert.equal(report.metadata.tool, 'RouteRadar');
    assert.equal(report.metadata.version, '1.0.0');
    assert.ok(report.metadata.scannedAt);

    // 4. Verify statistics
    assert.ok(report.statistics);
    assert.equal(report.statistics.totalRoutes, 10);
    assert.equal(report.statistics.totalEndpoints, 6);
    assert.equal(report.statistics.duplicateRoutes, 1);

    // 5. Verify routes discovered
    const paths = report.routes.map((r) => `${r.method} ${r.path}`);
    assert.ok(paths.includes('GET /'));
    assert.ok(paths.includes('ALL /health'));
    assert.ok(paths.includes('GET /api/v1/users'));
    assert.ok(paths.includes('POST /api/v1/users'));
    assert.ok(paths.includes('GET /api/v1/users/:id'));
    assert.ok(paths.includes('PUT /api/v1/users/:id'));
    assert.ok(paths.includes('DELETE /api/v1/users/:id'));
    assert.ok(paths.includes('GET /api/v1/users/:userId/posts'));
    assert.ok(paths.includes('GET /api/v1/users/:userId/posts/:postId'));

    // 6. Verify parameters
    const postDetailsRoute = report.routes.find((r) => r.path === '/api/v1/users/:userId/posts/:postId');
    assert.ok(postDetailsRoute);
    assert.deepEqual(postDetailsRoute.parameters, ['userId', 'postId']);

    // 7. Verify middleware inheritance & route middleware
    const createRoute = report.routes.find((r) => r.method === 'POST' && r.path === '/api/v1/users');
    assert.ok(createRoute);
    assert.ok(createRoute.middlewares.includes('requestLogger'));
    assert.ok(createRoute.middlewares.includes('requireAuth'));
    assert.ok(createRoute.middlewares.includes('requireAdmin'));
    assert.equal(createRoute.handler, 'createUser');

    // 8. Verify duplicate warning
    const dupWarning = report.warnings.find((w) => w.includes('/api/v1/users'));
    assert.ok(dupWarning, 'Should warn about duplicate GET /api/v1/users');

    // 9. Verify exports
    const json = radar.export('json');
    assert.ok(JSON.parse(json));

    const md = radar.export('markdown');
    assert.ok(md.includes('/api/v1/users/:userId/posts/:postId'));

    const html = radar.export('html');
    assert.ok(html.includes('createUser'));

    const cli = radar.export('terminal');
    assert.ok(cli.includes('DELETE'));
  });
});
