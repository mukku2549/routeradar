'use strict';

/**
 * Path parsing utilities.
 *
 * Two jobs:
 *  1. Extract named route parameters from path strings in the syntaxes that
 *     Express 4 (path-to-regexp 0.1.7) and Express 5 (path-to-regexp 8.x)
 *     accept.
 *  2. Reconstruct the mount path of an Express 4 "use" layer from its compiled
 *     regular expression. Express 4 does not keep the original path string on
 *     the layer, so the only recoverable source is `layer.regexp` together with
 *     `layer.keys`.
 *
 * The reverse-mapping targets the exact regexp shapes produced by
 * path-to-regexp 0.1.7 for `use` layers (end=false, strict=false), verified
 * against Express 4.21.2. If a regexp does not match a known shape, the
 * function returns null and the scanner emits a warning instead of guessing.
 */

const NAMED_TOKEN = /[:*]([A-Za-z0-9_]+)/g;

/**
 * Extract named parameters from a route/mount path string, in order of
 * appearance.
 *
 * Supported forms:
 *   Express 4: /users/:id, /users/:id?, /users/:id*, /users/:id+,
 *              /files/:name([0-9]+) (custom constraints),
 *              inline prefixes such as /api/v:version
 *   Express 5: /users/:id, /users{/:id} (optional groups), /files/*splat
 *              (named wildcards)
 *
 * Unnamed wildcards (Express 4 "*") are positional in Express (req.params['0'])
 * and are intentionally NOT returned as named parameters.
 *
 * @param {string} path route or mount path
 * @returns {string[]} parameter names in their original order (unique)
 */
function extractPathParams(path) {
  const params = [];
  if (typeof path !== 'string' || path.length === 0) {
    return params;
  }

  let match;
  NAMED_TOKEN.lastIndex = 0;
  while ((match = NAMED_TOKEN.exec(path)) !== null) {
    // For ":name(...)" custom constraints (Express 4), skip the constraint
    // body so patterns like ":id(https?:...)" do not leak inner tokens.
    let suffixIndex = match.index + match[0].length;
    if (path[suffixIndex] === '(') {
      const closing = findMatchingParen(path, suffixIndex);
      if (closing !== -1) {
        NAMED_TOKEN.lastIndex = closing + 1;
      }
    }
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }
  return params;
}

/** Index of the ")" balancing the "(" at `start`, or -1. */
function findMatchingParen(str, start) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      i++; // skip escaped character
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Normalize a path for duplicate detection and statistics.
 *
 * Express matches case-insensitively (caseSensitive defaults to false) and
 * treats "/path" and "/path/" identically when `strict` is false, so both are
 * folded here. Internal segments are preserved verbatim.
 *
 * @param {string|RegExp} path
 * @returns {string}
 */
function normalizePath(path) {
  if (path instanceof RegExp) {
    return String(path);
  }
  let out = String(path).trim();
  if (out.length === 0) {
    return '/';
  }
  out = out.toLowerCase();
  if (out.length > 1) {
    out = out.replace(/\/+$/, '');
  }
  return out.length === 0 ? '/' : out;
}

/**
 * Join a mount prefix and a child path, preserving parameter tokens.
 * "" and "/" prefixes/pass-throughs are treated as root.
 *
 * @param {string} base mount path prefix ("" or "/..." )
 * @param {string} child route or nested mount path
 * @returns {string}
 */
function joinMountPath(base, child) {
  const b = normalizeBase(base);
  const c = String(child);
  if (c === '/' || c === '') {
    return b === '' ? '/' : b;
  }
  const childPart = c.startsWith('/') ? c : '/' + c;
  return b === '' ? childPart : b + childPart;
}

/** Normalize a mount prefix: "/" and "" both become "". */
function normalizeBase(base) {
  if (base === undefined || base === null || base === '' || base === '/') {
    return '';
  }
  let b = String(base);
  if (!b.startsWith('/')) {
    b = '/' + b;
  }
  if (b.length > 1) {
    b = b.replace(/\/+$/, '');
  }
  return b;
}

/**
 * Reconstruct the original mount path of an Express 4 "use" layer.
 *
 * path-to-regexp 0.1.7 compiles "use" layers (end=false, strict=false) into
 * shapes such as:
 *   '/users'              -> ^\/users\/?(?=\/|$)
 *   '/users/:id'          -> ^\/users(?:\/([^/]+?))\/?(?=\/|$)      keys: [id]
 *   '/api/v:version'      -> ^\/api\/v(?:((?:(?!\/|\/api\/v).)+?))\/?(?=\/|$)
 *   '/opt/:id?'           -> ^\/opt(?:\/([^/]+?))?\/?(?=\/|$)
 *   '/x/:id(\d+)'         -> ^\/x(?:\/(\d+))\/?(?=\/|$)
 *   '/files/*'            -> ^\/files\/(.*)\/?(?=\/|$)              keys: [0]
 *   ['/a', '/b']          -> ^\/a\/?(?=\/|$)|^\/b\/?(?=\/|$)
 *   '/'                   -> fast_slash flag, empty path
 *
 * Custom constraints and wildcard internals are simplified (the constraint
 * body is dropped, "*" is reported as "*"), which is enough for documentation
 * purposes. Returns null when the regexp does not match a known shape.
 *
 * @param {RegExp} regexp layer.regexp
 * @param {Array<{name: string|number}>} keys layer.keys
 * @returns {{ path: string | string[] } | null}
 */
function reverseExpress4MountRegexp(regexp, keys) {
  if (!regexp || regexp instanceof RegExp === false) {
    return null;
  }
  if (regexp.fast_slash === true) {
    return { path: '' };
  }
  if (typeof regexp.source !== 'string') {
    return null;
  }

  const keyNames = Array.isArray(keys) ? keys.map((k) => (k && k.name === 0 ? '*' : k && k.name)) : [];
  const alternatives = splitTopLevelAlternatives(regexp.source);
  const paths = [];

  for (const alt of alternatives) {
    const result = reverseAlternative(alt, keyNames);
    if (result === null) {
      return null; // unknown shape — never guess
    }
    paths.push(result);
  }

  return { path: paths.length === 1 ? paths[0] : paths };
}

/** Split a regexp source on "|" that is not nested inside a group. */
function splitTopLevelAlternatives(source) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') {
      current += ch + (source[i + 1] || '');
      i++;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/**
 * Reverse a single alternative of an Express 4 use-layer regexp into a path
 * string. Capture groups are replaced with the next available key name.
 */
function reverseAlternative(src, keyNames) {
  // Strip the "^" anchor.
  if (!src.startsWith('^')) {
    return null;
  }
  let body = src.slice(1);

  // Strip the trailing "end=false" suffixes emitted by path-to-regexp 0.1.7:
  //   /?(?=\/|$)   (non-strict, trailing slash allowed)
  //   (?=\/|$)     (no trailing-slash allowance)
  // A bare "$" is handled last as a best-effort fallback for end=true shapes.
  const SUFFIXES = ['\\/?(?=\\/|$)', '(?=\\/|$)', '$'];
  let stripped = false;
  for (const suffix of SUFFIXES) {
    if (body.endsWith(suffix)) {
      body = body.slice(0, body.length - suffix.length);
      stripped = true;
      break;
    }
  }
  if (!stripped && body.length > 0) {
    return null;
  }

  let out = '';
  let keyIndex = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];

    if (ch === '\\') {
      out += body[i + 1] || '';
      i += 2;
      continue;
    }

    if (ch !== '(') {
      out += ch;
      i++;
      continue;
    }

    // A group: find the matching close paren, check for an optionality "?"
    // right after it, then replace the whole construct with ":keyName".
    const close = findMatchingParen(body, i);
    if (close === -1) {
      return null;
    }
    let optional = false;
    let after = close + 1;
    if (body[after] === '?') {
      optional = true;
      after++;
    }
    // path-to-regexp 0.1.7 may also append a lazy quantifier ("+?"), which
    // belongs to the group and not to the path.
    if (body[after] === '+' || body[after] === '*') {
      after++;
    }

    const content = body.slice(i + 1, close);
    // "(?:\/(...)"-style groups carry the leading slash inside the group.
    let leadingSlash = false;
    let inner = content;
    if (inner.startsWith('?:')) {
      inner = inner.slice(2);
    }
    if (inner.startsWith('\\/')) {
      leadingSlash = true;
      inner = inner.slice(2);
    }

    const key = keyNames[keyIndex];
    if (key === undefined || key === null || key === '') {
      return null; // group without a matching key — unknown shape
    }
    keyIndex++;

    if (leadingSlash) {
      out += '/' + ':' + key + (optional ? '?' : '');
    } else {
      out += ':' + key + (optional ? '?' : '');
    }
    i = after;
  }

  if (keyIndex !== keyNames.length) {
    return null; // keys/groups mismatch — unknown shape
  }
  return out === '' ? '/' : out;
}

module.exports = {
  extractPathParams,
  normalizePath,
  joinMountPath,
  reverseExpress4MountRegexp,
};
