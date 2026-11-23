'use strict';

/**
 * RouteRadar Scanner.
 *
 * Coordinates Express application route inspection:
 * - Traverses route stack safely and recursively
 * - Detects mounted routers across multiple nesting levels
 * - Protects against circular router references
 * - Never executes handlers or middleware
 * - Never mutates the application or router state
 */

const { joinMountPath } = require('../utils/pathParser');
const { layerDisplayName } = require('../analyzers/middlewareAnalyzer');
const { analyzeRouteLayer } = require('../analyzers/routeAnalyzer');
const { detectDuplicates } = require('../analyzers/duplicateDetector');
const { calculateStatistics } = require('../analyzers/statistics');

const PACKAGE_VERSION = '1.0.0';
const MAX_TRAVERSAL_DEPTH = 50;

class Scanner {
  /**
   * @param {object|Function} app Express application instance
   * @param {object} adapter Version-specific adapter (express4 or express5)
   * @param {object} [options]
   */
  constructor(app, adapter, options = {}) {
    this.app = app;
    this.adapter = adapter;
    this.options = {
      includeMiddleware: options.includeMiddleware !== false,
      detectDuplicates: options.detectDuplicates !== false,
      includeStats: options.includeStats !== false,
    };
  }

  /**
   * Perform route scanning.
   *
   * @returns {object} RouteRadar report
   */
  scan() {
    const metadata = {
      tool: 'RouteRadar',
      version: PACKAGE_VERSION,
      scannedAt: new Date().toISOString(),
      framework: 'express',
      frameworkVersion: this.adapter.version,
    };

    const routes = [];
    const warnings = [];

    const rootRouter = this.adapter.getRouter(this.app);

    if (rootRouter && Array.isArray(rootRouter.stack)) {
      const activeAncestors = new Set();
      this._traverseRouter(rootRouter, '', [], activeAncestors, routes, warnings, 0, false);
    }

    let duplicates = [];
    if (this.options.detectDuplicates) {
      const dupResult = detectDuplicates(routes);
      duplicates = dupResult.duplicates;
      warnings.push(...dupResult.warnings);
    }

    let statistics = null;
    if (this.options.includeStats) {
      statistics = calculateStatistics(routes, duplicates, warnings);
    }

    const report = {
      metadata,
    };

    if (this.options.includeStats) {
      report.statistics = statistics;
      report.stats = statistics;
    }

    if (this.options.detectDuplicates) {
      report.duplicates = duplicates;
    }

    report.routes = routes;
    report.warnings = warnings;

    return report;
  }

  /**
   * Recursively traverse an Express Router stack.
   *
   * @private
   */
  _traverseRouter(router, basePath, inheritedMiddlewares, activeAncestors, routes, warnings, depth, isPathInferred = false) {
    if (depth > MAX_TRAVERSAL_DEPTH) {
      warnings.push(`Maximum router traversal depth (${MAX_TRAVERSAL_DEPTH}) exceeded at mount path '${basePath || '/'}'`);
      return;
    }

    if (activeAncestors.has(router)) {
      warnings.push(`Circular router reference detected at mount path '${basePath || '/'}'`);
      return;
    }

    activeAncestors.add(router);

    const currentMiddlewares = [...inheritedMiddlewares];
    const stack = Array.isArray(router.stack) ? router.stack : [];

    for (const layer of stack) {
      if (!layer) {
        continue;
      }

      // Case 1: Route layer
      if (layer.route) {
        const routeRecords = analyzeRouteLayer(
          layer,
          basePath,
          this.options,
          currentMiddlewares,
          isPathInferred,
          this.adapter.id
        );
        routes.push(...routeRecords);
        continue;
      }

      // Case 2: Mounted router
      if (this.adapter.isRouterHandle(layer.handle)) {
        const mount = this.adapter.mountPath(layer);
        if (!mount) {
          warnings.push(`Could not determine mount path for router at '${basePath || '/'}'`);
          continue;
        }

        const childInferred = Boolean(isPathInferred || mount.inferred);
        const mountPaths = Array.isArray(mount.path) ? mount.path : [mount.path];
        for (const mPath of mountPaths) {
          const nextBasePath = joinMountPath(basePath, mPath || '');
          this._traverseRouter(
            layer.handle,
            nextBasePath,
            currentMiddlewares,
            activeAncestors,
            routes,
            warnings,
            depth + 1,
            childInferred
          );
        }
        continue;
      }

      // Case 3: Opaque mounted sub-application
      if (this.adapter.isOpaqueMountedApp(layer)) {
        const mount = this.adapter.mountPath(layer);
        const subPath = mount && mount.path ? joinMountPath(basePath, mount.path) : (basePath || '/');
        warnings.push(
          `Mounted sub-application detected at '${subPath}'. Express wraps sub-apps in an opaque closure; routes inside sub-applications cannot be traversed via route stack.`
        );
        continue;
      }

      // Case 4: Internal Express middleware (e.g., query, expressInit in Express 4)
      if (this.adapter.internalMiddleware && this.adapter.internalMiddleware.includes(layer.name)) {
        continue;
      }

      // Case 5: User-level middleware (.use(fn) or .use('/path', fn))
      const mwMount = this.adapter.mountPath(layer);
      let mwScope = basePath;
      if (mwMount && mwMount.path !== undefined && mwMount.path !== null && mwMount.path !== '') {
        if (Array.isArray(mwMount.path)) {
          mwScope = mwMount.path.map((p) => joinMountPath(basePath, p));
        } else {
          mwScope = joinMountPath(basePath, mwMount.path);
        }
      }

      const isAppLevel = depth === 0;
      const isErrorHandler = Boolean(layer.handle && layer.handle.length === 4);

      currentMiddlewares.push({
        name: layerDisplayName(layer),
        scope: mwScope,
        type: isAppLevel ? 'application' : 'router',
        isErrorHandler,
      });
    }

    activeAncestors.delete(router);
  }
}

module.exports = Scanner;
