import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const API_URL = "https://api.elevenlabs.io/v1/sound-generation";
const DEFAULT_PROMPT_FILE = "audio/production/foundation-v1.json";
const OUTPUT_DIRECTORY = "public/assets/audio/generated";
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const force = process.argv.includes("--force");
const promptFile = process.argv.find((argument) => argument.endsWith(".json")) ?? DEFAULT_PROMPT_FILE;

if (!API_KEY) {
  throw new Error("ELEVENLABS_API_KEY is required. Store it as a GitHub Actions repository secret.");
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const exists = async (filePath) => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const source = JSON.parse(await readFile(promptFile, "utf8"));
if (!Array.isArray(source.assets) || source.assets.length === 0) {
  throw new Error(`${promptFile} must contain a non-empty assets array.`);
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const generated = [];

for (const asset of source.assets) {
  if (!asset.id || !asset.prompt) throw new Error("Every audio asset requires id and prompt fields.");
  if (!/^[a-z0-9-]+$/.test(asset.id)) throw new Error(`Unsafe audio asset id: ${asset.id}`);

  const fileName = `${asset.id}.mp3`;
  const outputPath = path.join(OUTPUT_DIRECTORY, fileName);
  if (!force && await exists(outputPath)) {
    console.log(`Keeping existing ${fileName}`);
  } else {
    console.log(`Generating ${asset.id}...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let response;
    try {
      const url = new URL(API_URL);
      url.searchParams.set("output_format", OUTPUT_FORMAT);
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": API_KEY
        },
        body: JSON.stringify({
          text: asset.prompt,
          loop: Boolean(asset.loop),
          duration_seconds: asset.durationSeconds ?? null,
          prompt_influence: asset.promptInfluence ?? 0.45,
          model_id: "eleven_text_to_sound_v2"
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`ElevenLabs generation failed for ${asset.id}: HTTP ${response.status} ${detail}`);
    }

    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(`Wrote ${outputPath}`);
    await sleep(900);
  }

  generated.push({
    id: asset.id,
    file: `./assets/audio/generated/${fileName}`,
    category: asset.category ?? "sfx",
    loop: Boolean(asset.loop),
    volume: asset.volume ?? 1,
    prompt: asset.prompt,
    provider: "ElevenLabs",
    model: "eleven_text_to_sound_v2"
  });
}

const manifest = {
  pack: source.pack ?? "Project Ascension Audio",
  version: source.version ?? 1,
  generatedAt: new Date().toISOString(),
  outputFormat: OUTPUT_FORMAT,
  assets: generated
};

await writeFile(
  path.join(OUTPUT_DIRECTORY, "audio-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
console.log(`Generated audio pack manifest with ${generated.length} assets.`);
