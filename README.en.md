<h1 align="center">dsh-noteboard</h1>

<p align="center"><a href="README.md">中文</a> | English</p>

<p align="center">
  The longer you work with an AI, the more things are worth keeping — an idea, a conclusion, a to-do — and they all end up buried in the conversation scrollback.<br>
  <b>dsh-noteboard</b> adds a <b>noteboard canvas</b> next to your conversations in the DeepSeek Harness (DSH) Web GUI: see something worth keeping? Select it and pin it as a note. Collected enough? Drag, tag, and auto-organize them on the canvas. Ready to dig deeper? Cite notes back into the composer and let the AI build on them.<br>
  Every note is a plain Markdown file in your own workspace.
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
  <img src="https://badgen.net/badge/dsh/%3E%3D0.1.2-rc.1/blue" alt="dsh version">
  <img src="https://badgen.net/badge/node/%3E%3D22.19/blue" alt="node version">
</p>

## Screenshots

**The canvas at a glance**

![The canvas at a glance](screenshots/canvas-overview.png)

**Citing notes into the composer to send to the AI**

![Citing notes into the composer](screenshots/cite-notes.png)

**Selecting text in a conversation to create a note**

![Selecting text in a conversation to create a note](screenshots/capture-from-chat.png)

<!-- Put screenshots in the screenshots/ directory:
     - canvas-overview.png — the canvas at a glance: several notes in different colors + category headings + the top toolbar
     - cite-notes.png — input state: the bottom composer expanded, with 2–3 note citation bubbles above it ("notes back to the AI")
     - capture-from-chat.png — a text selection in the conversation view with the "save to canvas / AI distill" popover (or the resulting note with its backlink) -->

## What you can do

### From conversation to notes

- See something worth keeping — whether it's the AI's answer or your own message? Select it and hit **"save to canvas"** to store it verbatim, or **"AI distill"** to have a model condense it into a note with a title and tags (distill failures fall back to saving the original text)
- Every note captured this way remembers where it came from: "open conversation" jumps back to the exact spot it came from, and one click returns you to the canvas

### From notes back to the conversation

- The bottom action bar expands into a composer, so you can add notes to what you send the AI
- Cited notes appear as colored bubbles above the composer — previewable and removable; when you send, the AI receives the notes' full bodies as structured citations, so you never have to describe "that yellow note of mine"
- Sends queue automatically while the AI is busy; overly long content (over 32,000 characters) is flagged before sending

### Organizing on the canvas

- An infinite canvas: drag to arrange, wheel to zoom, marquee to move groups; seven colors, light and dark themes
- Tag your notes; tap a tag pill and the canvas highlights just that group; one click rearranges everything by tag — your manual layout is backed up first and restorable at any time
- Write free text anywhere; category headings cluster by tag automatically — all editable, movable, deletable
- As things pile up: search covers titles, bodies, and tags; notes not on the current canvas can be recovered from the note library
- The same notes can live on multiple canvases — an "idea pool" and a "this week's picks", for instance — switch between them freely

### Nothing is lost to a bad edit

Every write is recorded in history: which file changed and what it looked like before, inspectable on demand and restorable step by step; later changes are detected rather than silently overwritten.

## Install

Requires the `dsh` CLI (`>= 0.1.2-rc.1`) and Node `>= 22.19.0`.

**From GitHub (current)**

```sh
dsh plugin --profile web add github:boogoo619/dsh-noteboard
dsh web
```

> Installing from git pulls the **source** and builds it on the spot via the `prepare` script. pnpm ≥10 refuses to run `prepare` at first; after the initial `add` fails, copy the package key into that profile's `pnpm-workspace.yaml` as `dsh` suggests:
>
> ```yaml
> allowBuilds:
>   dsh-noteboard: true
> ```
>
> Then run `add` again. **This authorization lets this package's code execute on your machine at install time** — only grant it to trusted sources and pin a commit (`github:boogoo619/dsh-noteboard#<sha>`).

**From npm (once published)**

```sh
dsh plugin --profile web add dsh-noteboard
dsh web
```

> If `add` doesn't pick up the latest version: that's pnpm's `minimumReleaseAge` safety mechanism — for **24 hours** by default, freshly published versions aren't resolved as `latest` and fall back to the previous stable one. To get the newest release immediately, pin the version:
>
> ```sh
> dsh plugin --profile web add dsh-noteboard@<version>
> ```

For local development, link it:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-noteboard
```

Restart `dsh web` after installing.

## How to use

1. After installing and restarting, open any session: the view now has a **Noteboard** tab at the top. The canvas is shared across the whole workspace — every session shows the same pool of notes.
2. **Capture**: switch back to the conversation, select a passage → "save to canvas" or "AI distill". The new note lands near the center of the canvas with a backlink to the original text.
3. **Organize**: double-click empty space for a new note; click a card to recolor, retag, or edit it (write on the left, live preview on the right); drag to arrange; one click rearranges by tag.
4. **Use**: expand the composer from the bottom action bar, add the notes you want to discuss as citation bubbles, type your question, and send.
5. **Delegate**: just tell the AI in the conversation "organize these notes by theme" — see below.

## Let the AI tidy up for you

The plugin registers 10 note tools (query, create, update, add / remove, layout, save-as, history, restore) that the model calls as needed — you never have to remember any tool names, just ask in plain language. Four bundled workflows cover the most common tidying scenarios:

| You can say | What the AI does |
| --- | --- |
| "Organize these notes by theme" | Identifies themes, reuses existing tags, rearranges the layout (noteboard-organize) |
| "Compare the plans in these notes" | Compares along shared dimensions, spots disagreements, saves conclusions as a new note if you ask (noteboard-compare) |
| "Break this idea into action items" | Separates goals, steps, and dependencies into action notes with provenance (noteboard-actions) |
| "Merge the duplicate notes" | Finds duplicates and complements, synthesizes a note, keeps or removes originals as you ask (noteboard-synthesize) |

Regular actions use the current session model; "AI distill" can use a separately configured model (see [Settings](#settings)).

## Where your data lives

Your notes stay in your own workspace — no database involved:

```
<workspace>/.noteboard/
├── meta.json                # the currently active canvas
├── canvases/                # canvas layouts (JSON Canvas; Obsidian can open them directly)
├── notes/                   # the notes themselves: plain Markdown files
└── history/                 # operation history
```

- Each note is a `.md` file with YAML frontmatter — title, color, tags, and source are all visible at a glance; edit by hand, script them, or keep them in Git
- A canvas file only describes "which note goes where"; removing a note from a canvas just takes it off the layout — the file remains, recoverable from the note library anytime

## Settings

Under "Settings → Plugins → Plugin config", the Noteboard card configures the model used by "AI distill":

| Option | Description |
| --- | --- |
| Distill provider | Provider routing key for "AI distill"; empty picks the first available provider (default: empty) |
| Distill model | Model id under that provider; empty picks its first model (default: empty) |
| Distill prompt | Custom distill prompt; empty uses the built-in one (default: empty) |

## Development

```sh
pnpm install
npm test            # vitest: unit / API tests
npx tsc --noEmit    # type check
npm run build       # tsdown build: host service + client bundle → lib/
```

`test/browser-*.mjs` are browser end-to-end scripts that need real Harness instances running locally (ports 3081–3083 by default), with auth state and logs under `/tmp`; screenshots go to `artifacts/` (gitignored). Client changes take effect on refresh after a build; host-side changes need an instance restart.

## Boundaries & Known Limitations

- No UI for edges or groups yet; the file format already reserves them
- No file watching: the canvas re-reads everything on tab activation and before each operation
- Single-user assumption: no cross-process file locking, no realtime collaboration
- The bottom action bar adapts to host DOM markers and injection APIs; re-verify after host upgrades rather than trusting version numbers
- No full in-canvas chat, rich text, or general undo/redo

## License

[MIT](./LICENSE)
