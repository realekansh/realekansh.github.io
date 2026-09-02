import { PublicApiError } from "./errors.js";
import { UPSTREAM_TIMEOUT_MS, USER_AGENT } from "./config.js";

const KOMAREV_URL = "https://komarev.com/ghpvc/";

export async function fetchProfileViews(username, options = {}) {
  validateKomarevUsername(username);
  const url = new URL(KOMAREV_URL);
  url.searchParams.set("username", username);
  url.searchParams.set("label", "Profile views");
  url.searchParams.set("color", "blue");
  url.searchParams.set("style", "flat");

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || UPSTREAM_TIMEOUT_MS));

  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "image/svg+xml,text/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new PublicApiError("komarev_timeout", "Komarev profile views request timed out.", 504);
    }
    throw new PublicApiError("komarev_request_failed", "Komarev profile views request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new PublicApiError("komarev_api_error", "Komarev profile views request failed.", response.status >= 500 ? 502 : response.status);
  }

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !/(?:svg|xml|text\/plain|octet-stream)/i.test(contentType)) {
    throw new PublicApiError("invalid_komarev_response", "Komarev returned an unexpected content type.", 502);
  }

  const svg = await response.text();
  return parseKomarevCount(svg);
}

export function parseKomarevCount(svg) {
  if (!svg || typeof svg !== "string") {
    throw new PublicApiError("invalid_komarev_response", "Komarev returned an empty profile views response.", 502);
  }

  const decoded = decodeEntities(svg);
  if (!/<svg\b/i.test(decoded)) {
    throw new PublicApiError("invalid_komarev_response", "Komarev response was not an SVG badge.", 502);
  }

  const accessibleLabel = decoded.match(/(?:<title>|aria-label=["'])(?:Profile views|profile views)\s*:\s*([0-9][0-9,]*)/i);
  if (accessibleLabel) {
    return parseCount(accessibleLabel[1]);
  }

  const textValues = Array.from(decoded.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi))
    .map((match) => stripTags(match[1]).trim())
    .filter(Boolean);

  for (let index = textValues.length - 1; index >= 0; index -= 1) {
    const match = textValues[index].match(/^([0-9][0-9,]*)$/);
    if (match) {
      return parseCount(match[1]);
    }
  }

  throw new PublicApiError("invalid_komarev_response", "Komarev profile views response did not contain a parseable count.", 502);
}

function validateKomarevUsername(username) {
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    throw new PublicApiError("invalid_github_username", "Configured GitHub username is invalid.", 500);
  }
}

function parseCount(value) {
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number) || number < 0) {
    throw new PublicApiError("invalid_komarev_response", "Komarev profile views count was invalid.", 502);
  }
  return Math.floor(number);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
