import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vnuCli = require.resolve("vnu-jar/vnu-jar.js");
const appRoot = process.cwd();
const standaloneServer = resolve(appRoot, ".next", "standalone", "server.js");
const port = Number.parseInt(process.env.W3C_VALIDATOR_PORT ?? "3119", 10);
const origin = `http://127.0.0.1:${port}`;
const renderedRoutes = [
  "/",
  "/features",
  "/marketplaces",
  "/marketplaces/wildberries",
  "/marketplaces/ozon",
  "/marketplaces/yandex-market",
  "/marketplaces/avito",
  "/pricing",
  "/demo",
  "/resources",
  "/contacts",
  "/privacy",
  "/terms",
  "/app/ai-assistant",
  "/app/integrations",
  "/app/integrations/wildberries",
];

async function ensureBuildExists() {
  try {
    await stat(standaloneServer);
  } catch {
    throw new Error("Next.js production build not found. Run `npm run build` before W3C validation.");
  }
}

function routeFileName(route) {
  return route === "/" ? "index.html" : `${route.slice(1).replaceAll("/", "__")}.html`;
}

function startServer() {
  const child = spawn(process.execPath, [standaloneServer], {
    cwd: appRoot,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { redirect: "manual" });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Next.js server did not become ready within ${timeoutMs} ms: ${String(lastError ?? "unknown error")}`);
}

async function fetchRenderedPages(outputDirectory) {
  for (const route of renderedRoutes) {
    const response = await fetch(`${origin}${route}`, {
      headers: { "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Failed to render ${route}: HTTP ${response.status}`);
    }
    const html = await response.text();
    if (!/^<!doctype html>/i.test(html.trimStart())) {
      throw new Error(`Rendered route ${route} does not start with an HTML doctype`);
    }
    await writeFile(join(outputDirectory, routeFileName(route)), html, "utf8");
  }
}

function runVnu(files) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [vnuCli, "--format", "text", "--skip-info-messages", ...files], {
      cwd: appRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.once("error", rejectRun);
    child.once("close", (code) => {
      const hasConformanceMessage = /(?:^|\n)(?:Error|Warning):/m.test(output);
      if (code === 0 && !hasConformanceMessage) resolveRun();
      else rejectRun(new Error(`Nu Html Checker failed strict validation with code ${code}`));
    });
  });
}

let server;
let tempDirectory;

try {
  await ensureBuildExists();
  tempDirectory = await mkdtemp(join(tmpdir(), "respio-w3c-html-"));
  server = startServer();
  await waitForServer();
  await fetchRenderedPages(tempDirectory);
  const files = renderedRoutes.map((route) => join(tempDirectory, routeFileName(route)));
  await runVnu(files);
  console.log(`W3C/Nu HTML validation passed for ${files.length} rendered routes.`);
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
  }
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
