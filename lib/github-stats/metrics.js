import { getOrSetCache } from "./cache.js";
import { PublicApiError, toPublicError } from "./errors.js";
import { formatMetricValue } from "./format.js";
import {
  fetchContributionSummary,
  fetchGitHubProfile,
  fetchIssueSearchCount,
  fetchRepositorySummary,
  getGitHubUsername,
} from "./github.js";
import { fetchProfileViews } from "./komarev.js";
import {
  GITHUB_CACHE_TTL_MS,
  KOMAREV_CACHE_TTL_MS,
  STALE_CACHE_MS,
} from "./config.js";

export const metricRegistry = new Map(Object.entries({
  profile_views: {
    id: "profile_views",
    key: "profile_views",
    label: "profile views",
    color: "blue",
    format: "commas",
    source: "komarev_svg_badge",
    description: "Profile hit count from Komarev GitHub Profile Views Counter.",
    resolve: (context) => context.profileViews(),
  },
  followers: {
    id: "followers",
    key: "followers",
    label: "followers",
    color: "blue",
    format: "commas",
    source: "github_rest_user",
    description: "GitHub follower count.",
    resolve: async (context) => (await context.profile()).followers,
  },
  following: {
    id: "following",
    key: "following",
    label: "following",
    color: "blue",
    format: "commas",
    source: "github_rest_user",
    description: "GitHub following count.",
    resolve: async (context) => (await context.profile()).following,
  },
  repositories: {
    id: "repositories",
    key: "repositories",
    label: "repositories",
    color: "informational",
    format: "commas",
    source: "github_rest_user",
    description: "Public repository count from the GitHub user profile.",
    resolve: async (context) => (await context.profile()).repositories,
  },
  stars: {
    id: "stars",
    key: "stars",
    label: "total stars",
    color: "yellow",
    format: "commas",
    source: "github_rest_repositories",
    description: "Total stargazers across public repositories owned by the user.",
    resolve: async (context) => (await context.repositories()).stars,
  },
  forks: {
    id: "forks",
    key: "forks",
    label: "total forks",
    color: "orange",
    format: "commas",
    source: "github_rest_repositories",
    description: "Total forks across public repositories owned by the user.",
    resolve: async (context) => (await context.repositories()).forks,
  },
  pull_requests: {
    id: "pull_requests",
    key: "pull_requests",
    label: "pull requests",
    color: "blueviolet",
    format: "commas",
    source: "github_rest_search",
    description: "Public pull requests authored by the user as indexed by GitHub search.",
    resolve: (context) => context.searchCount("pr"),
  },
  issues: {
    id: "issues",
    key: "issues",
    label: "issues",
    color: "green",
    format: "commas",
    source: "github_rest_search",
    description: "Public issues authored by the user as indexed by GitHub search.",
    resolve: (context) => context.searchCount("issue"),
  },
  commits: {
    id: "commits",
    key: "commits",
    label: "year commits",
    color: "green",
    format: "commas",
    source: "github_graphql_contributions",
    description: "Commit contributions from GitHub GraphQL over the trailing 365 days.",
    resolve: async (context) => (await context.contributions()).commits,
  },
  contributions: {
    id: "contributions",
    key: "contributions",
    label: "year contributions",
    color: "brightgreen",
    format: "commas",
    source: "github_graphql_contributions",
    description: "Total public contribution calendar count over the trailing 365 days.",
    resolve: async (context) => (await context.contributions()).contributions,
  },
}));

export function createMetricsContext(options = {}) {
  const username = options.username || getGitHubUsername(options.env);
  const providerOptions = {
    fetchImpl: options.fetchImpl,
    env: options.env,
    now: options.now,
    timeoutMs: options.timeoutMs,
  };

  const memo = new Map();
  const memoized = (key, factory) => {
    if (!memo.has(key)) {
      memo.set(key, factory());
    }
    return memo.get(key);
  };

  return {
    username,
    profile: () => memoized("profile", async () => (
      await getOrSetCache(
        `github-stats:${username}:profile`,
        () => fetchGitHubProfile(username, providerOptions),
        { ttlMs: GITHUB_CACHE_TTL_MS, staleMs: STALE_CACHE_MS },
      )
    ).value),
    repositories: () => memoized("repositories", async () => (
      await getOrSetCache(
        `github-stats:${username}:repositories`,
        () => fetchRepositorySummary(username, providerOptions),
        { ttlMs: GITHUB_CACHE_TTL_MS, staleMs: STALE_CACHE_MS },
      )
    ).value),
    searchCount: (type) => memoized(`search:${type}`, async () => (
      await getOrSetCache(
        `github-stats:${username}:search:${type}`,
        () => fetchIssueSearchCount(username, type, providerOptions),
        { ttlMs: GITHUB_CACHE_TTL_MS, staleMs: STALE_CACHE_MS },
      )
    ).value),
    contributions: () => memoized("contributions", async () => (
      await getOrSetCache(
        `github-stats:${username}:contributions`,
        () => fetchContributionSummary(username, providerOptions),
        { ttlMs: GITHUB_CACHE_TTL_MS, staleMs: STALE_CACHE_MS },
      )
    ).value),
    profileViews: () => memoized("profile_views", async () => (
      await getOrSetCache(
        `github-stats:${username}:profile-views`,
        () => fetchProfileViews(username, providerOptions),
        { ttlMs: KOMAREV_CACHE_TTL_MS, staleMs: STALE_CACHE_MS },
      )
    ).value),
  };
}

export function listMetrics() {
  return Array.from(metricRegistry.values()).map(({ id, key, label, color, format, source, description }) => ({
    id,
    key,
    label,
    color,
    format,
    source,
    description,
  }));
}

export function getMetricDefinition(metric) {
  const definition = metricRegistry.get(metric);
  if (!definition) {
    throw new PublicApiError("metric_not_found", "Metric was not found.", 404);
  }
  return definition;
}

export async function resolveMetric(metric, context, options = {}) {
  const definition = getMetricDefinition(metric);
  const value = await definition.resolve(context);

  return {
    id: definition.id,
    key: definition.key,
    label: definition.label,
    color: definition.color,
    source: definition.source,
    value,
    formatted: formatMetricValue(value, options.format || definition.format || "commas"),
  };
}

export async function resolveAllMetrics(context) {
  const entries = await Promise.all(Array.from(metricRegistry.keys()).map(async (key) => {
    try {
      const metric = await resolveMetric(key, context);
      return [key, metric.value, metric, null];
    } catch (error) {
      return [key, null, null, toPublicError(error)];
    }
  }));

  const values = {};
  const formatted = {};
  const sources = {};
  const errors = {};

  for (const [key, value, metric, error] of entries) {
    if (error) {
      errors[key] = {
        error: error.code,
        message: error.message,
      };
      continue;
    }

    values[key] = value;
    formatted[key] = metric.formatted;
    sources[key] = metric.source;
  }

  return { values, formatted, sources, errors };
}

export function metricErrorBadge(error, label = "github stats") {
  const publicError = toPublicError(error);
  return {
    schemaVersion: 1,
    label,
    message: publicError.code,
    color: "red",
  };
}
