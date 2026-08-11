import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

// Automatically load local .env variables into process.env if .env exists
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        // Remove surrounding single or double quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to parse local .env file:", err.message);
  }
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".xsl": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

createServer((request, response) => {
  const url = new URL(request.url || "/", "http://local");
  let relativePath = decodeURIComponent(url.pathname);

  while (relativePath.startsWith("/")) {
    relativePath = relativePath.slice(1);
  }

  // Intercept and emulate Vercel's POST /api/* serverless endpoints dynamically
  if (relativePath.startsWith("api/")) {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", async () => {
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(body);
      } catch (err) {
        try {
          const params = new URLSearchParams(body);
          parsedBody = Object.fromEntries(params.entries());
        } catch (e) {}
      }

      // Mock Vercel's req & res objects
      const reqMock = {
        method: request.method,
        headers: request.headers,
        url: request.url,
        query: Object.fromEntries(url.searchParams.entries()),
        cookies: parseCookies(request.headers.cookie || ""),
        body: parsedBody,
      };

      const resMock = {
        statusCode: 200,
        headers: {},
        setHeader(name, val) {
          this.headers[name] = val;
          return this;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.setHeader("Content-Type", "application/json; charset=utf-8");
          response.writeHead(this.statusCode, this.headers);
          response.end(JSON.stringify(data));
          return this;
        },
        redirect(urlStr) {
          response.writeHead(302, { Location: urlStr, ...this.headers });
          response.end();
          return this;
        },
        send(data) {
          response.writeHead(this.statusCode, this.headers);
          response.end(data);
          return this;
        }
      };

      function parseCookies(cookieHeader) {
        const list = {};
        if (!cookieHeader) return list;
        cookieHeader.split(";").forEach((cookie) => {
          let [name, ...rest] = cookie.split("=");
          name = name?.trim();
          if (!name) return;
          const val = rest.join("=").trim();
          list[name] = decodeURIComponent(val);
        });
        return list;
      }

      try {
        // Resolve API module path: e.g., api/send -> api/send.js, api/auth/login -> api/auth/login.js
        let subPath = relativePath.slice(4).replace(/\/$/, "");
        if (!subPath.endsWith(".js")) {
          subPath += ".js";
        }
        const apiPath = resolve(root, "api", subPath);
        if (existsSync(apiPath)) {
          const { default: handler } = await import(`file://${apiPath}?update=${Date.now()}`);
          await handler(reqMock, resMock);
          return;
        }
      } catch (err) {
        console.error("Local API execution error:", err);
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: "Local API execution failed: " + err.message }));
        return;
      }

      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "API route not found" }));
    });
    return;
  }

  let filePath = resolve(root, relativePath);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    // 404 Fallback
    const custom404 = resolve(root, "404.html");
    if (existsSync(custom404)) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      createReadStream(custom404).pipe(response);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mime[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Portfolio preview running at http://127.0.0.1:${port}`);
  console.log(`API Router emulation active under http://127.0.0.1:${port}/api/*`);
});
