'use strict';

/**
 * HTML Exporter.
 * Generates a self-contained, standalone, responsive HTML report.
 * Works completely offline with zero external dependencies (no external CSS, fonts, or JS).
 * All user text is escaped to prevent XSS.
 */

const { escapeHtml } = require('../utils/formatter');

const METHOD_COLORS = {
  GET: { bg: '#e6f4ea', text: '#137333', border: '#ceead6' },
  POST: { bg: '#e8f0fe', text: '#1a73e8', border: '#d2e3fc' },
  PUT: { bg: '#fef7e0', text: '#b06000', border: '#feefc3' },
  PATCH: { bg: '#e0f2f1', text: '#00796b', border: '#b2dfdb' },
  DELETE: { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf' },
  OPTIONS: { bg: '#f3e8fd', text: '#7627bb', border: '#e9d2fd' },
  HEAD: { bg: '#f1f3f4', text: '#5f6368', border: '#dadce0' },
  ALL: { bg: '#ede7f6', text: '#512da8', border: '#d1c4e9' },
};

function getBadgeStyle(method) {
  const m = String(method || '').toUpperCase();
  const c = METHOD_COLORS[m] || { bg: '#f1f3f4', text: '#3c4043', border: '#dadce0' };
  return `background-color: ${c.bg}; color: ${c.text}; border: 1px solid ${c.border};`;
}

/**
 * Export report to a standalone HTML string.
 *
 * @param {object} report RouteRadar report
 * @param {object} [options]
 * @param {string} [options.title] Optional report title
 * @returns {string} Standalone HTML document
 */
function exportHtml(report, options = {}) {
  const meta = report.metadata || {};
  const stats = report.statistics;
  const routes = report.routes || [];
  const warnings = report.warnings || [];

  const title = (options && options.title) || 'RouteRadar &bull; Express API Routes';
  const scannedAt = meta.scannedAt ? new Date(meta.scannedAt).toUTCString() : new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --bg: #f8f9fa;
      --surface: #ffffff;
      --text: #202124;
      --text-muted: #5f6368;
      --border: #dadce0;
      --primary: #1a73e8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 16px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-radar {
      background-color: var(--primary);
      color: #fff;
      font-size: 13px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .meta-subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .stat-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      margin-top: 4px;
    }
    .stat-card.alert .stat-value {
      color: #c5221f;
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      margin-bottom: 24px;
    }
    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background-color: #fafafa;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-header h2 {
      font-size: 17px;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
    }
    th {
      background-color: #f1f3f4;
      color: var(--text-muted);
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background-color: #f8f9fa;
    }
    .method-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.5px;
    }
    .path-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #1a73e8;
    }
    .pill {
      display: inline-block;
      background: #f1f3f4;
      color: #3c4043;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      margin-right: 4px;
      margin-bottom: 2px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .pill.inferred {
      background-color: #fff3e0;
      color: #b06000;
      border: 1px solid #ffe0b2;
      font-weight: 600;
    }
    .handler-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #374151;
    }
    .warnings-panel {
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .warnings-panel h3 {
      font-size: 15px;
      color: #b06000;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .warnings-panel ul {
      margin-left: 20px;
      color: #795548;
      font-size: 14px;
    }
    footer {
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>RouteRadar <span class="badge-radar">v${escapeHtml(meta.version || '1.0.0')}</span></h1>
      <p class="meta-subtitle">Scanned at ${escapeHtml(scannedAt)}</p>
    </header>

    ${stats ? `
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">Total Routes</div>
        <div class="stat-value">${escapeHtml(stats.totalRoutes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Unique Endpoints</div>
        <div class="stat-value">${escapeHtml(stats.totalEndpoints)}</div>
      </div>
      <div class="stat-card ${stats.duplicateRoutes > 0 ? 'alert' : ''}">
        <div class="stat-title">Duplicate Routes</div>
        <div class="stat-value">${escapeHtml(stats.duplicateRoutes)}</div>
      </div>
      ${stats.parameterizedRoutes !== undefined ? `
      <div class="stat-card">
        <div class="stat-title">Parameterized Routes</div>
        <div class="stat-value">${escapeHtml(stats.parameterizedRoutes)}</div>
      </div>` : ''}
      ${stats.routesWithMiddleware !== undefined ? `
      <div class="stat-card">
        <div class="stat-title">With Middleware</div>
        <div class="stat-value">${escapeHtml(stats.routesWithMiddleware)}</div>
      </div>` : ''}
    </section>
    ` : ''}

    ${warnings.length > 0 ? `
    <section class="warnings-panel">
      <h3>⚠️ Warnings & Notices (${warnings.length})</h3>
      <ul>
        ${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}
      </ul>
    </section>
    ` : ''}

    <section class="panel">
      <div class="panel-header">
        <h2>Registered Routes (${routes.length})</h2>
      </div>
      ${routes.length === 0 ? `
      <p style="padding: 24px; color: var(--text-muted); text-align: center;">No routes were detected in this application.</p>
      ` : `
      <table>
        <thead>
          <tr>
            <th style="width: 100px;">Method</th>
            <th>Path</th>
            <th>Parameters</th>
            <th>Middlewares</th>
            <th>Handler</th>
            <th>Inferred</th>
          </tr>
        </thead>
        <tbody>
          ${routes.map((r) => `
          <tr>
            <td><span class="method-badge" style="${getBadgeStyle(r.method)}">${escapeHtml(r.method)}</span></td>
            <td><span class="path-code">${escapeHtml(r.path)}</span></td>
            <td>
              ${(r.params || r.parameters) && (r.params || r.parameters).length > 0
                ? (r.params || r.parameters).map((p) => `<span class="pill">:${escapeHtml(p)}</span>`).join('')
                : '<span style="color: #9aa0a6;">—</span>'}
            </td>
            <td>
              ${(r.middlewares || r.middleware) && (r.middlewares || r.middleware).length > 0
                ? (r.middlewares || r.middleware).map((m) => `<span class="pill">${escapeHtml(m)}</span>`).join('')
                : '<span style="color: #9aa0a6;">—</span>'}
            </td>
            <td>
              ${r.handler
                ? `<span class="handler-name">${escapeHtml(r.handler)}</span>`
                : '<span style="color: #9aa0a6;">—</span>'}
            </td>
            <td>
              ${r.inferred
                ? '<span class="pill inferred">Inferred</span>'
                : '<span style="color: #9aa0a6;">—</span>'}
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </section>

    <footer>
      Generated with <strong>RouteRadar</strong> &bull; Production Route Discovery for Express.js
    </footer>
  </div>
</body>
</html>`;
}

module.exports = {
  exportHtml,
};
