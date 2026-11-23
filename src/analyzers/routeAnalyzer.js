'use strict';

/**
 * Route Analyzer.
 *
 * Extracts route entries from an Express Route layer, handling multi-path routes,
 * multi-method registrations, dynamic parameter extraction, and middleware analysis.
 */

const { joinMountPath } = require('../utils/pathParser');
const { routeMethodEntries } = require('../utils/methodParser');
const { analyzeParameters } = require('./parameterAnalyzer');
const {
  analyzeRouteChain,
  inheritedForRoute,
  routeMiddlewares,
  routeMiddlewareDetails,
} = require('./middlewareAnalyzer');

/**
 * Analyze a route layer and produce route records.
 *
 * @param {object} layer Express Route layer (has layer.route)
 * @param {string} basePath Accumulated mount path prefix
 * @param {object} options
 * @param {boolean} options.includeMiddleware
 * @param {Array<{name: string, scope: string|string[]}>} inheritedMiddlewares
 * @param {boolean} [isPathInferred=false] Whether mount path was reconstructed from regex
 * @param {string} [adapterId='express5'] Adapter id ('express4' or 'express5')
 * @returns {Array<object>}
 */
function analyzeRouteLayer(
  layer,
  basePath,
  options,
  inheritedMiddlewares,
  isPathInferred = false,
  adapterId = 'express5'
) {
  const route = layer.route;
  if (!route) {
    return [];
  }

  const rawPath = route.path;
  const paths = Array.isArray(rawPath) ? rawPath : [rawPath];
  const methodEntries = routeMethodEntries(route);
  const results = [];

  for (const p of paths) {
    let fullPath;
    let pathInferred = Boolean(isPathInferred);

    if (p instanceof RegExp) {
      fullPath = String(p);
      pathInferred = true;
    } else {
      fullPath = joinMountPath(basePath, p || '');
    }

    const parameters = analyzeParameters([basePath, p]);

    for (const entry of methodEntries) {
      const chain = analyzeRouteChain(entry.layers, entry.expanded);
      const inherited = inheritedForRoute(inheritedMiddlewares, fullPath);
      const middlewares = routeMiddlewares(
        options.includeMiddleware,
        inherited,
        chain.middlewares
      );
      const middlewareDetails = routeMiddlewareDetails(
        options.includeMiddleware,
        inherited,
        chain.middlewareDetails,
        fullPath
      );

      results.push({
        method: entry.method,
        path: fullPath,
        fullPath,
        params: parameters,
        parameters,
        middleware: middlewares,
        middlewares,
        middlewareDetails,
        handlers: chain.handlers,
        handler: chain.handler,
        inferred: pathInferred,
        source: {
          framework: 'express',
          version: adapterId === 'express4' ? 4 : 5,
        },
      });
    }
  }

  return results;
}

module.exports = {
  analyzeRouteLayer,
};
