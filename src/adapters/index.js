'use strict';

/**
 * Adapter resolver for Express versions.
 *
 * RouteRadar isolates Express internal inspection logic in version-specific
 * adapters. Express 4 and Express 5 have different routing internals:
 * - Express 4: uses app._router (lazily instantiated) and path-to-regexp 0.1.7 regexes.
 * - Express 5: uses app.router and stores layer.rawPath directly.
 *
 * NOTE: Express does not expose a public route enumeration API. Internal
 * inspection structures may require adapter updates across major framework releases.
 */

const express4 = require('./express4');
const express5 = require('./express5');

const ADAPTERS = [express5, express4];

/**
 * Resolve the appropriate adapter for the given Express application.
 *
 * @param {Function|object} app Express application instance
 * @returns {object} Version-specific adapter
 * @throws {TypeError} If app is not a valid object/function
 * @throws {Error} If app is an unsupported framework or Express version
 */
function resolveAdapter(app) {
  if (!app || (typeof app !== 'function' && typeof app !== 'object')) {
    throw new TypeError('RouteRadar requires a valid Express application instance.');
  }

  for (const adapter of ADAPTERS) {
    if (adapter.detect(app)) {
      return adapter;
    }
  }

  throw new Error('Unsupported framework or Express version. RouteRadar supports Express 4 and Express 5.');
}

module.exports = {
  resolveAdapter,
  adapters: {
    express4,
    express5,
  },
};
