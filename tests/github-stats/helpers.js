import assert from "node:assert/strict";

export function createMockResponse() {
  const response = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  return response;
}

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export function textResponse(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      "Content-Type": "image/svg+xml",
      ...(init.headers || {}),
    },
  });
}

export function assertBadge(body) {
  assert.equal(body.schemaVersion, 1);
  assert.equal(typeof body.label, "string");
  assert.equal(typeof body.message, "string");
  assert.equal(typeof body.color, "string");
}
