import test from "node:test";
import assert from "node:assert/strict";
import { parseKomarevCount } from "../lib/komarev.js";

test("parses Komarev count from accessible SVG title", () => {
  const svg = '<svg><title>Profile views: 12,847</title><text>Profile views</text><text>12,847</text></svg>';
  assert.equal(parseKomarevCount(svg), 12847);
});

test("parses Komarev count from badge text fallback", () => {
  const svg = '<svg><text>Profile views</text><text>Profile views</text><text>342</text><text>342</text></svg>';
  assert.equal(parseKomarevCount(svg), 342);
});

test("rejects unexpected Komarev SVG", () => {
  assert.throws(() => parseKomarevCount("<svg><text>Profile views</text></svg>"), /parseable count/);
});

test("rejects non-svg Komarev responses", () => {
  assert.throws(() => parseKomarevCount("Profile views: 100"), /not an SVG/);
});

test("rejects negative or invalid Komarev counts", () => {
  assert.throws(() => parseKomarevCount("<svg><text>-1</text></svg>"), /parseable count/);
  assert.throws(() => parseKomarevCount("<svg><text>NaN</text></svg>"), /parseable count/);
});
