import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_COMMIT = 'd10fd83c4bf7a5839a56706f1c04f13133271cfc';
const SOURCE_URL =
  `https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/` +
  `${SOURCE_COMMIT}/json/vn_only_simplified_json_generated_data_vn_units_minified.json`;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(
  scriptDirectory,
  '../client/public/data/vietnam-administrative-units.json',
);

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Administrative catalog download failed (${response.status}).`);
}

const catalog = await response.json();
const wardCount = Array.isArray(catalog)
  ? catalog.reduce((total, province) => total + (province.Wards?.length ?? 0), 0)
  : 0;

if (!Array.isArray(catalog) || catalog.length !== 34 || wardCount !== 3321) {
  throw new Error(
    `Unexpected administrative catalog shape: ${catalog?.length ?? 0} provinces, ${wardCount} wards.`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog)}\n`, 'utf8');
console.log(`Synced 34 provinces and ${wardCount} wards from ${SOURCE_COMMIT}.`);
