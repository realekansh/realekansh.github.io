import { PublicApiError, toPublicError } from "./errors.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
};

export function sendJson(res, status, body, headers = {}) {
  for (const [name, value] of Object.entries({ ...JSON_HEADERS, ...headers })) {
    res.setHeader(name, value);
  }
  return res.status(status).json(body);
}

export function sendError(res, error) {
  const publicError = toPublicError(error);
  return sendJson(res, publicError.status, {
    error: publicError.code,
    message: publicError.message,
  }, {
    "Cache-Control": "public, max-age=60, s-maxage=60",
  });
}

export function sendMethodNotAllowed(res, allowed = "GET") {
  res.setHeader("Allow", allowed);
  return sendJson(res, 405, {
    error: "method_not_allowed",
    message: "Method Not Allowed",
  });
}

export function getQuery(req) {
  if (req.query && typeof req.query === "object") {
    return req.query;
  }

  const url = new URL(req.url || "/", "https://realekansh.xyz");
  return Object.fromEntries(url.searchParams.entries());
}

export function readStringParam(query, name) {
  const value = query[name];
  if (Array.isArray(value)) return String(value[0] || "");
  if (value === undefined || value === null) return "";
  return String(value);
}

export function readMetricParam(query) {
  if (Array.isArray(query.metric)) {
    throw new PublicApiError("invalid_metric", "Metric must be provided exactly once.", 400);
  }

  const metric = readStringParam(query, "metric").trim().toLowerCase();
  if (!metric) {
    throw new PublicApiError("missing_metric", "Missing required metric parameter.", 400);
  }
  if (!/^[a-z0-9_]{1,40}$/.test(metric)) {
    throw new PublicApiError("invalid_metric", "Metric contains unsupported characters.", 400);
  }
  return metric;
}

export function sanitizeBadgeText(value, fallback, maxLength = 64) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallback;
  return text.slice(0, maxLength);
}

export function sanitizeBadgeColor(value, fallback) {
  const color = String(value || "").trim();
  if (!color) return fallback;
  if (/^(?:[a-zA-Z][a-zA-Z0-9_-]{0,31}|[0-9a-fA-F]{3,8})$/.test(color)) {
    return color;
  }
  return fallback;
}

export function readFormatParam(query) {
  const value = readStringParam(query, "format").trim().toLowerCase();
  if (!value) return "commas";
  if (["raw", "commas", "compact"].includes(value)) return value;
  throw new PublicApiError("invalid_format", "Format must be one of raw, commas, or compact.", 400);
}
