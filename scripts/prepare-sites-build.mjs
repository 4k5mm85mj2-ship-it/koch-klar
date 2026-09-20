#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const importer = path.join(root, "worker", "hello-fresh-importer.js");
const hosting = path.join(root, ".openai", "hosting.json");
const menuSnapshot = path.join(root, "src", "data", "menu-snapshot.json");

for (const file of [index, worker, importer, hosting, menuSnapshot]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
mkdirSync(path.join(dist, "client", "data"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(importer, path.join(dist, "server", "hello-fresh-importer.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
copyFileSync(menuSnapshot, path.join(dist, "client", "data", "menu.json"));

console.log("Prepared Sites build: worker, importer, hosting manifest, and menu snapshot");
