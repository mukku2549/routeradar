'use strict';

/**
 * Route parameter analysis (FR-06).
 *
 * Parameters are extracted from the reconstructed full path (mount prefixes +
 * route path) in original appearance order.
 *
 * Supported forms:
 *   - Standard named parameters: /users/:id, /users/:slug
 *   - Multiple parameters: /orgs/:orgId/projects/:projectId
 *   - Express 4 optional parameters: /users/:id?
 *   - Express 5 grouped optional syntax: /users{/:id}
 *   - Express 5 named wildcards: /files/*splat
 *   - Custom constraint prefixes: /files/:name([0-9]+)
 *
 * Unnamed wildcards (Express 4 "*") are positional in Express (req.params['0'])
 * and are not named parameters.
 */

const { extractPathParams } = require('../utils/pathParser');

/**
 * Extract parameter names from one or more route path elements.
 *
 * @param {string|string[]|Array<string|string[]>} fullPathElements
 * @returns {string[]} Parameter names in appearance order (unique)
 */
function analyzeParameters(fullPathElements) {
  const params = [];

  function processElement(element) {
    if (!element) {
      return;
    }
    if (Array.isArray(element)) {
      for (const item of element) {
        processElement(item);
      }
      return;
    }
    if (typeof element !== 'string') {
      return; // RegExp or non-string paths have no extractable named parameters
    }

    const extracted = extractPathParams(element);
    for (const name of extracted) {
      if (!params.includes(name)) {
        params.push(name);
      }
    }
  }

  processElement(fullPathElements);
  return params;
}

module.exports = {
  analyzeParameters,
  extractPathParams,
};
