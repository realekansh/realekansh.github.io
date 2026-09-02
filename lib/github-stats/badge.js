import {
  getQuery,
  readFormatParam,
  readMetricParam,
  readStringParam,
  sanitizeBadgeColor,
  sanitizeBadgeText,
  sendJson,
  sendMethodNotAllowed,
} from "./http.js";
import { getGitHubUsername } from "./github.js";
import {
  createMetricsContext,
  getMetricDefinition,
  metricErrorBadge,
  resolveMetric,
} from "./metrics.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res);
  }

  try {
    const query = getQuery(req);
    const username = getGitHubUsername();
    const metric = readMetricParam(query);
    const definition = getMetricDefinition(metric);
    const result = await resolveMetric(metric, createMetricsContext({ username }), {
      format: readFormatParam(query),
    });

    return sendJson(res, 200, {
      schemaVersion: 1,
      label: sanitizeBadgeText(readStringParam(query, "label"), definition.label, 40),
      message: result.formatted,
      color: sanitizeBadgeColor(readStringParam(query, "color"), definition.color),
    });
  } catch (error) {
    const query = getQuery(req);
    const requestedLabel = sanitizeBadgeText(readStringParam(query, "label"), "github stats", 40);
    return sendJson(res, 200, metricErrorBadge(error, requestedLabel), {
      "Cache-Control": "public, max-age=60, s-maxage=60",
    });
  }
}
