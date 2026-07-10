import { readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const directory = "bootstrap";
const chunks = (await readdir(directory))
  .filter((name) => /^chunk-\d+\.b64$/.test(name))
  .sort();

if (chunks.length !== 9) {
  throw new Error(`Expected 9 archive chunks, found ${chunks.length}.`);
}

let encoded = "";
for (const chunk of chunks) {
  encoded += (await readFile(join(directory, chunk), "utf8")).trim();
}

const archivePath = join(directory, "project-ascension-foundation.tar.gz");
await writeFile(archivePath, Buffer.from(encoded, "base64"));
execFileSync("tar", ["-xzf", archivePath, "-C", "."], { stdio: "inherit" });

console.log("Project Ascension foundation source materialized.");
