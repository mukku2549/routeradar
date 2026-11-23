'use strict';

/**
 * Express 5 adapter.
 *
 * Express 5 (verified against 5.3.0) reorganized its routing internals:
 *
 *   - The application router is exposed at `app.router`. Reading it on an
 *     application with no routes yet initializes the router (the same state
 *     Express reaches on the first registration); `app._router` never exists.
 *     Note: `app.router` is undocumented-adjacent API but stable in 5.x.
 *   - Since 5.1 the router lives in the standalone `router` npm package, but
 *     the layer/route structure is unchanged: `router.stack` of layers,
 *     `layer.route` for routes.
 *   - Layers retain the original path in `layer.rawPath` (string, array, or
 *     RegExp instance), so no regexp reverse-engineering is needed. Mount
 *     paths are read directly.
 *   - Express 5 uses path-to-regexp 8.x: `:id?` optional syntax is invalid
 *     (use `{/:id}`), wildcards must be named (`*splat`), and custom inline
 *     constraints are unsupported.
 *   - `app.use(subApp)` also wraps sub-applications in an opaque
 *     `mounted_app` closure, so sub-app internals are not traversable.
 *   - Express 5 does not add internal middleware layers to the router.
 */

const INTERNAL_MIDDLEWARE = [];

/** True when this adapter can definitively handle the app instance without mutating it. */
function detect(app) {
  if (!app || (typeof app !== 'function' && typeof app !== 'object')) {
    return false;
  }
  // Exclude Express 4 apps which define lazyrouter
  if (typeof app.lazyrouter === 'function') {
    return false;
  }
  // Check property descriptor WITHOUT invoking the router getter
  const desc = Object.getOwnPropertyDescriptor(app, 'router');
  if (desc && desc.value && Array.isArray(desc.value.stack)) {
    return true;
  }
  // Express 5 defines `router` as a lazy getter on the application
  if (desc && typeof desc.get === 'function' && typeof app.handle === 'function') {
    return true;
  }
  return false;
}

/**
 * The application's root Router instance, or null when none exists yet.
 * Uses a non-mutating probe to avoid triggering router initialization on empty apps.
 */
function getRouter(app) {
  const desc = Object.getOwnPropertyDescriptor(app, 'router');
  if (!desc) {
    return null;
  }
  if (desc.value && Array.isArray(desc.value.stack)) {
    return desc.value;
  }
  if (typeof desc.get !== 'function') {
    return null;
  }
  // Non-mutating probe: if router is null in the closure, calling desc.get with a
  // throwing probe prevents 'router = new Router(...)' from executing.
  const probe = {
    enabled: () => { throw new Error('EXPRESS5_UNINITIALIZED_ROUTER'); }
  };
  try {
    const router = desc.get.call(probe);
    return router && Array.isArray(router.stack) ? router : null;
  } catch (error) {
    if (error && error.message === 'EXPRESS5_UNINITIALIZED_ROUTER') {
      return null; // Empty uninitialized app
    }
    return null;
  }
}

/** True when a layer handle is a mounted Express Router. */
function isRouterHandle(handle) {
  return Boolean(handle && Array.isArray(handle.stack));
}

/** Express 5 also wraps mounted sub-applications in an opaque closure. */
function isOpaqueMountedApp(layer) {
  return layer.name === 'mounted_app';
}

function getSubAppRouter(handle) {
  if (!handle) {
    return null;
  }
  const router = handle.router;
  return router && Array.isArray(router.stack) ? router : null;
}

/**
 * Read the mount path from `layer.rawPath`.
 * Returns { path: string | string[] } or null when the shape is unusable.
 */
function mountPath(layer) {
  const raw = layer.rawPath !== undefined ? layer.rawPath : layer.path;
  if (raw === undefined || raw === null) {
    return null;
  }
  if (Array.isArray(raw)) {
    return { path: raw.map((p) => mountPathValueToString(p)), inferred: false };
  }
  return { path: mountPathValueToString(raw), inferred: false };
}

function mountPathValueToString(value) {
  if (value instanceof RegExp) {
    return String(value);
  }
  return String(value);
}

/** The registered path of a route layer: string, array of strings, or RegExp. */
function routePath(layer) {
  return layer.route ? layer.route.path : undefined;
}

module.exports = {
  id: 'express5',
  version: 5,
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
