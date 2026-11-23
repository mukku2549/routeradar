# RouteRadar

RouteRadar is a lightweight, non-mutating developer utility for Node.js that scans registered Express.js routes, extracts parameter and middleware metadata, spots duplicate registrations, and exports formatted API documentation in Terminal, JSON, Markdown, and HTML.

Supports **Express 4** and **Express 5** seamlessly.

---

## Highlights

- **Zero Side Effects**: Traverses routing layers without executing route handlers, invoking middleware, or mutating application state.
- **Express 4 & 5 Compatible**: Dedicated version-specific adapters isolate framework internals and handle differences in router initialization.
- **Nested Router Traversal**: Recursively resolves multi-tier nested routers and mounts to reconstruct full path hierarchies.
- **Parameter Extraction**: Discovers `:param`, `:param?`, `{/:param}`, `*splat`, and regex-constrained route parameters.
- **Middleware & Handler Inspection**: Detects application, router, and route-level middlewares, named functions, anonymous handlers, and 4-argument error handlers.
- **Duplicate Detection**: Flags unintentional duplicate registrations sharing identical HTTP methods and normalized paths while preserving valid multi-handler chains.
- **Multi-Format Exporters**: Generates human-readable terminal tables, deterministic JSON, GitHub Flavored Markdown tables, and self-contained HTML reports with embedded styles.
- **Query & Statistics API**: Flexible filtering by HTTP method, path string/regex, parameters, and middleware, alongside method distribution metrics.
- **Minimal Footprint**: Native Node.js APIs (`node:test`, `node:path`, `node:fs`) with zero runtime dependencies. Express is treated as a peer dependency.

---

## Requirements

- Node.js >= 20.0.0
- Express >= 4.18.0 or Express >= 5.0.0

---

## Installation

Install RouteRadar in your project:

```bash
npm install routeradar
```

Ensure Express is installed as a peer dependency:

```bash
npm install express
```

---

## Quick Start

```javascript
const express = require('express');
const { createRadar } = require('routeradar');

const app = express();

app.get('/api/users', (req, res) => res.json([]));
app.get('/api/users/:id', (req, res) => res.json({ id: req.params.id }));
app.post('/api/users', (req, res) => res.status(201).json({}));

// Create radar and scan
const radar = createRadar(app);
const report = radar.scan();

// Print summary to terminal
console.log(radar.export('terminal'));
```

---

## API Reference

### `createRadar(app, options)`

Factory function that creates a new `RouteRadar` instance.

- `app` *(Object | Function)*: An Express application instance.
- `options` *(Object, optional)*: Configuration options.

#### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `includeMiddleware` | `boolean` | `true` | Extract middleware and handler metadata for each route. |
| `detectDuplicates` | `boolean` | `true` | Identify routes registered multiple times with the same method and path. |
| `includeStats` | `boolean` | `true` | Compute route counts, method breakdown, and parameter metrics. |

```javascript
const radar = createRadar(app, {
  includeMiddleware: true,
  detectDuplicates: true,
  includeStats: true,
});
```

---

### `radar.scan()`

Traverses the Express routing hierarchy and produces a comprehensive report object.

#### Returned Report Structure

```javascript
{
  metadata: {
    scannedAt: '2026-11-23T12:00:00.000Z',
    framework: 'express',
    version: 5,
    packageVersion: '1.0.0'
  },
  routes: [
    {
      method: 'GET',
      path: '/api/users/:id',
      fullPath: '/api/users/:id',
      params: ['id'],
      middleware: ['authenticate'],
      middlewareDetails: [
        { name: 'authenticate', type: 'application', isErrorHandler: false }
      ],
      handlers: ['getUser'],
      inferred: false,
      source: { framework: 'express', version: 5 }
    }
  ],
  duplicates: [],
  stats: {
    totalRoutes: 1,
    totalEndpoints: 1,
    totalUniqueEndpoints: 1,
    duplicateRoutes: 0,
    methods: { GET: 1 },
    parameterizedRoutes: 1,
    routesWithMiddleware: 1,
    inferredRoutes: 0,
    warningsCount: 0
  },
  warnings: []
}
```

---

### `radar.getRoutes(filters)`

Returns an array of discovered routes, optionally filtered by criteria. Automatically runs `scan()` if not already performed.

#### Supported Filters

- `method` *(string)*: Case-insensitive HTTP method (`'GET'`, `'POST'`, `'DELETE'`, etc.). Matches `'ALL'` registrations by default.
- `path` *(string | RegExp)*: Matches exact path string or regular expression test.
- `prefix` *(string)*: Matches routes whose path starts with the specified prefix (e.g., `'/api/v1'`).
- `hasParameters` *(boolean)*: When `true`, returns only routes with dynamic path parameters.
- `hasMiddleware` *(boolean)*: When `true`, returns only routes with attached middleware.
- `inferred` *(boolean)*: Filters by whether the route path was reconstructed from regex patterns.

```javascript
// Retrieve all GET routes under /api
const apiGetRoutes = radar.getRoutes({
  method: 'GET',
  prefix: '/api'
});

// Retrieve routes containing dynamic parameters
const parameterized = radar.getRoutes({ hasParameters: true });
```

---

### `radar.getStats()`

Returns aggregated statistics for the scanned application:

```javascript
const stats = radar.getStats();
console.log(`Total Routes: ${stats.totalRoutes}`);
console.log(`GET requests: ${stats.methods.GET || 0}`);
```

---

### `radar.export(format, options)`

Formats and returns the report string. Optionally writes the report to a target file.

- `format` *(string)*: One of `'terminal'`, `'json'`, `'markdown'`, or `'html'`.
- `options.path` *(string, optional)*: Destination file path. Intermediate directories will be created automatically.
- `options.pretty` *(boolean, optional, default: true)*: Formats JSON output with 2-space indentation.

#### 1. Terminal (`'terminal'`)

Prints an aligned, clean ASCII summary designed for developer CLIs and logs without requiring terminal color escapes.

```javascript
console.log(radar.export('terminal'));
```

#### 2. JSON (`'json'`)

Exports structured, deterministic JSON. Ideal for CI/CD checks, schema verifiers, and automated API tools.

```javascript
const jsonString = radar.export('json', { path: './reports/routes.json' });
```

#### 3. Markdown (`'markdown'`)

Generates GitHub Flavored Markdown (GFM) tables, perfect for automated pull request summaries or documentation wikis.

```javascript
radar.export('markdown', { path: './docs/API_ROUTES.md' });
```

#### 4. HTML (`'html'`)

Produces a responsive, completely self-contained offline HTML page with clean modern styling, status badges, and table layouts. Requires no external fonts or CDN dependencies.

```javascript
radar.export('html', { path: './public/routes.html' });
```

---

## Express 4 vs Express 5 Internals

Express internal router architectures differ between major versions:

| Feature | Express 4 | Express 5 |
| :--- | :--- | :--- |
| **Router Property** | `app._router` (instantiated lazily upon first route/middleware registration) | `app.router` (getter returning router instance) |
| **Empty App Behavior** | `app._router` is `undefined` until routes are attached | Accessing `app.router` creates and initializes router |
| **Mount Path Storage** | Mount paths are converted to regular expressions in `layer.regexp` | Router mounts store the original registered string in `layer.rawPath` |
| **Path Reconstruction** | Reconstructed via regex token reversal (`inferred: true`) | Exact original path preserved directly (`inferred: false`) |
| **Route Parameters** | Standard `:param` tokens via `path-to-regexp` v0.1.7 | Advanced `:param`, `*splat`, and `{/:opt}` via `path-to-regexp` v8 |

### Adapter Architecture

RouteRadar isolates internal framework differences within dedicated version adapters:

- `Express4Adapter`: Non-mutating inspection of `app._router`. Empty applications without an initialized router are handled gracefully without invoking `app.lazyrouter()`. Mount paths reconstructed from layer regular expressions are marked with `inferred: true`.
- `Express5Adapter`: Uses property descriptor inspection (`Object.getOwnPropertyDescriptor(app, 'router')`) to verify framework version without triggering lazy router initialization. Reads `layer.rawPath` for accurate path preservation.

---

## Limitations

- **Regex-Only Routes**: Express 4 routes registered with raw `RegExp` patterns cannot be fully reversed to an exact literal string and are marked as inferred.
- **Opaque Sub-Applications**: Nested applications mounted via `app.use('/sub', subApp)` preserve the mount prefix; internal sub-app routing trees are listed with the `mounted_app` identifier.
- **Dynamic Runtime Mounts**: Routes registered after `radar.scan()` is called require re-scanning by invoking `radar.scan()` again.

---

## Development & Testing

Run the test suite using Node.js built-in test runner:

```bash
npm test
```

Execute runnable example scripts:

```bash
npm run example:basic
npm run example:nested
npm run example:export
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
