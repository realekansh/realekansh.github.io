import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchContributionSummary,
  fetchGitHubProfile,
  fetchIssueSearchCount,
  fetchRepositorySummary,
  getGitHubUsername,
} from "../../lib/github-stats/github.js";
import { jsonResponse } from "./helpers.js";

test("fetchGitHubProfile returns validated public user counts", async () => {
  const profile = await fetchGitHubProfile("realekansh", {
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/users/realekansh");
      assert.equal(init.headers.Accept, "application/vnd.github+json");
      assert.equal(init.headers["X-GitHub-Api-Version"], "2022-11-28");
      return jsonResponse({
        login: "realekansh",
        followers: 1,
        following: 2,
        public_repos: 3,
      });
    },
  });

  assert.deepEqual(profile, {
    login: "realekansh",
    followers: 1,
    following: 2,
    repositories: 3,
  });
});

test("fetchGitHubProfile rejects malformed JSON", async () => {
  await assert.rejects(() => fetchGitHubProfile("realekansh", {
    fetchImpl: async () => new Response("{", { status: 200 }),
  }), /invalid JSON/);
});

test("fetchGitHubProfile rejects malformed numeric fields", async () => {
  await assert.rejects(() => fetchGitHubProfile("realekansh", {
    fetchImpl: async () => jsonResponse({
      login: "realekansh",
      followers: "not-a-number",
      following: 2,
      public_repos: 3,
    }),
  }), /followers/);
});

test("fetchRepositorySummary aggregates owned repository stars and forks", async () => {
  const summary = await fetchRepositorySummary("realekansh", {
    fetchImpl: async () => jsonResponse([
      { stargazers_count: 2, forks_count: 1 },
      { stargazers_count: 5, forks_count: 3 },
    ]),
  });

  assert.deepEqual(summary, { count: 2, stars: 7, forks: 4 });
});

test("fetchRepositorySummary rejects page-limit truncation", async () => {
  await assert.rejects(() => fetchRepositorySummary("realekansh", {
    maxPages: 1,
    fetchImpl: async () => jsonResponse(Array.from({ length: 100 }, () => ({
      stargazers_count: 1,
      forks_count: 1,
    }))),
  }), /page limit/);
});

test("fetchIssueSearchCount returns validated search totals", async () => {
  const total = await fetchIssueSearchCount("realekansh", "pr", {
    fetchImpl: async (url) => {
      assert.match(url, /author%3Arealekansh%20type%3Apr/);
      return jsonResponse({ total_count: 12 });
    },
  });

  assert.equal(total, 12);
});

test("fetchGitHubProfile reports rate limiting safely", async () => {
  await assert.rejects(() => fetchGitHubProfile("realekansh", {
    fetchImpl: async () => jsonResponse({ message: "rate limit" }, { status: 403 }),
  }), /rate limit/);
});

test("fetchGitHubProfile times out", async () => {
  await assert.rejects(() => fetchGitHubProfile("realekansh", {
    timeoutMs: 1,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), {
        name: "AbortError",
      })));
    }),
  }), /timed out/);
});

test("fetchContributionSummary requires a token", async () => {
  await assert.rejects(() => fetchContributionSummary("realekansh", {
    env: {},
  }), /token env var is required/);
});

test("fetchContributionSummary returns validated GraphQL contribution counts", async () => {
  const summary = await fetchContributionSummary("realekansh", {
    env: { GITHUB_STATS_TOKEN: "token" },
    now: new Date("2026-09-02T00:00:00.000Z"),
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/graphql");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer token");
      return jsonResponse({
        data: {
          user: {
            contributionsCollection: {
              totalCommitContributions: 10,
              contributionCalendar: {
                totalContributions: 15,
              },
            },
          },
        },
      });
    },
  });

  assert.equal(summary.commits, 10);
  assert.equal(summary.contributions, 15);
  assert.equal(summary.period.to, "2026-09-02T00:00:00.000Z");
});

test("fetchContributionSummary treats GraphQL errors as upstream failures", async () => {
  await assert.rejects(() => fetchContributionSummary("realekansh", {
    env: { GITHUB_STATS_TOKEN: "token" },
    fetchImpl: async () => jsonResponse({
      errors: [{ message: "bad query" }],
    }),
  }), /GraphQL request failed/);
});

test("getGitHubUsername validates configured username", () => {
  assert.equal(getGitHubUsername({ GITHUB_STATS_USERNAME: "realekansh" }), "realekansh");
  assert.throws(() => getGitHubUsername({ GITHUB_STATS_USERNAME: "-bad-" }), /invalid/);
});
