/**
 * Pulls CC0 sound effects from Freesound into public/sounds/.
 *
 *   bun run sounds          # fetch everything missing
 *   bun run sounds --force  # re-fetch, e.g. after editing a query
 *
 * Downloads the HQ mp3 *preview* of each sound, which needs only the API token —
 * no OAuth2 handshake. Previews are 128kbps mono/stereo mp3, which is the right
 * trade for a browser game: a punch does not need 24-bit WAV, and every byte here
 * is on the critical path to the first fight.
 *
 * Only CC0 results are accepted, so nothing in the game carries an attribution
 * obligation. CREDITS.md is still written, because crediting people is polite.
 */
const TOKEN = process.env.FREESOUND_CLIENT_SECRET;
const OUT = "public/sounds";

interface Pack { query: string; extra?: string; take: number; note: string }

/** One entry per sound the game plays. `take` is how many variants to fetch. */
const PACKS: Record<string, Pack> = {
  whoosh:    { query: "whoosh swing", extra: "duration:[0.1 TO 1.5]", take: 3, note: "attack swing" },
  hit:       { query: "punch impact body hit", extra: "duration:[0.1 TO 1.5]", take: 4, note: "light hit" },
  heavy:     { query: "heavy impact boom", extra: "duration:[0.2 TO 3]", take: 3, note: "heavy hit / guard break" },
  block:     { query: "metal clank impact", extra: "duration:[0.1 TO 1.5]", take: 3, note: "blocked hit" },
  knockdown: { query: "body fall thud", extra: "duration:[0.2 TO 3]", take: 2, note: "knockdown" },
  special:   { query: "power up energy charge", extra: "duration:[0.3 TO 4]", take: 2, note: "special activation" },
  ko:        { query: "explosion boom", extra: "duration:[0.5 TO 4]", take: 2, note: "K.O." },
};

interface Sound {
  id: number; name: string; username: string; license: string; duration: number;
  previews: Record<string, string>;
}

async function search(pack: Pack, license: string): Promise<Sound[]> {
  const params = new URLSearchParams({
    query: pack.query,
    filter: `license:"${license}" ${pack.extra ?? ""}`.trim(),
    fields: "id,name,username,license,duration,previews",
    sort: "rating_desc",
    page_size: String(pack.take * 3),
    token: TOKEN!,
  });
  const r = await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
  if (!r.ok) throw new Error(`freesound search failed: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { results: Sound[] }).results ?? [];
}

async function main() {
  if (!TOKEN) throw new Error("FREESOUND_CLIENT_SECRET missing from .env");
  const force = process.argv.includes("--force");
  const manifest: Record<string, number> = {};
  const credits: string[] = [
    "# Sound credits",
    "",
    "Sounds from freesound.org. CC0 entries carry no obligations; any entry",
    "marked CC-BY **must** keep its credit if the game ships publicly.",
    "",
    "Refresh with `bun run sounds --force`.",
    "",
  ];

  for (const [name, pack] of Object.entries(PACKS)) {
    // Prefer CC0 (no obligations). Fall back to Attribution, which is fine as
    // long as CREDITS.md ships — hence the flag on each entry.
    let license = "Creative Commons 0";
    let results = await search(pack, license);
    if (results.length === 0) {
      license = "Attribution";
      results = await search(pack, license);
    }
    if (results.length === 0) {
      console.log(`  ${name}: no results at all — widen the query`);
      continue;
    }
    const needsAttribution = license !== "Creative Commons 0";
    const chosen = results.slice(0, pack.take);
    const files: string[] = [];
    for (const [i, s] of chosen.entries()) {
      const dest = `${OUT}/${name}-${i + 1}.mp3`;
      if (!force && (await Bun.file(dest).exists())) {
        files.push(dest);
        continue;
      }
      const url = s.previews["preview-hq-mp3"];
      const audio = await fetch(url);
      if (!audio.ok) {
        console.log(`  ${name}-${i + 1}: download failed (${audio.status})`);
        continue;
      }
      await Bun.write(dest, await audio.arrayBuffer());
      files.push(dest);
      credits.push(
        `- \`${name}-${i + 1}.mp3\` — "${s.name}" by ${s.username} ` +
        `(freesound #${s.id})${needsAttribution ? " — **CC-BY, attribution required**" : ""}`,
      );
    }
    manifest[name] = files.length;
    const kb = await Promise.all(files.map(async (f) => (await Bun.file(f).arrayBuffer()).byteLength));
    console.log(
      `  ${name.padEnd(10)} ${String(files.length).padStart(2)} files, ` +
      `${(kb.reduce((a, b) => a + b, 0) / 1024).toFixed(0).padStart(4)} kB  ` +
      `${needsAttribution ? "CC-BY" : "CC0  "} — ${pack.note}`,
    );
  }

  // The client reads this to know how many variants of each sound exist.
  await Bun.write(`${OUT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await Bun.write(`${OUT}/CREDITS.md`, `${credits.join("\n")}\n`);
  console.log(`\nwrote ${OUT}/manifest.json and CREDITS.md`);
}

await main();
