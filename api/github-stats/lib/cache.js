import { MAX_CACHE_ENTRIES } from "./config.js";

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

const entries = new Map();
const pending = new Map();

export class CacheError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "CacheError";
    this.code = code;
    this.cause = cause;
  }
}

export function clearCache() {
  entries.clear();
  pending.clear();
}

export function getCacheSnapshot() {
  return Array.from(entries.entries()).map(([key, entry]) => ({
    key,
    updatedAt: entry.updatedAt,
    expiresAt: entry.expiresAt,
    staleUntil: entry.staleUntil,
  }));
}

export async function getOrSetCache(key, fetcher, options = {}) {
  const now = Date.now();
  const ttlMs = Number(options.ttlMs ?? DEFAULT_TTL_MS);
  const staleMs = Number(options.staleMs ?? DEFAULT_STALE_MS);
  const maxEntries = Number(options.maxEntries ?? MAX_CACHE_ENTRIES);
  const cached = entries.get(key);

  if (cached && cached.expiresAt > now) {
    return {
      value: cached.value,
      meta: cacheMeta("hit", cached, now),
    };
  }

  if (pending.has(key)) {
    return pending.get(key);
  }

  const request = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      const updatedAt = Date.now();
      const entry = {
        value,
        updatedAt,
        expiresAt: updatedAt + ttlMs,
        staleUntil: updatedAt + ttlMs + staleMs,
      };
      entries.set(key, entry);
      pruneCache(maxEntries);
      return {
        value,
        meta: cacheMeta("miss", entry, updatedAt),
      };
    })
    .catch((error) => {
      if (cached && cached.staleUntil > now) {
        return {
          value: cached.value,
          meta: {
            ...cacheMeta("stale", cached, now),
            warning: normalizeCacheError(error),
          },
        };
      }

      throw error;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);
  return request;
}

function pruneCache(maxEntries) {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) return;

  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.staleUntil <= now) {
      entries.delete(key);
    }
  }

  while (entries.size > maxEntries) {
    const oldest = entries.keys().next().value;
    if (!oldest) break;
    entries.delete(oldest);
  }
}

function cacheMeta(state, entry, now) {
  return {
    state,
    updated_at: new Date(entry.updatedAt).toISOString(),
    expires_at: new Date(entry.expiresAt).toISOString(),
    age_seconds: Math.max(0, Math.floor((now - entry.updatedAt) / 1000)),
  };
}

function normalizeCacheError(error) {
  return {
    code: error?.code || "upstream_error",
    message: error?.publicMessage || "Using stale cached data because the upstream request failed.",
  };
}
