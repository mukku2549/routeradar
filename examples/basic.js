'use strict';

/**
 * Basic RouteRadar Example.
 *
 * Demonstrates basic route registration, scanning, and console output.
 */

const express = require('express');
const { createRadar } = require('../src');

const app = express();

// Sample middleware
function logger(req, res, next) {
  next();
}

function auth(req, res, next) {
  next();
}

// Sample route handlers
function getHome(req, res) {
  res.send('Welcome to RouteRadar API');
}

function listUsers(req, res) {
  res.json([]);
}

function getUser(req, res) {
  res.json({ id: req.params.id });
}

function createUser(req, res) {
  res.status(201).json({});
}

// Register routes
app.use(logger);

app.get('/', getHome);
app.get('/users', auth, listUsers);
app.post('/users', auth, createUser);
app.get('/users/:id', getUser);
app.all('/health', (req, res) => res.send('OK'));

// Initialize RouteRadar
const radar = createRadar(app);

// Scan routes
const report = radar.scan();

console.log(radar.export('terminal'));
