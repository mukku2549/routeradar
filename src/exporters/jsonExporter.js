'use strict';

/**
 * JSON Exporter.
 * Generates structured, deterministic, parseable JSON route reports.
 */

/**
 * Export report to a JSON string.
 *
 * @param {object} report RouteRadar report
 * @param {object} [options]
 * @param {boolean} [options.pretty=true] Pretty-print JSON with 2-space indentation
 * @returns {string} JSON formatted string
 */
function exportJson(report, options = {}) {
  const pretty = options.pretty !== false;

  // Build a clean, deterministically structured object free of circular references or function objects
  const meta = report.metadata || {};
  const stats = report.statistics || null;
  const rawRoutes = Array.isArray(report.routes) ? report.routes : [];
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];

  const cleanRoutes = rawRoutes.map((r) => ({
    method: String(r.method || 'GET'),
    path: String(r.path || '/'),
    fullPath: String(r.fullPath || r.path || '/'),
    params: Array.isArray(r.params || r.parameters) ? (r.params || r.parameters).slice() : [],
    parameters: Array.isArray(r.parameters || r.params) ? (r.parameters || r.params).slice() : [],
    middleware: Array.isArray(r.middleware || r.middlewares) ? (r.middleware || r.middlewares).slice() : [],
    middlewares: Array.isArray(r.middlewares || r.middleware) ? (r.middlewares || r.middleware).slice() : [],
    middlewareDetails: Array.isArray(r.middlewareDetails)
      ? r.middlewareDetails.map((m) => ({
          name: String(m.name || '<anonymous>'),
          type: String(m.type || 'route'),
          isErrorHandler: Boolean(m.isErrorHandler),
          scope: String(m.scope || '/'),
        }))
      : [],
    handlers: Array.isArray(r.handlers) ? r.handlers.slice() : (r.handler ? [String(r.handler)] : []),
    handler: r.handler ? String(r.handler) : (r.handlers && r.handlers[0] ? String(r.handlers[0]) : null),
    inferred: Boolean(r.inferred),
    source: r.source && typeof r.source === 'object'
      ? {
          framework: String(r.source.framework || 'express'),
          version: typeof r.source.version === 'number' ? r.source.version : 5,
        }
      : { framework: 'express', version: 5 },
  }));

  const cleanReport = {
    metadata: {
      tool: String(meta.tool || 'RouteRadar'),
      version: String(meta.version || '1.0.0'),
      scannedAt: String(meta.scannedAt || new Date().toISOString()),
      framework: String(meta.framework || 'express'),
      frameworkVersion: typeof meta.frameworkVersion === 'number' ? meta.frameworkVersion : 5,
    },
  };

  if (Array.isArray(report.duplicates)) {
    cleanReport.duplicates = report.duplicates.map((d) => ({
      method: String(d.method || ''),
      path: String(d.path || ''),
      normalizedPath: String(d.normalizedPath || d.path || ''),
      count: Number(d.count || 2),
    }));
  }

  if (stats) {
    cleanReport.statistics = {
      totalRoutes: stats.totalRoutes || 0,
      totalEndpoints: stats.totalEndpoints || 0,
      duplicateRoutes: stats.duplicateRoutes || 0,
    };

    if (stats.totalUniqueEndpoints !== undefined) {
      cleanReport.statistics.totalUniqueEndpoints = stats.totalUniqueEndpoints;
    }
    if (stats.methods) {
      cleanReport.statistics.methods = Object.assign({}, stats.methods);
    }
    if (stats.parameterizedRoutes !== undefined) {
      cleanReport.statistics.parameterizedRoutes = stats.parameterizedRoutes;
    }
    if (stats.routesWithMiddleware !== undefined) {
      cleanReport.statistics.routesWithMiddleware = stats.routesWithMiddleware;
    }
    if (stats.inferredRoutes !== undefined) {
      cleanReport.statistics.inferredRoutes = stats.inferredRoutes;
    }
    if (stats.warningsCount !== undefined) {
      cleanReport.statistics.warningsCount = stats.warningsCount;
    }
  }

  cleanReport.routes = cleanRoutes;
  cleanReport.warnings = warnings.map((w) => String(w));

  return JSON.stringify(cleanReport, null, pretty ? 2 : 0);
}

module.exports = {
  exportJson,
};
