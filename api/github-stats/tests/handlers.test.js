import test from "node:test";
import assert from "node:assert/strict";
import badgeHandler from "../badge.js";
import rawHandler from "../index.js";
import { clearCache } from "../lib/cache.js";
import { assertBadge, createMockResponse, jsonResponse, textResponse } from "./helpers.js";

test("badge endpoint returns Shields JSON for a valid metric", async () => {
  clearCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    login: "realekansh",
    followers: 342,
    following: 87,
    public_repos: 46,
  });

  try {
    const res = createMockResponse();
    await badgeHandler({ method: "GET", query: { metric: "followers" } }, res);
    assert.equal(res.statusCode, 200);
    assertBadge(res.body);
    assert.equal(res.body.label, "followers");
    assert.equal(res.body.message, "342");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("badge endpoint returns Shields JSON for invalid metric", async () => {
  clearCache();
  const res = createMockResponse();
  await badgeHandler({ method: "GET", query: { metric: "nope" } }, res);
  assert.equal(res.statusCode, 200);
  assertBadge(res.body);
  assert.equal(res.body.color, "red");
  assert.equal(res.body.message, "metric_not_found");
});

test("badge endpoint returns Shields JSON for missing metric", async () => {
  clearCache();
  const res = createMockResponse();
  await badgeHandler({ method: "GET", query: {} }, res);
  assert.equal(res.statusCode, 200);
  assertBadge(res.body);
  assert.equal(res.body.message, "missing_metric");
});

test("raw endpoint can return one selected metric", async () => {
  clearCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => textResponse('<svg><title>Profile views: 12,847</title></svg>');

  try {
    const res = createMockResponse();
    await rawHandler({ method: "GET", query: { metric: "profile_views" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.metric.value, 12847);
    assert.equal(res.body.metric.formatted, "12,847");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("raw endpoint rejects malformed metric names", async () => {
  clearCache();
  const res = createMockResponse();
  await rawHandler({ method: "GET", query: { metric: "../followers" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "invalid_metric");
});

test("raw endpoint treats empty selected metric as missing", async () => {
  clearCache();
  const res = createMockResponse();
  await rawHandler({ method: "GET", query: { metric: "" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "missing_metric");
});

test("raw endpoint rejects array metric parameters", async () => {
  clearCache();
  const res = createMockResponse();
  await rawHandler({ method: "GET", query: { metric: ["followers"] } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "invalid_metric");
});

test("raw endpoint rejects invalid format parameters", async () => {
  clearCache();
  const res = createMockResponse();
  await rawHandler({ method: "GET", query: { metric: "followers", format: "binary" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "invalid_format");
  assert.match(res.headers["content-type"], /application\/json/);
});

test("badge endpoint sanitizes label and color customization", async () => {
  clearCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    login: "realekansh",
    followers: 342,
    following: 87,
    public_repos: 46,
  });

  try {
    const res = createMockResponse();
    await badgeHandler({
      method: "GET",
      query: {
        metric: "followers",
        label: "followers\r\nx-bad: header",
        color: "#bad",
        url: "https://example.com/not-proxied",
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assertBadge(res.body);
    assert.equal(res.body.label, "followers x-bad: header");
    assert.equal(res.body.color, "blue");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("raw endpoint returns JSON for invalid configured username", async () => {
  clearCache();
  const originalUsername = process.env.GITHUB_STATS_USERNAME;
  process.env.GITHUB_STATS_USERNAME = "-bad-";

  try {
    const res = createMockResponse();
    await rawHandler({ method: "GET", query: { metric: "followers" } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "invalid_github_username");
    assert.match(res.headers["content-type"], /application\/json/);
  } finally {
    if (originalUsername === undefined) {
      delete process.env.GITHUB_STATS_USERNAME;
    } else {
      process.env.GITHUB_STATS_USERNAME = originalUsername;
    }
  }
});
