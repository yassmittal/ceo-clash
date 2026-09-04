/**
 * Minimal Tripo API client.
 *
 * Tripo is task-based: you POST a task, poll it until it succeeds, then download
 * the result. Everything here is that loop plus typed helpers for the task types
 * this project uses.
 *
 * Needs TRIPO_API_KEY in .env (Bun loads it automatically).
 */
const BASE = "https://api.tripo3d.ai/v2/openapi";

const key = () => {
  const k = process.env.TRIPO_API_KEY;
  if (!k) throw new Error("TRIPO_API_KEY missing from .env");
  return k;
};

const headers = () => ({
  Authorization: `Bearer ${key()}`,
  "Content-Type": "application/json",
});

export interface TaskResult {
  task_id: string;
  status: string;
  progress: number;
  output: Record<string, unknown>;
  input?: Record<string, unknown>;
}

export async function balance(): Promise<number> {
  const r = await fetch(`${BASE}/user/balance`, { headers: headers() });
  const j = (await r.json()) as { data?: { balance: number } };
  return j.data?.balance ?? -1;
}

export async function createTask(body: Record<string, unknown>): Promise<string> {
  const r = await fetch(`${BASE}/task`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { code: number; message?: string; data?: { task_id: string } };
  if (j.code !== 0 || !j.data) {
    throw new Error(`tripo task failed (${j.code}): ${j.message ?? "unknown"}`);
  }
  return j.data.task_id;
}

export async function getTask(id: string): Promise<TaskResult> {
  const r = await fetch(`${BASE}/task/${id}`, { headers: headers() });
  const j = (await r.json()) as { code: number; message?: string; data?: TaskResult };
  if (j.code !== 0 || !j.data) throw new Error(`tripo poll failed: ${j.message}`);
  return j.data;
}

/** Poll until the task leaves the queue. Tripo tasks take 30s-3min. */
export async function waitFor(id: string, label = "task"): Promise<TaskResult> {
  const started = Date.now();
  let last = -1;
  for (;;) {
    const t = await getTask(id);
    if (t.progress !== last) {
      last = t.progress;
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      process.stdout.write(`\r  ${label}: ${t.status} ${t.progress}%  (${secs}s)   `);
    }
    if (t.status === "success") {
      console.log(`\r  ${label}: done in ${((Date.now() - started) / 1000).toFixed(0)}s          `);
      return t;
    }
    if (["failed", "cancelled", "banned", "expired", "unknown"].includes(t.status)) {
      console.log("");
      throw new Error(`${label} ended as "${t.status}"`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

/** Pull the first downloadable URL out of a task's output blob. */
export function outputUrl(t: TaskResult): string | null {
  const out = t.output as Record<string, unknown>;
  for (const k of ["pbr_model", "model", "rigged_model", "animated_model", "base_model"]) {
    const v = out[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
    if (v && typeof v === "object" && "url" in (v as Record<string, unknown>)) {
      const u = (v as { url?: string }).url;
      if (typeof u === "string") return u;
    }
  }
  return null;
}

export async function download(url: string, dest: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  await Bun.write(dest, await r.arrayBuffer());
  return dest;
}
