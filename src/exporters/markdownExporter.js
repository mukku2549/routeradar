'use strict';

/**
 * Markdown Exporter.
 * Generates clean GitHub Flavored Markdown (GFM) API documentation.
 */

function escapeMdTable(str) {
  if (str === null || str === undefined) {
    return '-';
  }
  return String(str).replace(/\|/g, '\\|');
}

/**
 * Export report to a clean Markdown document.
 *
 * @param {object} report RouteRadar report
 * @param {object} [options]
 * @param {string} [options.title] Custom document title
 * @returns {string} Markdown formatted string
 */
function exportMarkdown(report, options = {}) {
  const meta = report.metadata || {};
  const stats = report.statistics;
  const routes = report.routes || [];
  const warnings = report.warnings || [];

  const title = (options && options.title) || 'RouteRadar API Route Report';
  const lines = [];

  lines.push(`# ${title}\n`);
  lines.push(
    `*Generated at \`${meta.scannedAt || new Date().toISOString()}\` using [RouteRadar](https://github.com/routeradar/routeradar) v${meta.version || '1.0.0'}*\n`
  );

  // 1. Summary Statistics
  if (stats) {
    lines.push('## Summary Statistics\n');
    lines.push('| Metric | Count |');
    lines.push('| :--- | :--- |');
    lines.push(`| **Total Routes** | ${stats.totalRoutes} |`);
    lines.push(`| **Unique Endpoints** | ${stats.totalEndpoints} |`);
    lines.push(`| **Duplicate Routes** | ${stats.duplicateRoutes} |`);

    if (stats.parameterizedRoutes !== undefined) {
      lines.push(`| **Parameterized Routes** | ${stats.parameterizedRoutes} |`);
    }
    if (stats.routesWithMiddleware !== undefined) {
      lines.push(`| **Routes with Middleware** | ${stats.routesWithMiddleware} |`);
    }
    if (stats.inferredRoutes !== undefined && stats.inferredRoutes > 0) {
      lines.push(`| **Inferred Mount Paths** | ${stats.inferredRoutes} |`);
    }
    lines.push('');

    // Method breakdown table
    if (stats.methods && Object.keys(stats.methods).length > 0) {
      lines.push('### HTTP Method Distribution\n');
      lines.push('| HTTP Method | Registered Endpoints |');
      lines.push('| :--- | :--- |');
      for (const [method, count] of Object.entries(stats.methods)) {
        lines.push(`| \`${method}\` | ${count} |`);
      }
      lines.push('');
    }
  }

  // 2. Discovered Routes
  lines.push('## Discovered Routes\n');
  if (routes.length === 0) {
    lines.push('_No routes detected in this application._\n');
  } else {
    lines.push('| Method | Path | Parameters | Middlewares | Handler | Inferred |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

    for (const r of routes) {
      const methodStr = `**${escapeMdTable(r.method)}**`;
      const pathStr = `\`${escapeMdTable(r.path)}\``;

      const pList = r.params || r.parameters || [];
      const paramStr = pList.length > 0
        ? pList.map((p) => `\`:${escapeMdTable(p)}\``).join(', ')
        : '-';

      const mwList = r.middlewares || r.middleware || [];
      const mwStr = mwList.length > 0
        ? mwList.map((m) => `\`${escapeMdTable(m)}\``).join(', ')
        : '-';

      const handlerStr = r.handler ? `\`${escapeMdTable(r.handler)}\`` : '-';
      const inferredStr = r.inferred ? 'Yes' : '-';

      lines.push(`| ${methodStr} | ${pathStr} | ${paramStr} | ${mwStr} | ${handlerStr} | ${inferredStr} |`);
    }
    lines.push('');
  }

  // 3. Potential Duplicates
  const duplicateWarnings = warnings.filter((w) => w.toLowerCase().includes('duplicate'));
  if (duplicateWarnings.length > 0) {
    lines.push('## Potential Duplicate Registrations\n');
    for (const w of duplicateWarnings) {
      lines.push(`- ⚠️ **${escapeMdTable(w)}**`);
    }
    lines.push('');
  }

  // 4. Warnings & Notices
  const generalWarnings = warnings.filter((w) => !w.toLowerCase().includes('duplicate'));
  if (generalWarnings.length > 0) {
    lines.push('## Warnings & Notices\n');
    for (const w of generalWarnings) {
      lines.push(`- ⚠️ ${escapeMdTable(w)}`);
    }
    lines.push('');
  }

  // 5. Known Limitations
  lines.push('## Known Limitations\n');
  lines.push('- **Express 4 Mount Paths:** Express 4 does not retain raw path strings on mount layers; mount paths are reconstructed from compiled regex and marked as `Inferred`.');
  lines.push('- **Opaque Sub-Applications:** Sub-applications mounted with `app.use(subApp)` are wrapped in an internal closure and cannot be inspected.');
  lines.push('- **Dynamic Routes:** Conditionally registered routes added at runtime after the scan are not discovered.');
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  exportMarkdown,
};
