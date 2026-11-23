'use strict';

/**
 * RouteRadar Main API.
 *
 * Provides the public interface:
 *  - createRadar(app, options)
 *  - radar.scan()
 *  - radar.getRoutes(filters)
 *  - radar.getStats()
 *  - radar.export(format, options)
 */

const { resolveAdapter } = require('../adapters');
const Scanner = require('./scanner');
const { exportReport } = require('../exporters');
const { normalizePath } = require('../utils/pathParser');
const { calculateStatistics } = require('../analyzers/statistics');
const { detectDuplicates } = require('../analyzers/duplicateDetector');

const DEFAULT_OPTIONS = {
  includeMiddleware: true,
  detectDuplicates: true,
  includeStats: true,
};

class RouteRadar {
  /**
   * Initialize a RouteRadar instance for an Express application.
   *
   * @param {object|Function} app Express application instance
   * @param {object} [options]
   * @param {boolean} [options.includeMiddleware=true]
   * @param {boolean} [options.detectDuplicates=true]
   * @param {boolean} [options.includeStats=true]
   */
  constructor(app, options = {}) {
    this.adapter = resolveAdapter(app);
    this.app = app;
    this.options = {
      includeMiddleware: options.includeMiddleware !== false,
      detectDuplicates: options.detectDuplicates !== false,
      includeStats: options.includeStats !== false,
    };
    this._lastReport = null;
  }

  /**
   * Scan registered routes and return a structured report.
   *
   * @returns {object} RouteRadar report
   */
  scan() {
    const scanner = new Scanner(this.app, this.adapter, this.options);
    this._lastReport = scanner.scan();
    return this._lastReport;
  }

  /**
   * Retrieve routes matching optional filters.
   * Scans the application if not already scanned.
   *
   * @param {object} [filters]
   * @param {string} [filters.method] HTTP method (case-insensitive)
   * @param {string|RegExp} [filters.path] Route path or regex pattern
   * @param {boolean} [filters.exactMethod=false] If true, "ALL" does not match specific methods
   * @param {boolean} [filters.prefix=false] If true and path is string, matches prefix
   * @returns {Array<object>} Filtered routes
   */
  getRoutes(filters) {
    if (!this._lastReport) {
      this.scan();
    }

    const allRoutes = this._lastReport.routes || [];

    if (!filters || typeof filters !== 'object') {
      return allRoutes.slice();
    }

    return allRoutes.filter((route) => {
      // Method filter
      if (filters.method) {
        const targetMethod = String(filters.method).toUpperCase();
        const matchesMethod =
          route.method === targetMethod ||
          (!filters.exactMethod && route.method === 'ALL');

        if (!matchesMethod) {
          return false;
        }
      }

      // Path filter
      if (filters.path !== undefined && filters.path !== null) {
        if (filters.path instanceof RegExp) {
          if (!filters.path.test(route.path)) {
            return false;
          }
        } else {
          const filterNorm = normalizePath(filters.path);
          const routeNorm = normalizePath(route.path);

          if (filters.prefix) {
            if (!routeNorm.startsWith(filterNorm)) {
              return false;
            }
          } else {
            if (routeNorm !== filterNorm) {
              return false;
            }
          }
        }
      }

      // Parameter filter
      if (typeof filters.hasParameters === 'boolean') {
        const hasParams = Boolean(route.params && route.params.length > 0);
        if (hasParams !== filters.hasParameters) {
          return false;
        }
      }

      // Middleware filter
      if (typeof filters.hasMiddleware === 'boolean') {
        const hasMw = Boolean(route.middlewares && route.middlewares.length > 0);
        if (hasMw !== filters.hasMiddleware) {
          return false;
        }
      }

      // Inferred path filter
      if (typeof filters.inferred === 'boolean') {
        if (Boolean(route.inferred) !== filters.inferred) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Retrieve route statistics.
   * Scans the application if not already scanned.
   *
   * @returns {object}
   */
  getStats() {
    if (!this._lastReport) {
      this.scan();
    }

    if (this._lastReport.statistics) {
      return this._lastReport.statistics;
    }

    // If includeStats was set to false, calculate on the fly
    const routes = this._lastReport.routes || [];
    const { duplicates } = detectDuplicates(routes);
    return calculateStatistics(routes, duplicates, this._lastReport.warnings || []);
  }

  /**
   * Export the report in JSON, Markdown, HTML or Terminal format.
   *
   * @param {string} [format='json'] 'json' | 'markdown' | 'html' | 'terminal'
   * @param {object} [options] Additional exporter options (e.g. { path: 'out.md' })
   * @returns {string} Formatted output
   */
  export(format = 'json', options = {}) {
    if (!this._lastReport) {
      this.scan();
    }
    return exportReport(this._lastReport, format, options);
  }
}

/**
 * Factory function to create a RouteRadar instance.
 *
 * @param {object|Function} app Express application instance
 * @param {object} [options]
 * @returns {RouteRadar}
 */
function createRadar(app, options) {
  return new RouteRadar(app, options);
}

module.exports = {
  createRadar,
  RouteRadar,
  DEFAULT_OPTIONS,
};
