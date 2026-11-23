'use strict';

/**
 * Nested Routers Example.
 *
 * Demonstrates scanning an Express application with multi-tier nested routers,
 * dynamic parameters, and duplicate detection.
 */

const express = require('express');
const { createRadar } = require('../src');

const app = express();

// Middleware
function apiAuth(req, res, next) { next(); }
function adminGuard(req, res, next) { next(); }

// Handlers
function listOrgUsers(req, res) { res.json([]); }
function getOrgUser(req, res) { res.json({}); }
function listProjects(req, res) { res.json([]); }
function getProjectTask(req, res) { res.json({}); }

// 1. Tasks router
const tasksRouter = express.Router();
tasksRouter.get('/', (req, res) => res.json([]));
tasksRouter.get('/:taskId', getProjectTask);

// 2. Projects router (mounts tasksRouter)
const projectsRouter = express.Router();
projectsRouter.get('/', listProjects);
projectsRouter.use('/:projectId/tasks', tasksRouter);

// 3. Organization users router
const usersRouter = express.Router();
usersRouter.get('/', listOrgUsers);
usersRouter.get('/:userId', getOrgUser);
// Intentional duplicate registration for demo
usersRouter.get('/', (req, res) => res.json({ fallback: true }));

// 4. API v1 router (mounts usersRouter and projectsRouter)
const v1Router = express.Router();
v1Router.use('/users', usersRouter);
v1Router.use('/projects', projectsRouter);

// Mount under app
app.use('/api/v1/orgs/:orgId', apiAuth, v1Router);

// Initialize RouteRadar
const radar = createRadar(app, {
  includeMiddleware: true,
  detectDuplicates: true,
  includeStats: true,
});

console.log(radar.export('terminal'));
