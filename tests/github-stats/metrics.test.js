import test from "node:test";
import assert from "node:assert/strict";
import { clearCache } from "../../lib/github-stats/cache.js";
import { createMetricsContext, resolveMetric } from "../../lib/github-stats/metrics.js";
import { jsonResponse, textResponse } from "./helpers.js";

test("resolves a valid GitHub metric through the registry", async () => {
  clearCache();
  const context = createMetricsContext({
    username: "realekansh",
    fetchImpl: async (url) => {
      assert.match(url, /api\.github\.com\/users\/realekansh$/);
      return jsonResponse({
        login: "realekansh",
        followers: 342,
        following: 87,
        public_repos: 46,
      });
    },
  });

  const metric = await resolveMetric("followers", context);
  assert.equal(metric.key, "followers");
  assert.equal(metric.value, 342);
  assert.equal(metric.formatted, "342");
});

test("rejects invalid metric names", async () => {
  clearCache();
  const context = createMetricsContext({ username: "realekansh", fetchImpl: async () => jsonResponse({}) });
  await assert.rejects(() => resolveMetric("missing_metric", context), /Metric was not found/);
});

test("caches provider responses", async () => {
  clearCache();
  let calls = 0;
  const context = createMetricsContext({
    username: "realekansh",
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        login: "realekansh",
        followers: 342,
        following: 87,
        public_repos: 46,
      });
    },
  });

  await resolveMetric("followers", context);
  await resolveMetric("following", context);
  assert.equal(calls, 1);
});

test("surfaces GitHub API failure safely", async () => {
  clearCache();
  const context = createMetricsContext({
    username: "realekansh",
    fetchImpl: async () => jsonResponse({ message: "rate limited" }, { status: 403 }),
  });

  await assert.rejects(() => resolveMetric("followers", context), /rate limit/);
});

test("surfaces unexpected GitHub user data safely", async () => {
  clearCache();
  const context = createMetricsContext({
    username: "realekansh",
    fetchImpl: async () => jsonResponse({ login: "realekansh" }),
  });

  await assert.rejects(() => resolveMetric("followers", context), /followers/);
});

test("surfaces profile views upstream parse failures", async () => {
  clearCache();
  const context = createMetricsContext({
    username: "realekansh",
    fetchImpl: async () => textResponse("<svg></svg>"),
  });

  await assert.rejects(() => resolveMetric("profile_views", context), /parseable count/);
});
