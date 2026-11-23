'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  layerDisplayName,
  isErrorHandler,
  analyzeRouteChain,
  inheritedForRoute,
  routeMiddlewares,
  routeMiddlewareDetails,
  ANONYMOUS_LABEL,
} = require('../src/analyzers/middlewareAnalyzer');

describe('Phase 3 - Middleware Analyzer', () => {
  test('layerDisplayName returns function name or <anonymous>', () => {
    function namedMiddleware() {}
    assert.equal(layerDisplayName({ name: 'namedMiddleware' }), 'namedMiddleware');
    assert.equal(layerDisplayName({ handle: namedMiddleware }), 'namedMiddleware');
    assert.equal(layerDisplayName({ name: '' }), ANONYMOUS_LABEL);
    assert.equal(layerDisplayName({}), ANONYMOUS_LABEL);
    assert.equal(layerDisplayName(null), ANONYMOUS_LABEL);
  });

  test('isErrorHandler correctly identifies 4-argument functions', () => {
    function standardMw(req, res, next) { next(); }
    function errorHandler(err, req, res, next) { next(err); }
    assert.equal(isErrorHandler(standardMw), false);
    assert.equal(isErrorHandler(errorHandler), true);
    assert.equal(isErrorHandler(null), false);
  });

  test('analyzeRouteChain separates route middlewares and terminal handler', () => {
    function auth(req, res, next) { next(); }
    function validate(req, res, next) { next(); }
    function handleRequest(req, res) { res.send('ok'); }

    const layers = [
      { name: 'auth', handle: auth },
      { name: 'validate', handle: validate },
      { name: 'handleRequest', handle: handleRequest },
    ];

    const result = analyzeRouteChain(layers, false);

    assert.deepEqual(result.middlewares, ['auth', 'validate']);
    assert.equal(result.handler, 'handleRequest');
    assert.deepEqual(result.handlers, ['handleRequest']);
    assert.equal(result.middlewareDetails.length, 2);
    assert.equal(result.middlewareDetails[0].type, 'route');
    assert.equal(result.middlewareDetails[0].isErrorHandler, false);
  });

  test('analyzeRouteChain handles error-handling middleware in chain', () => {
    function errorCatcher(err, req, res, next) { next(err); }
    function fallbackHandler(req, res) { res.send('err'); }

    const layers = [
      { name: 'errorCatcher', handle: errorCatcher },
      { name: 'fallbackHandler', handle: fallbackHandler },
    ];

    const result = analyzeRouteChain(layers, false);

    assert.equal(result.middlewareDetails[0].name, 'errorCatcher');
    assert.equal(result.middlewareDetails[0].isErrorHandler, true);
  });

  test('inheritedForRoute filters middleware strictly by mounted scope', () => {
    const inherited = [
      { name: 'globalLogger', scope: '/', type: 'application', isErrorHandler: false },
      { name: 'adminAuth', scope: '/admin', type: 'router', isErrorHandler: false },
      { name: 'apiRateLimit', scope: '/api', type: 'router', isErrorHandler: false },
    ];

    const adminRoute = inheritedForRoute(inherited, '/admin/users');
    assert.equal(adminRoute.length, 2);
    assert.deepEqual(adminRoute.map((m) => m.name), ['globalLogger', 'adminAuth']);

    const apiRoute = inheritedForRoute(inherited, '/api/v1/posts');
    assert.equal(apiRoute.length, 2);
    assert.deepEqual(apiRoute.map((m) => m.name), ['globalLogger', 'apiRateLimit']);

    // Segment prefix check: /api does NOT match /apigateway
    const gatewayRoute = inheritedForRoute(inherited, '/apigateway/status');
    assert.equal(gatewayRoute.length, 1);
    assert.equal(gatewayRoute[0].name, 'globalLogger');
  });

  test('routeMiddlewares and routeMiddlewareDetails assemble combined records', () => {
    const inherited = [
      { name: 'appLog', type: 'application', isErrorHandler: false, scope: '/' },
    ];
    const routeLevel = [
      { name: 'routeAuth', type: 'route', isErrorHandler: false },
    ];

    const names = routeMiddlewares(true, inherited, routeLevel);
    assert.deepEqual(names, ['appLog', 'routeAuth']);

    const details = routeMiddlewareDetails(true, inherited, routeLevel, '/users');
    assert.equal(details.length, 2);
    assert.deepEqual(details[0], {
      name: 'appLog',
      type: 'application',
      isErrorHandler: false,
      scope: '/',
    });
    assert.deepEqual(details[1], {
      name: 'routeAuth',
      type: 'route',
      isErrorHandler: false,
      scope: '/users',
    });

    // When includeMiddleware is false
    assert.deepEqual(routeMiddlewares(false, inherited, routeLevel), []);
    assert.deepEqual(routeMiddlewareDetails(false, inherited, routeLevel, '/users'), []);
  });
});
