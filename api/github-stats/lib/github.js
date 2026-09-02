import { PublicApiError } from "./errors.js";
import {
  GITHUB_API_VERSION,
  GITHUB_GRAPHQL_URL,
  GITHUB_REST_BASE,
  MAX_REPOSITORY_PAGES,
  UPSTREAM_TIMEOUT_MS,
  USER_AGENT,
} from "./config.js";

export function getGitHubToken(env = process.env) {
  return env.GITHUB_STATS_TOKEN
    || env.GITHUB_TOKEN
    || env.GH_TOKEN
    || env.VERCEL_GITHUB_TOKEN
    || env.GITHUB_PAT
    || "";
}

export function getGitHubUsername(env = process.env) {
  const username = (env.GITHUB_STATS_USERNAME || "realekansh").trim();
  validateGitHubUsername(username);
  return username;
}

export async function fetchGitHubProfile(username, options = {}) {
  validateGitHubUsername(username);
  const data = await fetchGitHubJson(`/users/${encodeURIComponent(username)}`, options);

  return {
    login: requireString(data.login, "login"),
    followers: requireCount(data.followers, "followers"),
    following: requireCount(data.following, "following"),
    repositories: requireCount(data.public_repos, "public_repos"),
  };
}

export async function fetchRepositorySummary(username, options = {}) {
  validateGitHubUsername(username);
  const repositories = [];
  const perPage = 100;
  const maxPages = Number(options.maxPages || MAX_REPOSITORY_PAGES);

  for (let page = 1; page <= maxPages; page += 1) {
    const pageData = await fetchGitHubJson(
      `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
      options,
    );

    if (!Array.isArray(pageData)) {
      throw new PublicApiError("invalid_github_response", "GitHub repositories response was not an array.", 502);
    }

    repositories.push(...pageData);
    if (pageData.length < perPage) break;

    if (page === maxPages) {
      throw new PublicApiError(
        "github_repository_page_limit",
        "Repository aggregation exceeded the configured page limit.",
        503,
      );
    }
  }

  return repositories.reduce((summary, repo) => {
    summary.count += 1;
    summary.stars += requireCount(repo.stargazers_count, "stargazers_count");
    summary.forks += requireCount(repo.forks_count, "forks_count");
    return summary;
  }, { count: 0, stars: 0, forks: 0 });
}

export async function fetchIssueSearchCount(username, type, options = {}) {
  validateGitHubUsername(username);
  const normalizedType = type === "pr" ? "pr" : "issue";
  const query = `author:${username} type:${normalizedType}`;
  const data = await fetchGitHubJson(`/search/issues?q=${encodeURIComponent(query)}&per_page=1`, options);

  return requireCount(data.total_count, "total_count");
}

export async function fetchContributionSummary(username, options = {}) {
  validateGitHubUsername(username);
  const token = getGitHubToken(options.env);
  if (!token) {
    throw new PublicApiError(
      "github_token_required",
      "GITHUB_STATS_TOKEN or a GitHub token env var is required for contribution metrics.",
      503,
    );
  }

  const now = options.now || new Date();
  const to = now.toISOString();
  const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString();

  const data = await fetchGitHubGraphQL({
    query: `
      query GitHubStatsContributions($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `,
    variables: { login: username, from, to },
  }, options);

  const collection = data?.data?.user?.contributionsCollection;
  if (!collection) {
    throw new PublicApiError("invalid_github_response", "GitHub GraphQL response was missing contribution data.", 502);
  }

  return {
    commits: requireCount(collection.totalCommitContributions, "totalCommitContributions"),
    contributions: requireCount(collection.contributionCalendar?.totalContributions, "totalContributions"),
    period: { from, to },
  };
}

async function fetchGitHubJson(path, options = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new PublicApiError("invalid_github_request", "GitHub REST path must be application-defined.", 500);
  }

  const url = `${GITHUB_REST_BASE}${path}`;
  const response = await callFetch(url, {
    method: "GET",
    headers: githubHeaders(options),
  }, options);

  if (!response.ok) {
    throw await createGitHubError(response);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new PublicApiError("invalid_github_response", "GitHub returned invalid JSON.", 502);
  }
}

async function fetchGitHubGraphQL(body, options = {}) {
  const response = await callFetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...githubHeaders(options),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, options);

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    throw new PublicApiError("invalid_github_response", "GitHub GraphQL returned invalid JSON.", 502);
  }

  if (data.errors) {
    throw new PublicApiError("github_graphql_error", "GitHub GraphQL request failed.", 502);
  }

  if (!response.ok) {
    throw await createGitHubError(response, data);
  }

  return data;
}

async function callFetch(url, init, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs || UPSTREAM_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new PublicApiError("github_timeout", "GitHub request timed out.", 504);
    }
    throw new PublicApiError("github_request_failed", "GitHub request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function githubHeaders(options = {}) {
  const token = getGitHubToken(options.env);
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": USER_AGENT,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function createGitHubError(response, data = null) {
  const status = response.status;
  const code = status === 403 || status === 429 ? "github_rate_limited" : "github_api_error";
  const message = code === "github_rate_limited"
    ? "GitHub API rate limit or abuse protection was reached."
    : "GitHub API request failed.";

  return new PublicApiError(code, message, status >= 500 ? 502 : status);
}

function requireCount(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new PublicApiError(
      "invalid_github_response",
      `GitHub response field '${field}' was not a valid non-negative integer.`,
      502,
    );
  }
  return Math.floor(number);
}

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicApiError(
      "invalid_github_response",
      `GitHub response field '${field}' was missing or invalid.`,
      502,
    );
  }
  return value;
}

function validateGitHubUsername(username) {
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    throw new PublicApiError("invalid_github_username", "Configured GitHub username is invalid.", 500);
  }
}
