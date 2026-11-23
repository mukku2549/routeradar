'use strict';

/**
 * Duplicate Route Detector (FR-07).
 *
 * Compares discovered routes by HTTP method and normalized path.
 *
 * Requirements:
 * - Multiple handlers inside one route registration are part of the same
 *   execution chain and are NOT classified as duplicates.
 * - Distinct route registrations that share the same HTTP method and
 *   normalized path are flagged as potential duplicates.
 * - Different HTTP methods on the same path (e.g. GET /users vs POST /users)
 *   are legitimate separate endpoints and are never duplicates.
 * - Routes are never merged or mutated.
 */

const { normalizePath } = require('../utils/pathParser');

/**
 * Detect potential duplicate routes.
 *
 * @param {Array<object>} routes Discovered route records
 * @returns {{
 *   duplicates: Array<{
 *     method: string,
 *     path: string,
 *     count: number,
 *     handlers: Array<string|null>,
 *     explanation: string,
 *     registrations: Array<object>
 *   }>,
 *   warnings: string[]
 * }}
 */
function detectDuplicates(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return { duplicates: [], warnings: [] };
  }

  const groups = new Map();

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const normPath = normalizePath(route.path);
    const method = String(route.method || 'UNKNOWN').toUpperCase();
    const key = `${method} ${normPath}`;

    if (!groups.has(key)) {
      groups.set(key, {
        method,
        path: normPath,
        routes: [],
      });
    }

    groups.get(key).routes.push({
      registrationIndex: i + 1,
      route,
    });
  }

  const duplicates = [];
  const warnings = [];

  for (const group of groups.values()) {
    if (group.routes.length > 1) {
      const handlers = group.routes.map((entry) => entry.route.handler || '<anonymous>');
      const explanation = `Method '${group.method}' on path '${group.path}' was registered ${group.routes.length} distinct times.`;

      duplicates.push({
        method: group.method,
        path: group.path,
        count: group.routes.length,
        handlers,
        explanation,
        registrations: group.routes.map((entry) => ({
          registrationIndex: entry.registrationIndex,
          method: entry.route.method,
          path: entry.route.path,
          handler: entry.route.handler || '<anonymous>',
          inferred: Boolean(entry.route.inferred),
        })),
      });

      warnings.push(
        `Potential duplicate route: ${group.method} ${group.path} (${group.routes.length} registrations)`
      );
    }
  }

  return { duplicates, warnings };
}

module.exports = {
  detectDuplicates,
};
