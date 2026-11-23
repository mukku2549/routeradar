'use strict';

/**
 * Route Statistics Engine (FR-08).
 *
 * Calculates detailed metrics for discovered API routes:
 *  - totalRoutes: total method-route registrations
 *  - totalEndpoints: count of unique normalized paths
 *  - totalUniqueEndpoints: count of unique (method, path) combinations
 *  - duplicateRoutes: number of redundant registrations (count - 1)
 *  - methods: distribution breakdown by HTTP method
 *  - parameterizedRoutes: count of routes containing dynamic parameters
 *  - routesWithMiddleware: count of routes with associated middleware
 *  - inferredRoutes: count of routes with inferred/reconstructed mount paths
 *  - warningsCount: total count of recorded scanner warnings
 */

const { normalizePath } = require('../utils/pathParser');

/**
 * Calculate route statistics.
 *
 * @param {Array<object>} routes Discovered route records
 * @param {Array<object>} [duplicates=[]] Duplicate detection results
 * @param {Array<string>} [warnings=[]] Recorded warnings
 * @returns {{
 *   totalRoutes: number,
 *   totalEndpoints: number,
 *   totalUniqueEndpoints: number,
 *   duplicateRoutes: number,
 *   methods: Record<string, number>,
 *   parameterizedRoutes: number,
 *   routesWithMiddleware: number,
 *   inferredRoutes: number,
 *   warningsCount: number
 * }}
 */
function calculateStatistics(routes = [], duplicates = [], warnings = []) {
  const safeRoutes = Array.isArray(routes) ? routes : [];
  const safeDuplicates = Array.isArray(duplicates) ? duplicates : [];
  const safeWarnings = Array.isArray(warnings) ? warnings : [];

  const uniqueEndpoints = new Set();
  const uniqueMethodEndpoints = new Set();
  const methodCounts = {};
  let parameterizedRoutes = 0;
  let routesWithMiddleware = 0;
  let inferredRoutes = 0;

  for (const route of safeRoutes) {
    const normPath = normalizePath(route.path);
    const method = String(route.method || 'UNKNOWN').toUpperCase();

    uniqueEndpoints.add(normPath);
    uniqueMethodEndpoints.add(`${method} ${normPath}`);

    methodCounts[method] = (methodCounts[method] || 0) + 1;

    const params = route.params || route.parameters || [];
    if (params.length > 0) {
      parameterizedRoutes++;
    }

    const mws = route.middleware || route.middlewares || [];
    if (mws.length > 0) {
      routesWithMiddleware++;
    }

    if (route.inferred === true) {
      inferredRoutes++;
    }
  }

  const duplicateRoutesCount = safeDuplicates.reduce(
    (acc, dup) => acc + (dup.count - 1),
    0
  );

  return {
    totalRoutes: safeRoutes.length,
    totalEndpoints: uniqueEndpoints.size,
    totalUniqueEndpoints: uniqueMethodEndpoints.size,
    duplicateRoutes: duplicateRoutesCount,
    methods: methodCounts,
    parameterizedRoutes,
    routesWithMiddleware,
    inferredRoutes,
    warningsCount: safeWarnings.length,
  };
}

module.exports = {
  calculateStatistics,
};
