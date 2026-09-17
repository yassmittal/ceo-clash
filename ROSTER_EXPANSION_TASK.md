# Task: expand the roster beyond Sam and Dario

Add more famous people as fighters (Donald Trump, Elon Musk, Mark Zuckerberg,
Tim Cook, and optionally a few more), using the same pipeline that built Sam and
Dario: a freely-licensed photo, then a face texture, then a Tripo head, then a
character def. Every new fighter should look and play as finished as the first two.

`README.md` is the reference for how each step was done the first time. This file
is the plan for doing it again for N fighters. Work through the phases in order.
Each phase ends with an **exit check**, and the next phase doesn't start until
that check passes.

> House rule: no git commands. Leave all changes in the working tree.

---

## Phase 0: Lock the roster and the rules (no code)

Decide these before anything costs credits.

**Roster.** The named four, plus optional extras:

| id | name | working title | special kind (existing) |
|---|---|---|---|
| `trump` | DONALD | THE DEALMAKER | strike |
| `elon` | ELON | THE SHIPPOSTER | strike |
| `zuck` | MARK | THE METAVERSE | counter |
| `cook` | TIM | THE OPERATOR | counter |
| *(optional)* `jensen`, `sundar`, `satya`, `bezos` | | | |

Titles, taglines and specials are placeholders to settle in Phase 5.

**Photo licence rules.** These are the same constraints that `public/faces/CREDITS.md` already follows:
- Accept only **public domain**, **CC0**, **CC BY** or **CC BY-SA** photos from Wikimedia Commons.
  Never use Getty, news agency, company press-kit or Google Images photos.
- **Public domain is best.** An official US government portrait (such as the White
  House portrait of Trump) is a federal work and carries no obligation.
- **CC BY-SA is allowed, with a cost.** ShareAlike carries over to the derived
  `<id>.webp` and `<id>-head.glb`, so those files must be marked CC BY-SA in the
  credits. Choose a CC BY or public domain photo of the same person when one is usable.
- The photo must be **near-frontal, well-lit, high-resolution and unobstructed**:
  no sunglasses, no microphone across the chin, no heavy side light. Tripo
  reconstructs whatever it's given.

**Parody tone rules.** All of these are real people, and one of them is a
sitting head of state:
- Jokes target the **public persona or company** (shipping, keynotes, the
  metaverse, deals, rockets, supply chains). No fake quotes presented as real, no
  claims of crimes, nothing about family, health, religion or ethnicity.
- Keep political jokes out, or make them as toothless as the AI jokes are now.
  The comedy engine is `brainrot.ts`, and it should stay dumb and harmless.
- The existing "unaffiliated parody, not endorsed" disclaimer stays and covers everyone.

**Credits check.** Check the Tripo balance, which pays for one image-to-3D
generation plus one decimation per head. Also check that Tripo's terms allow
generating models of real people's likenesses.

**Exit check:** the roster is final, and each person has a chosen Commons file with
its licence and author written down. The Tripo balance covers
`len(new fighters)` generations.

---

## Phase 1: Generalise the engine from 2 fighters to N (no new art yet)

The code assumes exactly two fighters in several places. Fix all of them while the
roster is still Sam and Dario, so any regression is easy to see.

- [ ] `src/game/types.ts:25`: `FighterId = "sam" | "dario"`. Derive it from the
      roster instead, for example with an `as const` id list in `characters/index.ts`, so adding a
      fighter never means editing a type union by hand.
- [ ] `src/characters/index.ts:5-7`: `CHARACTERS` / `CHARACTER_LIST` become
      data-driven, and **`other()` goes away**, because two fighters can no longer
      imply the opponent.
- [ ] `src/state/gameStore.ts:62-83`: `selectCharacter(id)` sets
      `opponentId: other(id)`. Replace it with an explicit opponent (see Phase 2)
      and keep the defaults valid.
- [ ] `src/characters/rig/heads.ts:67-70`: `preloadHeads()` hardcodes both ids.
      With 6+ heads at ~200–310 kB each, **don't preload all of them.** Warm only
      the selected pair when select finishes, during the existing `LOADING`
      phase. Keep the "resolve null → blocky fallback" behaviour.
- [ ] `src/characters/rig/faces.ts`: already per-id. Check that nothing
      hardcodes the list.
- [ ] `src/styles.css:11-12, 125-126, 186-187, 242-243`: per-fighter classes
      (`--sam`, `.card--dario`, `.portrait--sam`, …). Replace them with one rule driven
      by a `--fighter` custom property set inline from `def.colors.primary`, so a
      new fighter needs zero CSS.
- [ ] `src/components/Menu/MainMenu.tsx:25-27`: "SAM VS DARIO". Make it a
      rotating/random pair, or a roster strip.
- [ ] `src/components/Menu/MainMenu.tsx` disclaimer: the photographer names are
      hardcoded. Drive the line from a small `credits` list, such as a
      `photoCredit` field on `CharacterDef` or a generated `src/characters/credits.ts`,
      and group names by licence (PD / CC BY 2.0 / CC BY-SA …).
- [ ] Specials: `combat/moves.ts:114` and `animations/clips.ts:650` choose the
      move and clip by `special.kind` (`strike` → GPT_SMASH, `counter` →
      CLAUDE_COUNTER). For this task, **reuse those two kinds** with a per-character
      display name, and allow optional per-character tuning overrides (damage,
      startup, lunge) on the def. Entirely new special mechanics are out of scope.
      They're listed under "Later".
- [ ] `src/ai/FighterAI.ts`: check that the AI reads everything from `def` and
      nothing is keyed by id.
- [ ] `scripts/simulate.ts:53-54` and `scripts/balance.ts:142-181`: both hardcode
      sam/dario. Make `sim` run its scenario checks once per special kind, and
      make `balance` run a **round-robin over every pair**.

**Exit check:** `bun run build` is clean and `bun run sim` passes. `bun run balance`
prints the same Sam-vs-Dario numbers it printed before, within noise. In the
browser, Sam vs Dario plays exactly as it did, and nothing outside
`characters/` mentions `sam` or `dario` (`grep -rniE "sam|dario" src` should only hit
`characters/` and comments).

---

## Phase 2: Pick an opponent, and a select screen that scales

- [ ] Character select becomes a two-step flow: pick your fighter, then pick an
      opponent or hit **Random**. A "Random opponent" default keeps the old
      one-click flow.
- [ ] Rematch keeps the same pair. Add a "New opponent" option on the winner screen.
- [ ] `.select-grid` needs to hold 6–8 cards. On desktop, use a compact grid with a detail panel
      for the hovered/selected card. On mobile, use a horizontal snap-scroll or a 2-column grid of
      portraits with stats in a sheet. It must stay thumb-friendly, per the mobile goal
      in `private.md`.
- [ ] Keyboard: arrow keys move the selection and Enter confirms, so the flow still works without a mouse.

**Exit check:** every fighter can be picked against every other fighter
using keyboard, mouse and touch, at 375px and at desktop width. It still works
with only Sam and Dario in the roster.

---

## Phase 3: Source photos and face textures (per fighter)

Repeat for each new fighter. This step is local and free.

- [ ] Add a `Face(...)` entry to `FACES` in `scripts/build-faces.py` with
      `commons_file`, `author`, `license`, `license_url`, `source_url`. Tune `crop`
      (fractions of the source), `exposure`, `skin_at` and `hair_at`.
- [ ] `license_url` must match the real licence (PD / CC BY / CC BY-SA), not
      the CC BY 2.0 copied from Sam.
- [ ] Run `python3 scripts/build-faces.py`, then check each `public/faces/<id>.webp`
      next to Sam's and Dario's. They should look as though they were shot in the same room.
- [ ] Write the sampled `skin`/`hair` hexes the script prints into the character def
      (Phase 5).
- [ ] Update `public/faces/CREDITS.md`, generated or hand-written, with one section per
      fighter.

**Exit check:** every new fighter has a 512² face, and the portrait looks right on
the select card. Credits list the source, author, licence and changes for every face.

---

## Phase 4: 3D heads via Tripo (per fighter, costs credits)

- [ ] Add a `Head(...)` entry to `HEADS` in `scripts/build-heads.py`
      (`crop` must be wider than the face crop, with hair included, plus `neck_cut`, `neck_tilt`,
      `exposure`).
- [ ] Before generating, look at `assets/source/heads/<id>-photo.png`,
      the white-matted crop that gets uploaded. The whole head and hair must be inside
      the frame, and nothing should cover the chin.
- [ ] Generate **one fighter at a time**, not in a batch. Add a filter such as `--only <id>`
      to the script if it doesn't have one, so `--regenerate` never re-spends credits on
      Sam and Dario.
- [ ] Run `python3 scripts/build-heads.py --preview` and review the four-sided sheet. Tune
      `neck_cut`/`neck_tilt` locally, which is free. Only regenerate if the mesh itself is wrong,
      for example an invented skull or a merged collar.
- [ ] Check the shipped size: each `public/models/<id>-head.glb` should be ≤ ~320 kB.
- [ ] Generalise `credits()` in `build-heads.py:193`, which hardcodes "`sam-head.glb` and
      `dario-head.glb`", so it lists every head and its licence. Note which ones are
      CC BY-SA.
- [ ] The gloves and shoes are shared and tinted by accent colour, so they need no new generation.

**Exit check:** in-game, each head reads as the right person from the side-on
camera, including the head-turn toward camera. It sits on the neck with no gap or
collar showing, and it takes the hit flash. When the GLB is deleted, the blocky
fallback head still appears.

---

## Phase 5: Character definitions and comedy

For each fighter, create `src/characters/<Name>.ts`, matching the shape of `Sam.ts`:

- [ ] `name`, `title`, `tagline`, following Phase 0 tone rules.
- [ ] `stats`: give each fighter a distinct *feel*, not just new numbers.
      Suggested archetypes: rushdown (high speed/aggression), tank (defense),
      glass cannon (attack), counter-puncher. Keep totals roughly equal to Sam's and Dario's
      (270).
- [ ] `special`: `kind` + `name` + `description`, plus optional tuning overrides from
      Phase 1.
- [ ] `colors`: a `primary`/`accent` pair that is clearly distinct from every other
      fighter on the HUD and select screen. Use the sampled `skin`/`hair` from Phase 3.
- [ ] `koLines`: 4 lines each.
- [ ] `brainrot.ts`: the shared lines are all AI-lab jokes. Either make them
      generic, or add optional per-character `bigHitLines`/`specialLines` on the def
      and fall back to the shared pool.
- [ ] `ARENA_TICKER`: add a few lines that nod to the wider roster.

**Exit check:** each fighter's select card, HUD name, winner screen and KO lines
read correctly, and no line breaks the Phase 0 tone rules.

---

## Phase 6: Balance

- [ ] Run `bun run balance` round-robin. Every pairing should land at 40–60% win rate over
      ≥40 matches, with match length inside the plan's 30s–2min window.
- [ ] Tune through `stats` and special overrides only. Don't touch the shared frame data
      in `combat/moves.ts` unless every pairing is off in the same direction.
- [ ] `bun run sim` still passes for both special kinds.
- [ ] Record the final matrix in the README's Verification section, replacing the
      single "21/19" line.

**Exit check:** no fighter wins more than 60% of its matchups overall, and no single
pairing falls outside 35–65%.

---

## Phase 7: Performance and polish

- [ ] Loading: only the chosen pair's heads are fetched and decoded. Measure the time from
      select to countdown on a throttled "Fast 4G" profile, and show the existing
      `LOADING` phase instead of a pop-in.
- [ ] Faces: all portraits load on the select screen (`<id>.webp` is small).
      Add `loading="lazy"` or low-quality placeholders if there are more than 8.
- [ ] Mobile: select screen, HUD names (longer names such as "DONALD"), winner
      screen and touch controls at 375px.
- [ ] `index.html` / meta / OG text: "two ceos" → an accurate roster line.
- [ ] Main menu subtitle `two ceos · one arena · zero benchmarks` → update.

**Exit check:** a production build (`bun run build && bun run preview`) plays every
fighter end to end on desktop Chrome and on a phone-sized viewport, with no console
errors and no missing head/face 404s.

---

## Phase 8: Documentation and licence sweep (the part that must not be skipped)

- [ ] `public/faces/CREDITS.md`: one section per fighter, with the correct licence each.
- [ ] `public/models/CREDITS.md`: every head is listed. Mark CC BY-SA derivatives as such.
      Keep the note that `glove.glb`/`shoe.glb` owe nothing.
- [ ] Main menu disclaimer: every photographer is credited, grouped by licence, with
      working licence links. This is the credit that actually travels with the game.
- [ ] `README.md`: update "The characters", "The faces", "The heads" and
      "Verification" from "both/two" to the roster, and add a short
      **"Adding a fighter"** checklist that is a condensed version of Phases 3–6.
- [ ] `CEO_Clash_MVP_Development_Plan.md` stays the original spec. Don't rewrite it.

**Exit check:** for every file in `public/faces/` and `public/models/`, a credit
entry exists that names its source, author and licence.

---

## Later (explicitly out of scope here)

- New special *mechanics* beyond strike/counter (a grab, a projectile, a dash).
  These need new `MoveDef.kind`s, new clips in `clips.ts`, CombatSystem handling and sim
  coverage.
- Per-character body proportions (height, build) or signature outfits.
- Voice lines (ElevenLabs key exists in `.env`). Given the real-person rules, keep
  these to non-voice-cloned announcer lines.
- Arcade/ladder mode through the roster.

## Definition of done

1. Every roster fighter can be selected against every other one on desktop and mobile.
2. Each has a real-likeness portrait and 3D head built by the scripts, not by hand.
3. `bun run build`, `bun run sim` and round-robin `bun run balance` all pass the thresholds above.
4. Every photo-derived asset is credited correctly in the CREDITS files and on the menu.
5. The README explains how to add the next fighter in under a page.
