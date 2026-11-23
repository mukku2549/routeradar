'use strict';

/**
 * RouteRadar
 * Inspect, analyze, and document Express.js routes automatically.
 *
 * Supports Express 4 and Express 5.
 */

const { createRadar, RouteRadar, DEFAULT_OPTIONS } = require('./core/radar');
const { resolveAdapter } = require('./adapters');

module.exports = {
  createRadar,
  RouteRadar,
  DEFAULT_OPTIONS,
  resolveAdapter,
};
