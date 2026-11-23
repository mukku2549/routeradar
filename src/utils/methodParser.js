'use strict';

/**
 * HTTP method parsing.
 *
 * Express stores the methods of a route as a `route.methods` object whose keys
 * are lowercase method names mapped to `true`. Two special shapes exist
 * (verified against Express 4.21.2 and 5.3.0):
 *
 *  1. `app.all(path, handler)` loops over every method Express knows and calls
 *     the equivalent of `route[method](handler)` for each one. The resulting
 *     route carries one layer per method, all pointing at the same handler.
 *
 *  2. `route(path).all(handler)` registers a single layer whose
 *     `layer.method` is `undefined` and sets `route.methods._all = true`.
 *     The undefined-method layers of a route run for every registered method.
 *
 * Both shapes are normalized here into a single "ALL" method entry where no
 * specific method exists, and into per-method entries otherwise.
 */

// The full method list Express iterates for app.all() — mirrors the `methods`
// npm package Express depends on (as observed in Express 4.21.2 / 5.3.0).
const EXPRESS_METHODS = [
  'acl', 'bind', 'checkout', 'connect', 'copy', 'delete', 'get', 'head',
  'link', 'lock', 'm-search', 'merge', 'mkactivity', 'mkcalendar', 'mkcol',
  'move', 'notify', 'options', 'patch', 'post', 'propfind', 'proppatch',
  'purge', 'put', 'query', 'rebind', 'report', 'search', 'source',
  'subscribe', 'trace', 'unbind', 'unlink', 'unlock', 'unsubscribe',
];

const EXPRESS_METHOD_SET = new Set(EXPRESS_METHODS);

/**
 * Convert a route into a list of method entries.
 *
 * @param {object} route an Express Route (layer.route)
 * @returns {Array<{method: string, layers: object[], expanded: boolean}>}
 *   method is uppercase ("GET", "POST", ..., "ALL", "M-SEARCH");
 *   layers are the route.stack layers that execute for that method, in
 *   registration order; expanded=true marks collapsed app.all() routes.
 */
function routeMethodEntries(route) {
  const methods = (route && typeof route.methods === 'object' && route.methods !== null) ? route.methods : {};
  const stack = Array.isArray(route && route.stack) ? route.stack : [];

  const keys = Object.keys(methods).filter((k) => methods[k] === true || methods[k] === false);
  // Express sets keys to `true`; a `false` value means a method was
  // unregistered (rare). Only treat `true` as registered.
  const registered = keys.filter((k) => methods[k] === true);
  const hasAll = registered.includes('_all');
  const specific = registered.filter((k) => k !== '_all');

  // Shape 1: app.all() expansion — every known method registered.
  if (!hasAll && specific.length === EXPRESS_METHODS.length && specific.every((m) => EXPRESS_METHOD_SET.has(m))) {
    return [{ method: 'ALL', layers: stack, expanded: true }];
  }

  // Shape 2: route().all() only — no specific method registered.
  if (hasAll && specific.length === 0) {
    return [{ method: 'ALL', layers: stack, expanded: false }];
  }

  // Shape 3: route().all(mw).get(h)... — per-method entries; the
  // undefined-method layers run as part of every method's chain.
  const entries = [];
  for (const m of specific) {
    entries.push({
      method: m.toUpperCase(),
      layers: stack.filter((l) => l.method === m || l.method === undefined),
      expanded: false,
    });
  }
  return entries;
}

/**
 * Uppercase a method name for reporting ("get" -> "GET", "m-search" ->
 * "M-SEARCH").
 *
 * @param {string} method
 * @returns {string}
 */
function normalizeMethodName(method) {
  return String(method).toUpperCase();
}

module.exports = {
  EXPRESS_METHODS,
  routeMethodEntries,
  normalizeMethodName,
};
