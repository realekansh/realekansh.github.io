import { sendError, sendJson, sendMethodNotAllowed } from "./http.js";
import { createMetricsContext, listMetrics, resolveAllMetrics, resolveMetric } from "./metrics.js";
import { getGitHubUsername } from "./github.js";
import { readFormatParam, readMetricParam, getQuery } from "./http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res);
  }

  try {
    const query = getQuery(req);
    const username = getGitHubUsername();
    const context = createMetricsContext({ username });

    if (Object.prototype.hasOwnProperty.call(query, "metric")) {
      const metric = readMetricParam(query);
      const result = await resolveMetric(metric, context, {
        format: readFormatParam(query),
      });
      return sendJson(res, 200, {
        username,
        generated_at: new Date().toISOString(),
        metric: result,
      });
    }

    const results = await resolveAllMetrics(context);
    const body = {
      username,
      generated_at: new Date().toISOString(),
      ...results.values,
      formatted: results.formatted,
      sources: results.sources,
      available_metrics: listMetrics(),
    };

    if (Object.keys(results.errors).length > 0) {
      body.errors = results.errors;
    }

    return sendJson(res, 200, body);
  } catch (error) {
    return sendError(res, error);
  }
}
