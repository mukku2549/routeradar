'use strict';

/**
 * Express 4 adapter.
 *
 * Express 4 does not expose a public API for enumerating routes. This adapter
 * inspects the internal routing structures of Express 4 (verified against
 * 4.21.2):
 *
 *   - The application router lives at `app._router` and exists once the first
 *     route or middleware has been registered (via lazyrouter). On a completely
 *     empty application it is undefined.
 *   - The router holds a `stack` of Layer objects. A layer with a `route`
 *     property is a route; a layer whose `handle` is a Router (has `.stack`)
 *     is a mounted router; other layers are middleware.
 *   - Express 4 layers do NOT retain the original path string. Mount paths must
 *     be reconstructed from `layer.regexp` + `layer.keys` (see pathParser).
 *   - `app.use(subApp)` wraps mounted applications in an opaque
 *     `mounted_app` closure — the sub-app reference is not reachable from the
 *     layer, so sub-applications cannot be traversed.
 *   - Express 4 installs two internal middleware layers (`query`,
 *     `expressInit`) at the top of the application router; these are not
 *     user-authored and are excluded from reports.
 */

const { reverseExpress4MountRegexp } = require('../utils/pathParser');

const INTERNAL_MIDDLEWARE = ['query', 'expressInit'];

/** True when this adapter can definitively handle the app instance. */
function detect(app) {
  if (!app || (typeof app !== 'function' && typeof app !== 'object')) {
    return false;
  }
  const desc = Object.getOwnPropertyDescriptor(app, '_router');
  if (desc && desc.value && Array.isArray(desc.value.stack)) {
    return true;
  }
  if (app._router && Array.isArray(app._router.stack)) {
    return true;
  }
  // An uninitialized Express 4 app has lazyrouter and Express application methods
  if (typeof app.lazyrouter === 'function' && typeof app.handle === 'function' && typeof app.use === 'function') {
    return true;
  }
  return false;
}

/** The application's root Router instance, or null when none exists yet. */
function getRouter(app) {
  const router = app._router;
  return router && Array.isArray(router.stack) ? router : null;
}

/** True when a layer handle is a mounted Express Router. */
function isRouterHandle(handle) {
  return Boolean(handle && Array.isArray(handle.stack));
}

/**
 * Mounted sub-applications: Express >= 4.4 wraps them in an opaque
 * `mounted_app` closure that hides the sub-app. Older 4.x versions assigned
 * the app function directly, which exposed `handle._router`.
 */
function isOpaqueMountedApp(layer) {
  return layer.name === 'mounted_app';
}

function getSubAppRouter(handle) {
  if (!handle) {
    return null;
  }
  const router = handle._router || handle.router;
  return router && Array.isArray(router.stack) ? router : null;
}

/**
 * Reconstruct the mount path of a router/middleware layer.
 * Preserves original path metadata when present; marks regexp-reconstructed
 * paths as inferred.
 * Returns { path: string | string[], inferred: boolean } or null.
 */
function mountPath(layer) {
  const original = layer.rawPath || layer.path || (layer.handle && layer.handle.mountpath);
  if (original !== undefined && original !== null) {
    return { path: original, inferred: false };
  }
  try {
    const reversed = reverseExpress4MountRegexp(layer.regexp, layer.keys);
    if (!reversed) {
      return null;
    }
    return { path: reversed.path, inferred: true };
  } catch (error) {
    return null;
  }
}

/** The registered path of a route layer: string, array of strings, or RegExp. */
function routePath(layer) {
  return layer.route ? layer.route.path : undefined;
}

module.exports = {
  id: 'express4',
  version: 4,
  framework: 'express',
  detect,
  getRouter,
  isRouterHandle,
  isOpaqueMountedApp,
  getSubAppRouter,
  mountPath,
  routePath,
  internalMiddleware: INTERNAL_MIDDLEWARE,
};
