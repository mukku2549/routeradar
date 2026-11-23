'use strict';

/**
 * Terminal Exporter.
 * Generates formatted, readable CLI reports for standard terminals.
 */

const { pad } = require('../utils/formatter');

/**
 * Export report to formatted terminal string.
 *
 * @param {object} report RouteRadar report
 * @param {object} [options]
 * @returns {string}
 */
function exportTerminal(report, options = {}) {
  const meta = report.metadata || {};
  const stats = report.statistics;
  const routes = report.routes || [];
  const warnings = report.warnings || [];

  const lines = [];

  const title = (options && options.title) || `RouteRadar v${meta.version || '1.0.0'} - Express API Route Report`;

  lines.push('================================================================');
  lines.push(`  ${title}`);
  lines.push('================================================================');
  lines.push(`  Scanned at: ${meta.scannedAt || new Date().toISOString()}`);

  if (meta.framework || (routes[0] && routes[0].source)) {
    const src = (routes[0] && routes[0].source) || {};
    const fw = meta.framework || src.framework || 'express';
    const ver = src.version ? `v${src.version}` : (meta.adapter || '');
    lines.push(`  Framework:  ${fw} ${ver}`.trim());
  }

  if (stats) {
    lines.push('');
    lines.push('  STATISTICS:');
    lines.push(`    Total Routes:          ${stats.totalRoutes}`);
    lines.push(`    Unique Endpoints:      ${stats.totalEndpoints}`);
    lines.push(`    Duplicate Routes:      ${stats.duplicateRoutes}`);

    if (stats.methods && Object.keys(stats.methods).length > 0) {
      const dist = Object.entries(stats.methods)
        .map(([m, count]) => `${m}: ${count}`)
        .join(', ');
      lines.push(`    Method Distribution:   ${dist}`);
    }

    if (stats.parameterizedRoutes !== undefined) {
      lines.push(`    Parameterized Routes:  ${stats.parameterizedRoutes}`);
    }
    if (stats.routesWithMiddleware !== undefined) {
      lines.push(`    Routes with Middleware:${stats.routesWithMiddleware}`);
    }
    if (stats.inferredRoutes !== undefined && stats.inferredRoutes > 0) {
      lines.push(`    Inferred Mount Paths:  ${stats.inferredRoutes}`);
    }
  }

  lines.push('');
  lines.push('  DISCOVERED ROUTES:');

  if (routes.length === 0) {
    lines.push('    (No routes detected)');
  } else {
    // Dynamic column widths based on actual data
    const colMethod = Math.max(8, ...routes.map((r) => String(r.method || '').length + 2));
    const colPath = Math.max(26, ...routes.map((r) => String(r.path || '').length + 2));
    const colParams = Math.max(10, ...routes.map((r) => {
      const p = r.params || r.parameters || [];
      return (p.length > 0 ? p.map((x) => `:${x}`).join(',') : '-').length + 2;
    }));
    const colHandler = Math.max(16, ...routes.map((r) => String(r.handler || '-').length + 2));

    const header = '  ' +
      pad('METHOD', colMethod) +
      pad('PATH', colPath) +
      pad('PARAMS', colParams) +
      pad('HANDLER', colHandler) +
      'MIDDLEWARES';

    lines.push(header);
    lines.push('  ' + '-'.repeat(Math.min(100, header.length + 12)));

    for (const r of routes) {
      const methodStr = pad(r.method, colMethod);
      const inferredMark = r.inferred ? '*' : '';
      const pathStr = pad((r.path || '/') + inferredMark, colPath);

      const paramsList = r.params || r.parameters || [];
      const paramsStr = pad(paramsList.length > 0 ? paramsList.map((x) => `:${x}`).join(',') : '-', colParams);

      const handlerStr = pad(r.handler || '-', colHandler);

      const mwList = r.middlewares || r.middleware || [];
      const mwStr = mwList.length > 0 ? mwList.join(', ') : '-';

      lines.push(`  ${methodStr}${pathStr}${paramsStr}${handlerStr}${mwStr}`);
    }

    if (routes.some((r) => r.inferred)) {
      lines.push('');
      lines.push('  (*) Inferred mount path reconstructed from layer regex (Express 4).');
    }
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('  WARNINGS:');
    for (const w of warnings) {
      lines.push(`    ⚠️  ${w}`);
    }
  }

  lines.push('');
  lines.push('================================================================');

  return lines.join('\n');
}

module.exports = {
  exportTerminal,
};
