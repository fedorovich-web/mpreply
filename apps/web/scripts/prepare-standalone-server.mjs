import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptsDirectory, "..");
const buildRoot = join(webRoot, ".next");
const standaloneRoot = join(buildRoot, "standalone");

await access(join(standaloneRoot, "server.js"));

const assets = [
  { source: join(buildRoot, "static"), destination: join(standaloneRoot, ".next", "static") },
  { source: join(webRoot, "public"), destination: join(standaloneRoot, "public") },
];

for (const { source, destination } of assets) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

process.stdout.write(`Prepared standalone production server at ${standaloneRoot}.\n`);
