/**
 * Character asset pipeline: text -> 3D -> rigged -> game-ready GLB.
 *
 *   bun run characters build sam      # full pipeline for one fighter
 *   bun run characters build all
 *   bun run characters status
 *
 * Every stage is cached in assets/source/manifest.json, so re-running only does
 * the work that is missing. Tripo tasks cost credits (20 to generate, 25 to rig)
 * and the manifest is what stops a re-run from spending them twice.
 *
 * This replaces the entire Blender + Mixamo leg of the original plan. Tripo's
 * auto-rigger emits a Mixamo-named skeleton, which is exactly what the game's
 * animation clips already address, so no retargeting is needed.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { balance, createTask, download, outputUrl, waitFor } from "./lib/tripo.ts";

/**
 * Reading a Tripo export requires the meshopt decoder — their GLBs ship
 * compressed with EXT_meshopt_compression, and without it the file will not
 * parse at all. Output is written uncompressed so the browser needs no decoder.
 */
async function makeIO() {
  await MeshoptDecoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

const SOURCE_DIR = "assets/source";
const OUT_DIR = "public/models";
const MANIFEST = `${SOURCE_DIR}/manifest.json`;

/**
 * Original stylised parody characters — tech-CEO archetypes, deliberately not
 * likenesses of anyone. The T-pose wording matters: Tripo's auto-rigger fails on
 * posed models, and "arms straight out horizontally" is what reliably produces one.
 */
const PROMPTS: Record<string, string> = {
  sam: [
    "stylized low-poly video game character, cartoon man, tech startup founder",
    "short brown hair, grey henley shirt, dark blue jeans, white sneakers",
    "standing in a strict T-pose, arms straight out horizontally to both sides, legs straight",
    "full body, facing forward, symmetrical, big head chunky proportions",
    "clean simple flat colors, game asset, plain white background",
  ].join(", "),
  dario: [
    "stylized low-poly video game character, cartoon man, thoughtful researcher",
    "dark curly hair, short beard, glasses, navy blue sweater, khaki trousers, brown shoes",
    "standing in a strict T-pose, arms straight out horizontally to both sides, legs straight",
    "full body, facing forward, symmetrical, big head chunky proportions",
    "clean simple flat colors, game asset, plain white background",
  ].join(", "),
};

interface Entry { modelTask?: string; rigTask?: string; optimized?: string }
type Manifest = Record<string, Entry>;

async function readManifest(): Promise<Manifest> {
  const f = Bun.file(MANIFEST);
  return (await f.exists()) ? ((await f.json()) as Manifest) : {};
}
async function writeManifest(m: Manifest) {
  await Bun.write(MANIFEST, JSON.stringify(m, null, 2));
}
const mb = (n: number) => `${(n / 1e6).toFixed(2)} MB`;
const sizeOf = async (p: string) => (await Bun.file(p).arrayBuffer()).byteLength;

/** Triangle count across every primitive in the document. */
// biome-ignore lint/suspicious/noExplicitAny: gltf-transform document types
const triangles = (doc: any) =>
  doc.getRoot().listMeshes()
    // biome-ignore lint/suspicious/noExplicitAny: as above
    .flatMap((m: any) => m.listPrimitives())
    // biome-ignore lint/suspicious/noExplicitAny: as above
    .reduce((n: number, p: any) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);

/**
 * AI generators emit ~280k uniform triangles and 2K textures. A fighting game
 * needs neither: two characters are on screen, never closer than a few metres.
 */
async function optimize(input: string, output: string) {
  const io = await makeIO();
  const doc = await io.read(input);
  const beforeTris = triangles(doc);

  // Two fighters on screen, never closer than a few metres: ~80k triangles each
  // is already more than the camera can resolve.
  const TRIANGLE_BUDGET = 80_000;
  const simplifyRatio = Math.min(0.25, TRIANGLE_BUDGET / Math.max(beforeTris, 1));

  await doc.transform(
    dedup(),
    weld(),
    resample(),
    prune(),
    // Aim at an absolute triangle budget rather than a fixed ratio, because
    // inputs vary enormously — a hand-exported Tripo model can arrive at 1.9M
    // triangles where the API's own output is 300k. The 0.25 ceiling is the
    // safety rail: past it the simplifier collapses vertices across skinning
    // boundaries and heads deform once the model animates, which a static
    // preview will not show you.
    simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: 0.005 }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [384, 384], quality: 75 }),
    // Vertex attributes at full float precision are most of what is left; 
    // quantizing roughly halves the file with no visible difference at this scale.
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 10 }),
  );

  await io.write(output, doc);
  const skins = doc.getRoot().listSkins().length;
  if (skins === 0) throw new Error("optimization destroyed the skin — the model would not animate");
  console.log(
    `  optimized: ${mb(await sizeOf(input))} -> ${mb(await sizeOf(output))}, ` +
    `${beforeTris.toFixed(0)} -> ${triangles(doc).toFixed(0)} tris, skin intact`,
  );
}

async function build(id: string) {
  const prompt = PROMPTS[id];
  if (!prompt) throw new Error(`no prompt defined for "${id}" (have: ${Object.keys(PROMPTS).join(", ")})`);

  const manifest = await readManifest();
  const entry: Entry = manifest[id] ?? {};
  console.log(`\n${id}:`);

  if (!entry.modelTask) {
    entry.modelTask = await createTask({ type: "text_to_model", prompt, model_version: "v2.5-20250123" });
    manifest[id] = entry;
    await writeManifest(manifest);
    console.log(`  generate: task ${entry.modelTask}`);
  }
  const model = await waitFor(entry.modelTask, "  generate");

  // Preview render, so the look can be judged before spending rig credits.
  // biome-ignore lint/suspicious/noExplicitAny: tripo output blob is untyped
  const out = model.output as any;
  const img = out.rendered_image?.url ?? out.rendered_image;
  if (img) await download(img, `${SOURCE_DIR}/${id}-preview.png`);

  if (!entry.rigTask) {
    const check = await waitFor(
      await createTask({ type: "animate_prerigcheck", original_model_task_id: entry.modelTask }),
      "  rigcheck",
    );
    // biome-ignore lint/suspicious/noExplicitAny: as above
    if (!(check.output as any).riggable) throw new Error(`${id} is not riggable — regenerate with a clearer T-pose`);
    entry.rigTask = await createTask({
      type: "animate_rig",
      original_model_task_id: entry.modelTask,
      out_format: "glb",
      spec: "mixamo",
    });
    manifest[id] = entry;
    await writeManifest(manifest);
  }
  const rigged = await waitFor(entry.rigTask, "  rig");

  const raw = `${SOURCE_DIR}/${id}-rigged.glb`;
  const url = outputUrl(rigged);
  if (!url) throw new Error("rig task produced no downloadable model");
  await download(url, raw);

  await optimize(raw, `${OUT_DIR}/${id}.glb`);
  entry.optimized = `${OUT_DIR}/${id}.glb`;
  manifest[id] = entry;
  await writeManifest(manifest);
}

async function status() {
  const m = await readManifest();
  console.log(`tripo credits: ${await balance()}\n`);
  for (const id of Object.keys(PROMPTS)) {
    const e = m[id];
    const built = e?.optimized && (await Bun.file(e.optimized).exists());
    console.log(`  ${id.padEnd(8)} ${built ? `built  ${mb(await sizeOf(e.optimized!))}` : e ? "in progress" : "not started"}`);
  }
}

/** The bones the game's clips drive. Anything missing here will not animate. */
const REQUIRED_BONES = [
  "Hips", "Spine", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot",
  "RightUpLeg", "RightLeg", "RightFoot",
];

const canon = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^mixamorig/, "");

/**
 * Checks an imported GLB against what the game needs, and explains any problem
 * in terms of what to change in the export — the failures all happen at export
 * time, and none of them are obvious from looking at the model.
 */
// biome-ignore lint/suspicious/noExplicitAny: gltf-transform document types
async function validate(doc: any): Promise<string[]> {
  const problems: string[] = [];
  const root = doc.getRoot();

  const skins = root.listSkins();
  if (skins.length === 0) {
    problems.push(
      "No skeleton. This is an unrigged mesh, so it cannot animate at all.\n" +
      "      Fix: in Tripo, run the model through Animation / Rigging before\n" +
      "      exporting, and pick the Mixamo bone convention.",
    );
    return problems; // nothing else is meaningful without a skeleton
  }

  // biome-ignore lint/suspicious/noExplicitAny: as above
  const joints = skins[0].listJoints() as any[];
  const byName = new Map<string, any>(joints.map((j) => [canon(j.getName()), j]));
  const missing = REQUIRED_BONES.filter((b) => !byName.has(canon(b)));
  if (missing.length) {
    problems.push(
      `Skeleton is missing ${missing.length} bone(s) the animations drive: ${missing.join(", ")}.\n` +
      "      Fix: re-rig with the Mixamo (humanoid) skeleton rather than a custom one.",
    );
  }

  // Rest pose: the clips are corrected for a T-pose, so an A-pose export will
  // animate with its arms in the wrong place.
  const arm = byName.get("leftarm");
  const fore = byName.get("leftforearm");
  if (arm && fore) {
    const a = arm.getWorldMatrix();
    const b = fore.getWorldMatrix();
    const dir = [b[12] - a[12], b[13] - a[13], b[14] - a[14]];
    const len = Math.hypot(...dir) || 1;
    const horizontal = Math.hypot(dir[0], dir[2]) / len;
    if (horizontal < 0.7) {
      problems.push(
        `Rest pose looks like an A-pose (upper arm is ${(horizontal * 100).toFixed(0)}% horizontal).\n` +
        "      The game corrects for a T-pose, so the arms will sit wrong.\n" +
        "      Fix: export in a strict T-pose — arms straight out to the sides.",
      );
    }
  }
  return problems;
}

/**
 * Installs a GLB produced outside this pipeline (a Tripo export done by hand, a
 * Mixamo download, anything with a humanoid skeleton).
 */
async function importModel(file: string, id: string) {
  if (!(await Bun.file(file).exists())) throw new Error(`no such file: ${file}`);
  if (!/\.glb$/i.test(file)) {
    throw new Error("expected a .glb — export as glTF Binary so textures travel in one file");
  }

  const io = await makeIO();
  const doc = await io.read(file);

  console.log(`\nchecking ${file}`);
  const problems = await validate(doc);
  if (problems.length) {
    console.log("");
    for (const p of problems) console.log(`  ✗ ${p}`);
    console.log("");
    throw new Error("model is not usable yet — see above");
  }
  console.log("  ✓ skeleton, bone names and T-pose all look right");

  // Keep the untouched original: optimisation is lossy and re-runnable.
  const raw = `${SOURCE_DIR}/${id}-rigged.glb`;
  const alreadyInPlace = (await Bun.file(raw).exists()) &&
    Bun.pathToFileURL(raw).pathname === Bun.pathToFileURL(file).pathname;
  if (!alreadyInPlace) await Bun.write(raw, Bun.file(file));

  console.log(`\n${id}:`);
  await optimize(raw, `${OUT_DIR}/${id}.glb`);

  const manifest = await readManifest();
  manifest[id] = { ...(manifest[id] ?? {}), optimized: `${OUT_DIR}/${id}.glb` };
  await writeManifest(manifest);

  const known = ["sam", "dario"].includes(id);
  console.log(
    known
      ? `\ndone — "${id}" is live in the game, no code change needed.`
      : `\ndone. "${id}" is a new fighter, so it still needs a character definition:\n` +
        `  1. copy src/characters/Sam.ts to src/characters/${id}.ts and edit the stats\n` +
        `  2. register it in src/characters/index.ts\n` +
        `  3. add a useGLTF.preload("/models/${id}.glb") in src/characters/Fighter.tsx`,
  );
}

async function reoptimize(id: string) {
  const raw = `${SOURCE_DIR}/${id}-rigged.glb`;
  if (!(await Bun.file(raw).exists())) throw new Error(`no cached source at ${raw} — run build first`);
  console.log(`\n${id}:`);
  await optimize(raw, `${OUT_DIR}/${id}.glb`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "status" || !cmd) await status();
else if (cmd === "optimize") {
  for (const id of arg === "all" || !arg ? Object.keys(PROMPTS) : [arg]) await reoptimize(id);
} else if (cmd === "import") {
  const [, file, id] = process.argv.slice(2);
  if (!file || !id) throw new Error("usage: characters import <file.glb> <id>");
  await importModel(file, id);
}
else if (cmd === "build") {
  const ids = arg === "all" || !arg ? Object.keys(PROMPTS) : [arg];
  for (const id of ids) await build(id);
  console.log(`\ncredits remaining: ${await balance()}`);
} else {
  console.log(
    "usage: characters [status | build <id|all> | optimize <id|all> | import <file.glb> <id>]",
  );
}
