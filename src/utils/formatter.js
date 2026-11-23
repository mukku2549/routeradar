'use strict';

/**
 * Text and HTML formatting utilities.
 */

/**
 * Safely escape characters for HTML output.
 * Prevents HTML injection in exported reports.
 *
 * @param {any} val
 * @returns {string}
 */
function escapeHtml(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pad a string to a given width for column formatting.
 *
 * @param {string} str
 * @param {number} width
 * @param {'left'|'right'} [align='left']
 * @returns {string}
 */
function pad(str, width, align = 'left') {
  const s = String(str || '');
  if (s.length >= width) {
    return s;
  }
  const padding = ' '.repeat(width - s.length);
  return align === 'right' ? padding + s : s + padding;
}

/**
 * Strip ANSI color codes from a string.
 *
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  if (typeof str !== 'string') {
    return '';
  }
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

module.exports = {
  escapeHtml,
  pad,
  stripAnsi,
};
