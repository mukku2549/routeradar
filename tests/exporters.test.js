'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express5 = require('express');
const { createRadar } = require('../src');

const TEMP_OUT_DIR = path.join(__dirname, 'temp_exports');

describe('Phase 4 - Export Engine', () => {
  after(() => {
    if (fs.existsSync(TEMP_OUT_DIR)) {
      fs.rmSync(TEMP_OUT_DIR, { recursive: true, force: true });
    }
  });

  function createSampleApp() {
    const app = express5();
    function authenticate(req, res, next) { next(); }
    function listUsers(req, res) { res.json([]); }
    function getUser(req, res) { res.json({}); }

    app.get('/users', authenticate, listUsers);
    app.get('/users/:id', authenticate, getUser);
    app.post('/users', listUsers); // Potential duplicate endpoint path
    app.get('/xss/<script>tag</script>', () => {});

    return app;
  }

  test('radar.export("json") outputs valid, parseable JSON with deterministic structure', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const jsonStr = radar.export('json');

    assert.equal(typeof jsonStr, 'string');
    const parsed = JSON.parse(jsonStr);

    assert.equal(parsed.metadata.tool, 'RouteRadar');
    assert.equal(parsed.statistics.totalRoutes, 4);
    assert.equal(parsed.statistics.totalEndpoints, 3);
    assert.equal(parsed.routes.length, 4);

    // Verify no function objects or circular structures in JSON
    for (const r of parsed.routes) {
      assert.equal(typeof r.method, 'string');
      assert.equal(typeof r.path, 'string');
      assert.ok(Array.isArray(r.params));
      assert.ok(Array.isArray(r.middlewares));
      assert.ok(Array.isArray(r.middlewareDetails));
      assert.equal(typeof r.inferred, 'boolean');
      assert.equal(typeof r.source.version, 'number');
    }

    // Verify compact JSON option
    const compactStr = radar.export('json', { pretty: false });
    assert.ok(!compactStr.includes('\n  '));
    assert.deepEqual(JSON.parse(compactStr), parsed);
  });

  test('radar.export("markdown") generates valid GFM documentation with all sections', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const md = radar.export('markdown', { title: 'User Service API' });

    assert.ok(md.includes('# User Service API'));
    assert.ok(md.includes('## Summary Statistics'));
    assert.ok(md.includes('### HTTP Method Distribution'));
    assert.ok(md.includes('## Discovered Routes'));
    assert.ok(md.includes('| Method | Path | Parameters | Middlewares | Handler | Inferred |'));
    assert.ok(md.includes('| **GET** | `/users` | - | `authenticate` | `listUsers` | - |'));
    assert.ok(md.includes('| **GET** | `/users/:id` | `:id` | `authenticate` | `getUser` | - |'));
    assert.ok(md.includes('## Known Limitations'));
  });

  test('radar.export("html") produces standalone offline HTML with safe escaping', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const html = radar.export('html', { title: 'Production App Routes' });

    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<title>Production App Routes</title>'));
    assert.ok(html.includes('class="method-badge"'));
    assert.ok(html.includes('/users/:id'));
    assert.ok(html.includes('listUsers'));

    // Check XSS safety: "<script>" must be strictly escaped
    assert.ok(!html.includes('<script>tag</script>'));
    assert.ok(html.includes('&lt;script&gt;tag&lt;/script&gt;'));

    // Check offline requirement: no external CDN scripts, styles or web fonts
    assert.ok(!html.includes('http://'));
    assert.ok(!html.includes('https://'));
    assert.ok(!html.includes('<link rel="stylesheet"'));
    assert.ok(!html.includes('<script src='));
  });

  test('radar.export("terminal") produces formatted CLI output with aligned columns', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const cli = radar.export('terminal');

    assert.ok(cli.includes('RouteRadar'));
    assert.ok(cli.includes('Express API Route Report'));
    assert.ok(cli.includes('STATISTICS:'));
    assert.ok(cli.includes('DISCOVERED ROUTES:'));
    assert.ok(cli.includes('METHOD'));
    assert.ok(cli.includes('PATH'));
    assert.ok(cli.includes('GET'));
    assert.ok(cli.includes('/users'));
    assert.ok(cli.includes('listUsers'));
  });

  test('all four exporters handle an empty application report gracefully', () => {
    const emptyApp = express5();
    const radar = createRadar(emptyApp);

    // 1. JSON
    const jsonStr = radar.export('json');
    const json = JSON.parse(jsonStr);
    assert.equal(json.routes.length, 0);
    assert.equal(json.statistics.totalRoutes, 0);

    // 2. Markdown
    const md = radar.export('markdown');
    assert.ok(md.includes('No routes detected in this application'));

    // 3. HTML
    const html = radar.export('html');
    assert.ok(html.includes('No routes were detected in this application'));

    // 4. Terminal
    const term = radar.export('terminal');
    assert.ok(term.includes('(No routes detected)'));
  });

  test('all four exporters reflect consistent data from the same scanned application', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const report = radar.scan();

    const json = JSON.parse(radar.export('json'));
    const md = radar.export('markdown');
    const html = radar.export('html');
    const term = radar.export('terminal');

    // Route counts
    const countStr = String(report.routes.length);
    assert.equal(json.routes.length, report.routes.length);
    assert.ok(md.includes(`| **Total Routes** | ${countStr} |`));
    assert.ok(html.includes(`<div class="stat-value">${countStr}</div>`));
    assert.ok(term.includes(`Total Routes:          ${countStr}`));
  });

  test('radar.export() with path writes file to disk and returns content', () => {
    const app = createSampleApp();
    const radar = createRadar(app);
    const outFile = path.join(TEMP_OUT_DIR, 'reports', 'routes.md');

    const result = radar.export('markdown', { path: outFile });
    assert.ok(fs.existsSync(outFile));
    const content = fs.readFileSync(outFile, 'utf8');
    assert.equal(content, result);
  });

  test('throws for unsupported format', () => {
    const app = createSampleApp();
    const radar = createRadar(app);

    assert.throws(() => radar.export('pdf'), {
      name: 'Error',
      message: /Unsupported export format 'pdf'/,
    });
  });
});
