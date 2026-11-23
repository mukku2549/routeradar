'use strict';

/**
 * Exporter dispatcher.
 */

const fs = require('fs');
const path = require('path');
const { exportJson } = require('./jsonExporter');
const { exportMarkdown } = require('./markdownExporter');
const { exportHtml } = require('./htmlExporter');
const { exportTerminal } = require('./terminalExporter');

const FORMATTERS = {
  json: exportJson,
  markdown: exportMarkdown,
  md: exportMarkdown,
  html: exportHtml,
  terminal: exportTerminal,
  cli: exportTerminal,
  text: exportTerminal,
};

/**
 * Export a RouteRadar report to the specified format.
 *
 * @param {object} report RouteRadar report
 * @param {string} format 'json' | 'markdown' | 'html' | 'terminal'
 * @param {object} [options]
 * @param {string} [options.path] Optional output file path
 * @param {boolean} [options.pretty=true] For JSON output
 * @returns {string} Formatted output
 */
function exportReport(report, format, options = {}) {
  const normFormat = String(format || 'json').toLowerCase().trim();
  const exporter = FORMATTERS[normFormat];

  if (!exporter) {
    const supported = ['json', 'markdown', 'html', 'terminal'].join(', ');
    throw new Error(`Unsupported export format '${format}'. Supported formats: ${supported}`);
  }

  const content = exporter(report, options);

  if (options && options.path) {
    const fullPath = path.resolve(process.cwd(), options.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return content;
}

module.exports = {
  exportReport,
  exportJson,
  exportMarkdown,
  exportHtml,
  exportTerminal,
  FORMATTERS,
};
