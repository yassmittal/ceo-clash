# What's left, and who does it

The MVP is done and playable (`bun run dev`). Everything below is the gap between
"playable" and "shipped".

Three lists: what only you can do, what I can do if you get a free API key, and
what I can do right now for free.

---

## Part 1 — Only you can do these

### 1. Real character models — **done, no longer manual**

This was the big one, and it turned out not to need Blender or Mixamo at all.
`bun run characters build all` now does the whole thing through the Tripo API:
generate → auto-rig → optimise → `public/models/*.glb`. See the README for how
the retargeting works.

Both fighters are in the game and animating. What is left here is taste, not
labour:

- **Re-roll a character you don't like.** Edit the prompt at the top of
  `scripts/characters.ts`, delete that entry from `assets/source/manifest.json`,
  and re-run. ~45 credits a go (~380 left, so ~8 more rolls). Generation is a
  lottery — Sam took two attempts; the first roll came out with lavender skin.
- **Check the preview before spending rig credits.** Each build writes
  `assets/source/<id>-preview.png`.
- **Keep "strict T-pose, arms straight out horizontally" in any prompt you
  write.** Auto-rigging fails on posed models, and that phrasing is what
  reliably produces one.

If you do want a Mixamo-rigged model instead, drop it at `public/models/<id>.glb`
and it will just load — bone lookup is normalised across naming conventions.

### 2. Playtest it on actual humans

The plan's success metric is one specific thing: **does someone lose and
immediately reach for Rematch?** I can verify the game works, but I cannot tell
you whether it's fun.

Put it in front of 5 people who have never seen it. Say nothing except "play this".
Watch for:

- Do they understand the controls without being told? (target: ~10 seconds)
- Do they discover blocking on their own, or just mash punch?
- Do they laugh at any point?
- **When they lose, do they hit Rematch?** — this is the whole question
- Is the AI frustrating-hard or boring-easy?

Bring me what you observe and I'll tune it. The dials are all in
`src/combat/moves.ts` and `src/ai/FighterAI.ts`, and `bun run balance` measures
any change in about five seconds.

---

### 3. Deploy it

Needs your account. Any of these are free for a static site:

- **Vercel** — `bunx vercel` in the project, or connect the repo on vercel.com
- **Netlify** — drag the `dist/` folder onto app.netlify.com/drop, literally
- **Cloudflare Pages** — build command `bun run build`, output directory `dist`

Build settings are the same everywhere: build `bun run build`, publish `dist`. It's
a single page with no routing, so no redirect rules are needed.

→ I can write the config file for whichever you pick, and I can run the build.
I can't log into your account.

---

### 4. Decide how far to go on the likenesses

The game currently uses two real people's first names. Worth a moment's thought
before it's public, not after:

- Personality/publicity rights vary by country, and parody protections vary with
  them. Commercial use (ads, payments) raises the stakes; a free joke game lowers
  them.
- Practical mitigations, cheapest first: keep the art clearly cartoonish and
  non-photoreal, keep the disclaimer on the menu, don't imply endorsement, don't
  monetise it, and don't put either company's actual logo or branding anywhere.
- The safest version is fictional names that are obviously nods ("SAMA" / "DARI",
  or invented CEOs entirely). Costs you a little of the joke, removes the question.

Your call — I've flagged it because it's much cheaper to decide now than after it
gets traction.

---

### 5. Small stuff

- **Domain**, if you want one.
- **A social preview image** — one screenshot, plus `og:image` / `twitter:card`
  meta tags in `index.html`. I can write the tags; you take the screenshot you like.

---

## Part 2 — I can do these, if you get a free key

Only get these if you actually want the feature. Check the current free limits
yourself before signing up — they change, and I'd rather you not be surprised.

| Key | Status | Used for |
|---|---|---|
| **Tripo** | ✅ working, ~380 credits | Character generation + auto-rigging. 20 credits to generate, 25 to rig. |
| **Freesound** | ✅ working | 19 CC0 sound effects, already pulled. No OAuth needed — HQ mp3 previews download with just the token. |
| **ElevenLabs** | ✅ working, free tier, 10k chars | Announcer VO — not wired up yet. Worth spending once the lines are final. |
| **Pixazo** | ⚠️ endpoint unknown | An *image* API, not 3D. Grab the real endpoint from the dashboard's API Docs and it could generate concept art to feed image-to-3D. |
| **3D AI Studio** | ❌ key rejected | Auth scheme is `Authorization: Token <key>`, but the key came back "Invalid token". Rotate and retry, or skip — Tripo covers this. |

**Honestly though:** for a parody game, recording the announcer yourself on a phone
is both free and funnier than TTS. And the synthesised hit sounds already work —
real samples are an upgrade, not a fix.

**No API exists for Mixamo.** It's browser-only, no public API, no automation.
That step is genuinely yours.

If you'd rather avoid the whole account dance, there are non-Mixamo rigging routes
— [AccuRig](https://actorcore.reallusion.com/auto-rig) (free) plus ActorCore's free
animation pack, or Rokoko's free retargeting — but they're all still GUI tools.
Mixamo remains the least painful.

---

## Part 3 — I can do these right now, no key needed

1. **Announcer VO** with the ElevenLabs key you already added — "FIGHT!", "K.O.",
   "GUARD BROKEN", the KO taglines. 10k free characters is plenty; the
   announcement system is already there to trigger them.
2. **Deployment config** for whichever host you pick.
3. **Combat tuning** from your playtest notes.
4. **More content within the current system** — a second arena, more moves
   (uppercut, dodge), a third fighter (just a new prompt + stat block).
5. **Mobile/touch controls** — the input layer was built for this; it's a new
   `Intent` source and an on-screen pad, nothing else changes.
6. **Trim the bundle** — Rapier is still 816kB gzipped and does very little here
   (see the README's trade-off note).

---

## Suggested order

1. **Playtest** (Part 1 §2). The models are in, the sound is in — it is worth
   showing people now. If they hit Rematch, everything else is polish.
2. **Deploy** (§3). Twenty minutes, and it makes playtesting a link instead of a
   build.
3. **Re-roll any character you don't like** (§1) — cheap and quick.
4. **Then decide** what the feedback says to fix.

The plan you wrote still applies: *gameplay first, assets second, polish third.*
Assets are done. You are on polish now — which means playtesting is the thing
that tells you what to do next.
