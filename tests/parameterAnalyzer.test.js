'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeParameters, extractPathParams } = require('../src/analyzers/parameterAnalyzer');

describe('Phase 3 - Parameter Analyzer', () => {
  test('extracts single parameter from path', () => {
    assert.deepEqual(analyzeParameters('/users/:id'), ['id']);
    assert.deepEqual(analyzeParameters('/posts/:slug'), ['slug']);
  });

  test('extracts multiple parameters preserving order', () => {
    const params = analyzeParameters('/orgs/:orgId/projects/:projectId/issues/:issueId');
    assert.deepEqual(params, ['orgId', 'projectId', 'issueId']);
  });

  test('supports Express 5 named wildcard parameters (*splat)', () => {
    assert.deepEqual(analyzeParameters('/files/*splat'), ['splat']);
    assert.deepEqual(analyzeParameters('/repo/:owner/:repo/*filepath'), ['owner', 'repo', 'filepath']);
  });

  test('supports Express 4 optional parameters (:id?)', () => {
    assert.deepEqual(analyzeParameters('/users/:id?'), ['id']);
  });

  test('supports Express 5 grouped optional syntax ({/:id})', () => {
    assert.deepEqual(analyzeParameters('/users{/:id}'), ['id']);
  });

  test('supports custom regex constraint prefixes (:id(\\d+)) without leaking inner tokens', () => {
    assert.deepEqual(analyzeParameters('/users/:id(\\d+)'), ['id']);
    assert.deepEqual(analyzeParameters('/proxy/:url(https?:\\/\\/[^\\/]+)'), ['url']);
  });

  test('preserves parameter order and removes duplicate parameter names', () => {
    assert.deepEqual(analyzeParameters(['/api/:version', '/users/:version', '/posts/:postId']), ['version', 'postId']);
  });

  test('handles arrays of paths', () => {
    const paths = ['/users/:userId', '/profiles/:profileId'];
    assert.deepEqual(analyzeParameters(paths), ['userId', 'profileId']);
  });

  test('does not extract unnamed wildcards (*) as named parameters', () => {
    // Unnamed wildcards in Express are positional (req.params[0])
    assert.deepEqual(analyzeParameters('/files/*'), []);
  });

  test('returns empty array for empty, non-string, or RegExp inputs', () => {
    assert.deepEqual(analyzeParameters(''), []);
    assert.deepEqual(analyzeParameters(null), []);
    assert.deepEqual(analyzeParameters(undefined), []);
    assert.deepEqual(analyzeParameters(/users/), []);
    assert.deepEqual(analyzeParameters(['/static/path', '/another/path']), []);
  });
});
