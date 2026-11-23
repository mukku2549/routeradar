'use strict';

/**
 * Export Reports Example.
 *
 * Demonstrates exporting route reports to JSON, Markdown, and HTML.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { createRadar } = require('../src');

const app = express();

function authenticate(req, res, next) { next(); }
function checkRole(req, res, next) { next(); }

app.get('/api/users', authenticate, (req, res) => res.json([]));
app.get('/api/users/:id', authenticate, (req, res) => res.json({}));
app.post('/api/users', authenticate, checkRole, (req, res) => res.status(201).json({}));
app.delete('/api/users/:id', authenticate, checkRole, (req, res) => res.status(204).end());
app.get('/api/posts', (req, res) => res.json([]));
app.all('/health', (req, res) => res.send('OK'));

const radar = createRadar(app);
const outDir = path.join(__dirname, 'output');

// Export Markdown to file
const md = radar.export('markdown', { path: path.join(outDir, 'routes.md') });
console.log('Markdown report generated at examples/output/routes.md');

// Export HTML to file
const html = radar.export('html', { path: path.join(outDir, 'routes.html') });
console.log('HTML report generated at examples/output/routes.html');

// Export JSON to file
const json = radar.export('json', { path: path.join(outDir, 'routes.json') });
console.log('JSON report generated at examples/output/routes.json');
