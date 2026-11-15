#!/usr/bin/env node

import { cp, access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const command = process.argv[2];
const flags = new Set(process.argv.slice(3));
const force = flags.has("--force");
const dryRun = flags.has("--dry-run");

if (command !== "init") {
  console.log("Usage: verified-form-mailer init [--force] [--dry-run]");
  process.exit(command ? 1 : 0);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const starterRoot = path.join(packageRoot, "starters", "cloudflare-pages");
const projectRoot = process.cwd();

const files = [
  ["functions/api/contact.js", "functions/api/contact.js"],
  ["functions/_lib/message.js", "functions/_lib/message.js"],
];

const existing = [];
for (const [, destination] of files) {
  try {
    await access(path.join(projectRoot, destination));
    existing.push(destination);
  } catch {
    // Destination does not exist.
  }
}

if (existing.length && !force) {
  console.error("These starter files already exist:");
  for (const file of existing) console.error(`  - ${file}`);
  console.error("\nNo files were changed. Use --force to overwrite them.");
  process.exit(1);
}

if (dryRun) {
  console.log("The following starter files would be copied:");
  for (const [, destination] of files) console.log(`  - ${destination}`);
  if (existing.length) console.log("\nExisting files would be overwritten because --force was supplied.");
  process.exit(0);
}

for (const [source, destination] of files) {
  const target = path.join(projectRoot, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(starterRoot, source), target, { force: true });
  console.log(`Created ${destination}`);
}

console.log("\nStarter files copied. Edit functions/_lib/message.js and configure your Cloudflare Pages environment variables before deploying.");
