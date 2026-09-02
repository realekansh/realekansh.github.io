import test from "node:test";
import assert from "node:assert/strict";
import { formatCompact, formatInteger, formatMetricValue } from "../../lib/github-stats/format.js";

test("formats integers with separators", () => {
  assert.equal(formatInteger(0), "0");
  assert.equal(formatInteger(1), "1");
  assert.equal(formatInteger(42), "42");
  assert.equal(formatInteger(999), "999");
  assert.equal(formatInteger(1000), "1,000");
  assert.equal(formatInteger(12847), "12,847");
  assert.equal(formatInteger(1000000), "1,000,000");
  assert.equal(formatInteger(821), "821");
});

test("supports raw, commas, and compact metric formatting", () => {
  assert.equal(formatMetricValue(12847, "raw"), "12847");
  assert.equal(formatMetricValue(12847, "commas"), "12,847");
  assert.equal(formatCompact(12847), "12.8k");
  assert.equal(formatCompact(1000000), "1m");
});

test("rejects invalid numeric values", () => {
  assert.throws(() => formatMetricValue(Number.NaN), /non-negative/);
  assert.throws(() => formatMetricValue(Number.POSITIVE_INFINITY), /non-negative/);
  assert.throws(() => formatMetricValue(-1), /non-negative/);
  assert.throws(() => formatMetricValue(null), /non-negative/);
});
