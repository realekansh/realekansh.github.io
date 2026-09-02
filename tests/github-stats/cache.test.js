import test from "node:test";
import assert from "node:assert/strict";
import { clearCache, getOrSetCache } from "../../lib/github-stats/cache.js";

test("returns cached values within ttl", async () => {
  clearCache();
  let calls = 0;

  const first = await getOrSetCache("unit-cache-hit", async () => {
    calls += 1;
    return { value: 1 };
  }, { ttlMs: 60_000, staleMs: 60_000 });

  const second = await getOrSetCache("unit-cache-hit", async () => {
    calls += 1;
    return { value: 2 };
  }, { ttlMs: 60_000, staleMs: 60_000 });

  assert.deepEqual(first.value, { value: 1 });
  assert.deepEqual(second.value, { value: 1 });
  assert.equal(second.meta.state, "hit");
  assert.equal(calls, 1);
});

test("returns stale values when refresh fails", async () => {
  clearCache();

  await getOrSetCache("unit-cache-stale", async () => 7, { ttlMs: 0, staleMs: 60_000 });
  const stale = await getOrSetCache("unit-cache-stale", async () => {
    throw Object.assign(new Error("boom"), { code: "upstream_failed" });
  }, { ttlMs: 0, staleMs: 60_000 });

  assert.equal(stale.value, 7);
  assert.equal(stale.meta.state, "stale");
  assert.equal(stale.meta.warning.code, "upstream_failed");
});

test("deduplicates concurrent misses for the same key", async () => {
  clearCache();
  let calls = 0;

  const requests = Array.from({ length: 3 }, () => getOrSetCache("unit-cache-pending", async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  }, { ttlMs: 60_000, staleMs: 60_000 }));

  const results = await Promise.all(requests);

  assert.equal(calls, 1);
  assert.deepEqual(results.map((result) => result.value), [42, 42, 42]);
});

test("bounds cache growth with maxEntries", async () => {
  clearCache();

  await getOrSetCache("unit-cache-a", async () => "a", { maxEntries: 2 });
  await getOrSetCache("unit-cache-b", async () => "b", { maxEntries: 2 });
  await getOrSetCache("unit-cache-c", async () => "c", { maxEntries: 2 });

  let calls = 0;
  const refreshed = await getOrSetCache("unit-cache-a", async () => {
    calls += 1;
    return "new-a";
  }, { maxEntries: 2 });

  assert.equal(refreshed.value, "new-a");
  assert.equal(calls, 1);
});
