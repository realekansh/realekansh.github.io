# GitHub Stats API

Standalone GitHub profile statistics API for `realekansh`. This directory is an isolated API subsystem for reusable statistics and Shields.io endpoint badges. It is not part of the portfolio UI.

## Endpoints

### Raw Statistics

```text
GET /api/github-stats
GET /api/github-stats?metric=followers
```

Example response:

```json
{
  "username": "realekansh",
  "generated_at": "2026-09-02T00:00:00.000Z",
  "followers": 342,
  "repositories": 46,
  "stars": 821,
  "formatted": {
    "followers": "342",
    "stars": "821"
  },
  "sources": {
    "followers": "github_rest_user",
    "stars": "github_rest_repositories"
  }
}
```

When `metric` is provided, the raw endpoint returns one structured metric:

```json
{
  "username": "realekansh",
  "generated_at": "2026-09-02T00:00:00.000Z",
  "metric": {
    "id": "followers",
    "key": "followers",
    "label": "followers",
    "color": "blue",
    "source": "github_rest_user",
    "value": 342,
    "formatted": "342"
  }
}
```

### Shields Endpoint Badge

```text
GET /api/github-stats/badge?metric=followers
```

Example response:

```json
{
  "schemaVersion": 1,
  "label": "followers",
  "message": "342",
  "color": "blue"
}
```

Shields.io renders the SVG:

```md
![Followers](https://img.shields.io/endpoint?url=https%3A%2F%2Frealekansh.xyz%2Fapi%2Fgithub-stats%2Fbadge%3Fmetric%3Dfollowers)
![Stars](https://img.shields.io/endpoint?url=https%3A%2F%2Frealekansh.xyz%2Fapi%2Fgithub-stats%2Fbadge%3Fmetric%3Dstars)
![Profile Views](https://img.shields.io/endpoint?url=https%3A%2F%2Frealekansh.xyz%2Fapi%2Fgithub-stats%2Fbadge%3Fmetric%3Dprofile_views)
```

## Badge Parameters

- `metric`: required for `/badge`; one of the available metric keys.
- `label`: optional badge label override, sanitized and length-limited.
- `color`: optional Shields-compatible named color or hex value without `#`.
- `format`: optional value format, one of `commas`, `compact`, or `raw`.

Example:

```text
/api/github-stats/badge?metric=stars&label=total-stars&color=yellow&format=compact
```

## Metrics

| Metric | Meaning | Source |
| --- | --- | --- |
| `profile_views` | Profile view count reported by Komarev for the configured username. | Komarev SVG badge endpoint |
| `followers` | GitHub followers for the configured user. | GitHub REST user API |
| `following` | GitHub accounts followed by the configured user. | GitHub REST user API |
| `repositories` | Public repository count from the configured user's GitHub profile. | GitHub REST user API |
| `stars` | Total stargazers across public repositories owned by the configured user. | GitHub REST repositories API |
| `forks` | Total forks across public repositories owned by the configured user. | GitHub REST repositories API |
| `pull_requests` | Public pull requests authored by the configured user as indexed by GitHub search. | GitHub REST search API |
| `issues` | Public issues authored by the configured user as indexed by GitHub search. | GitHub REST search API |
| `commits` | Commit contributions in GitHub's contribution model over the trailing 365 days. | GitHub GraphQL API |
| `contributions` | Total contribution-calendar count in GitHub's contribution model over the trailing 365 days. | GitHub GraphQL API |

## Environment Variables

- `GITHUB_STATS_USERNAME`: optional username override; defaults to `realekansh`. Must be a valid GitHub username.
- `GITHUB_STATS_TOKEN`: optional GitHub token for higher REST limits and required GraphQL contribution metrics.

The implementation also recognizes existing token variable names already used by the site: `GITHUB_TOKEN`, `GH_TOKEN`, `VERCEL_GITHUB_TOKEN`, and `GITHUB_PAT`.

Use the minimum token permissions available for reading public profile data. Do not expose the token to client-side code.

## Caching

The API uses process-local in-memory caching:

- GitHub REST and GraphQL metrics: 1 hour TTL.
- Komarev profile views: 6 hour TTL to avoid inflating the counter and reduce dependency pressure.
- Stale fallback: 24 hours after expiry if an upstream request fails.
- In-flight request deduplication: concurrent requests for the same expired cache key share one upstream request.
- Maximum process-local entries: 100, with expired stale entries pruned first.

This cache persists only while a serverless instance remains warm. It reduces repeated Shields.io traffic but is not shared across Vercel instances.

Response headers also allow CDN-level caching:

```text
Cache-Control: public, max-age=300, s-maxage=1800, stale-while-revalidate=86400
```

## Data Sources

GitHub statistics use official GitHub APIs. The profile views metric uses Komarev GitHub Profile Views Counter because GitHub does not expose public profile views through its API.

Komarev currently documents a badge/SVG interface, not a JSON API. The parser is isolated in `lib/komarev.js`; if Komarev provides a stable JSON endpoint later, only that adapter should need replacement.

The implementation does not accept arbitrary upstream URLs. GitHub and Komarev endpoints are fixed by the application.

## Error Handling

Raw endpoints return consistent JSON errors for invalid requests:

```json
{
  "error": "metric_not_found",
  "message": "Metric was not found."
}
```

Badge endpoints always return Shields-compatible JSON, including error states:

```json
{
  "schemaVersion": 1,
  "label": "github stats",
  "message": "metric_not_found",
  "color": "red"
}
```

No stack traces, tokens, or environment values are returned.

The badge endpoint always returns HTTP 200 with Shields-compatible JSON so Shields.io can render the error state. Raw endpoint errors use normal HTTP statuses such as 400, 404, 502, 503, or 504.

## Local Development

There is no package manifest in the repository. Run tests directly with Node:

```sh
node --test api/github-stats/tests/*.test.js
```

For direct local handler testing, import the handlers from:

```text
api/github-stats/index.js
api/github-stats/badge.js
```

The existing local preview tool currently resolves `/api/name` to `api/name.js`; it may not emulate Vercel directory index routes such as `/api/github-stats`. Production Vercel routing should expose the directory handlers without changing `vercel.json`.

Run syntax checks with:

```sh
find api/github-stats -name '*.js' -print -exec node --check {} \;
```

## Deployment

Deploy with the existing Vercel setup. No portfolio pages, styles, scripts, existing API handlers, or broad routing rules are changed for these endpoints.

Expected production URLs:

```text
https://realekansh.xyz/api/github-stats
https://realekansh.xyz/api/github-stats/badge?metric=followers
```

This repository uses two tiny top-level Vercel route adapters:

```text
api/github-stats.js
api/github-stats-badge.js
```

The implementation still lives in this directory. The badge adapter is reached through one narrow `vercel.json` rewrite from `/api/github-stats/badge` to `/api/github-stats-badge`, because the deployed non-framework Vercel build did not expose the original `api/github-stats/` subtree as public routes.

## Known Limitations

- Process-local cache is best-effort and can reset on cold starts.
- Komarev profile views are parsed from its documented SVG badge because no documented JSON API was found.
- Fetching the Komarev badge can increment the Komarev counter; the 6 hour cache limits this effect.
- GitHub search counts depend on GitHub search indexing.
- Repository aggregation reads public owned repositories through the GitHub REST repositories API. It intentionally fails instead of silently undercounting if the configured page limit is exceeded.
- `commits` and `contributions` are trailing-365-day metrics and require a server-side GitHub token.
