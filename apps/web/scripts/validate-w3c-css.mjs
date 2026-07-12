import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vnuCli = require.resolve("vnu-jar/vnu-jar.js");
const appRoot = process.cwd();
const styleFiles = [
  "styles/fonts.css",
  "styles/tokens.css",
  "styles/theme.css",
  "styles/globals.css",
  "styles/public-site.css",
];

function stripImports(source) {
  return source.replace(/^\s*@import\s+[^;]+;\s*$/gim, "");
}

function runVnu(file) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [vnuCli, "--format", "text", "--skip-info-messages", file], {
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
      else rejectRun(new Error(`Nu Html Checker CSS validation failed strict validation with code ${code}`));
    });
  });
}

let tempDirectory;
try {
  const styleBlocks = [];
  for (const file of styleFiles) {
    const source = stripImports(await readFile(resolve(appRoot, file), "utf8"));
    styleBlocks.push(`/* ${file} */\n${source}`);
  }

  tempDirectory = await mkdtemp(join(tmpdir(), "respio-w3c-css-"));
  const fixture = join(tempDirectory, "styles.html");
  const html = [
    "<!doctype html>",
    '<html lang="ru">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>Respio CSS validation fixture</title>",
    "<style>",
    ...styleBlocks,
    "</style>",
    "</head>",
    "<body><main><h1>Respio CSS validation fixture</h1></main></body>",
    "</html>",
  ].join("\n");
  await writeFile(fixture, html, "utf8");
  await runVnu(fixture);
  console.log(`W3C/Nu CSS validation passed for ${styleFiles.length} stylesheet sources.`);
} finally {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
