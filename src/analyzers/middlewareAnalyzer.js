'use strict';

/**
 * Middleware Analyzer.
 *
 * Distinguishes between:
 *  - Application-level middleware (.use() at root)
 *  - Router-level middleware (.use() inside routers)
 *  - Route-level middleware (chain on route before final handler)
 *  - Final route handlers
 *  - Error-handling middleware (arity 4)
 *
 * Middleware names are informational only and never execute handlers.
 */

const ANONYMOUS_LABEL = '<anonymous>';

/**
 * Human-readable name for a middleware/handler layer.
 * Falls back to "<anonymous>" for anonymous functions.
 *
 * @param {object} layer
 * @returns {string}
 */
function layerDisplayName(layer) {
  if (layer && typeof layer.name === 'string' && layer.name.length > 0) {
    return layer.name;
  }
  if (layer && layer.handle && typeof layer.handle.name === 'string' && layer.handle.name.length > 0) {
    return layer.handle.name;
  }
  return ANONYMOUS_LABEL;
}

/**
 * Check whether a function is an Express error handler (arity 4: err, req, res, next).
 *
 * @param {Function} fn
 * @returns {boolean}
 */
function isErrorHandler(fn) {
  return Boolean(typeof fn === 'function' && fn.length === 4);
}

/**
 * Split a route's executing layer chain into middleware entries and the
 * terminal handler name.
 *
 * @param {object[]} layers route.stack layers executing for one method
 * @param {boolean} expanded true for collapsed app.all() routes
 * @returns {{ middlewares: string[], middlewareDetails: Array<{name: string, type: string, isErrorHandler: boolean}>, handler: string|null, handlers: string[] }}
 */
function analyzeRouteChain(layers, expanded) {
  const chain = Array.isArray(layers) ? layers : [];
  if (chain.length === 0) {
    return { middlewares: [], middlewareDetails: [], handler: null, handlers: [] };
  }

  let effective = chain;
  if (expanded) {
    const seen = new Set();
    effective = [];
    for (const layer of chain) {
      if (!seen.has(layer.handle)) {
        seen.add(layer.handle);
        effective.push(layer);
      }
    }
  }

  const handlerLayer = effective[effective.length - 1];
  const handlerName = layerDisplayName(handlerLayer);

  const mwLayers = effective.slice(0, -1);
  const middlewares = mwLayers.map(layerDisplayName);
  const middlewareDetails = mwLayers.map((l) => ({
    name: layerDisplayName(l),
    type: 'route',
    isErrorHandler: isErrorHandler(l.handle),
  }));

  return {
    middlewares,
    middlewareDetails,
    handler: handlerName,
    handlers: handlerName ? [handlerName] : [],
  };
}

/**
 * Filter inherited middleware entries by scope for a route's full path.
 *
 * @param {Array<{name: string, scope: string|string[], type?: string, isErrorHandler?: boolean}>} inherited
 * @param {string} fullPath
 * @returns {Array<{name: string, scope: string|string[], type: string, isErrorHandler: boolean}>}
 */
function inheritedForRoute(inherited, fullPath) {
  const matched = [];
  if (!Array.isArray(inherited)) {
    return matched;
  }

  const seenNames = new Set();
  for (const entry of inherited) {
    if (scopeMatches(entry.scope, fullPath)) {
      matched.push({
        name: entry.name,
        type: entry.type || 'application',
        isErrorHandler: Boolean(entry.isErrorHandler),
        scope: entry.scope,
      });
      seenNames.add(entry.name);
    }
  }
  return matched;
}

/**
 * Compute the combined middleware names list for a route.
 *
 * @param {boolean} includeMiddleware
 * @param {string[]|Array<{name: string}>} inherited
 * @param {string[]|Array<{name: string}>} routeLevel
 * @returns {string[]}
 */
function routeMiddlewares(includeMiddleware, inherited, routeLevel) {
  if (!includeMiddleware) {
    return [];
  }
  const inhNames = (inherited || []).map((m) => (typeof m === 'string' ? m : m.name));
  const rtNames = (routeLevel || []).map((m) => (typeof m === 'string' ? m : m.name));
  return [...inhNames, ...rtNames];
}

/**
 * Compute detailed middleware records for a route.
 *
 * @param {boolean} includeMiddleware
 * @param {Array<{name: string, type: string, isErrorHandler: boolean, scope?: string}>} inherited
 * @param {Array<{name: string, type: string, isErrorHandler: boolean}>} routeLevel
 * @param {string} [routePath='']
 * @returns {Array<{name: string, type: string, isErrorHandler: boolean, scope: string}>}
 */
function routeMiddlewareDetails(includeMiddleware, inherited, routeLevel, routePath = '') {
  if (!includeMiddleware) {
    return [];
  }
  const inhDetails = (inherited || []).map((m) => ({
    name: m.name,
    type: m.type || 'application',
    isErrorHandler: Boolean(m.isErrorHandler),
    scope: typeof m.scope === 'string' ? m.scope : '/',
  }));
  const rtDetails = (routeLevel || []).map((m) => ({
    name: m.name,
    type: m.type || 'route',
    isErrorHandler: Boolean(m.isErrorHandler),
    scope: routePath,
  }));
  return [...inhDetails, ...rtDetails];
}

function scopeMatches(scope, fullPath) {
  if (scope === '' || scope === '/') {
    return true;
  }
  const scopes = Array.isArray(scope) ? scope : [scope];
  return scopes.some((s) => isSegmentPrefix(s, fullPath));
}

function isSegmentPrefix(prefix, path) {
  if (typeof prefix !== 'string' || typeof path !== 'string' || prefix.length === 0) {
    return false;
  }
  if (prefix === path) {
    return true;
  }
  const p = prefix.endsWith('/') && prefix.length > 1 ? prefix.slice(0, -1) : prefix;
  return path.startsWith(p + '/');
}

module.exports = {
  ANONYMOUS_LABEL,
  layerDisplayName,
  isErrorHandler,
  analyzeRouteChain,
  inheritedForRoute,
  routeMiddlewares,
  routeMiddlewareDetails,
};
