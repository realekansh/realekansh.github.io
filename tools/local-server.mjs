<<<<<<< HEAD
import { createReadStream, existsSync, statSync } from "node:fs";
=======
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
>>>>>>> 2a37c1d (feat: launch portfolio with major fixes and improvements)
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

<<<<<<< HEAD
=======
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

>>>>>>> 2a37c1d (feat: launch portfolio with major fixes and improvements)
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

createServer((request, response) => {
  const url = new URL(request.url || "/", "http://local");
  let relativePath = decodeURIComponent(url.pathname);

  while (relativePath.startsWith("/")) {
    relativePath = relativePath.slice(1);
  }

<<<<<<< HEAD
=======
  // Intercept and emulate Vercel's POST /api/send serverless endpoint
  if (request.method === "POST" && (relativePath === "api/send" || relativePath === "api/send/")) {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", async () => {
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(body);
      } catch (err) {
        // Fallback for form URLencoded body if needed
        try {
          const params = new URLSearchParams(body);
          parsedBody = Object.fromEntries(params.entries());
        } catch (e) {}
      }

      // Mock Vercel's req & res objects
      const reqMock = {
        method: "POST",
        body: parsedBody,
      };

      const resMock = {
        status(code) {
          response.writeHead(code, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return this;
        },
        json(data) {
          response.end(JSON.stringify(data));
        },
      };

      try {
        const apiPath = resolve(root, "api/send.js");
        const { default: handler } = await import(apiPath);
        await handler(reqMock, resMock);
      } catch (err) {
        console.error("Local API execution error:", err);
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: "Local API execution failed: " + err.message }));
      }
    });
    return;
  }

>>>>>>> 2a37c1d (feat: launch portfolio with major fixes and improvements)
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
<<<<<<< HEAD
=======
  console.log(`Form submission endpoint is active at http://127.0.0.1:${port}/api/send`);
>>>>>>> 2a37c1d (feat: launch portfolio with major fixes and improvements)
});
