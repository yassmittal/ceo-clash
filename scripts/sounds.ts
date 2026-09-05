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
 * CC0 results are preferred, so in the normal case nothing in the game carries an
 * attribution obligation. A query that returns no CC0 results falls back to
 * Attribution, and those entries are flagged in CREDITS.md — if any appear, that
 * credit has to ship with the game.
 *
 * Reads FREESOUND_CLIENT_SECRET from .env.
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
  const credits: string[] = [];
  let attributionRequired = false;

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
    attributionRequired ||= needsAttribution;
    const chosen = results.slice(0, pack.take);
    const files: string[] = [];

    for (const [i, s] of chosen.entries()) {
      const dest = `${OUT}/${name}-${i + 1}.mp3`;
      const have = await Bun.file(dest).exists();
      if (force || !have) {
        const audio = await fetch(s.previews["preview-hq-mp3"]);
        if (!audio.ok) {
          console.log(`  ${name}-${i + 1}: download failed (${audio.status})`);
          continue;
        }
        await Bun.write(dest, await audio.arrayBuffer());
      }
      files.push(dest);
      // Credited whether or not the file was downloaded this run. Doing this
      // inside the download branch — which is where it started life — meant any
      // re-run without --force rewrote CREDITS.md with no entries at all and
      // silently dropped the attribution for every sound already on disk.
      credits.push(
        `- \`${name}-${i + 1}.mp3\` — "${s.name}" by ${s.username} ` +
        `([freesound #${s.id}](https://freesound.org/s/${s.id}/))` +
        `${needsAttribution ? " — **CC-BY, attribution required**" : ""}`,
      );
    }

    manifest[name] = files.length;
    const sizes = await Promise.all(
      files.map(async (f) => (await Bun.file(f).arrayBuffer()).byteLength),
    );
    console.log(
      `  ${name.padEnd(10)} ${String(files.length).padStart(2)} files, ` +
      `${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0).padStart(4)} kB  ` +
      `${needsAttribution ? "CC-BY" : "CC0  "} — ${pack.note}`,
    );
  }

  const header = [
    "# Sound credits",
    "",
    "Sound effects from [freesound.org](https://freesound.org), fetched by",
    "`bun run sounds`. CC0 entries carry no obligations and are listed only",
    "because crediting people is polite.",
    "",
    attributionRequired
      ? "**Some entries below are CC-BY and their credit must ship with the game.**"
      : "Every entry below is CC0, so nothing here has to be credited on the menu.",
    "",
    "Refresh with `bun run sounds --force`.",
    "",
  ];
  // The client reads this to know how many variants of each sound exist.
  await Bun.write(`${OUT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await Bun.write(`${OUT}/CREDITS.md`, `${[...header, ...credits].join("\n")}\n`);
  console.log(
    `\nwrote ${OUT}/manifest.json and CREDITS.md (${credits.length} credited)` +
    `${attributionRequired ? "  ** CC-BY present: keep the credit **" : ""}`,
  );
}

await main();
