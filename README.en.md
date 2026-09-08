<h1 align="center">dsh-noteboard</h1>

<p align="center"><a href="README.md">中文</a> | English</p>

<p align="center">
  A noteboard canvas plugin for DeepSeek Harness (DSH): a workspace-wide infinite canvas presented as a tab in the conversation view. Notes are Markdown files and canvases are JSON Canvas layout files; content and placement are separated and manageable with any text editor or Git. Text can be captured from conversations into notes, and notes can be sent back to the composer as structured citations for the model.
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
  <img src="https://badgen.net/badge/dsh/%3E%3D0.1.2-rc.1/blue" alt="dsh version">
  <img src="https://badgen.net/badge/node/%3E%3D22.19/blue" alt="node version">
</p>

## Screenshots 📸

**Canvas overview**

![Canvas overview](screenshots/canvas-overview.png)

**Citing notes into the composer**

![Citing notes into the composer](screenshots/cite-notes.png)

**Capturing a note from a conversation**

![Capturing a note from a conversation](screenshots/capture-from-chat.png)

**Jumping from a note back to its source**

![Jumping from a note back to its source](screenshots/backlink-jump.png)

<!-- Put screenshots in the screenshots/ directory:
     - canvas-overview.png — canvas overview: notes in several colors + category headings + the top toolbar
     - cite-notes.png — input state: bottom composer expanded with 2–3 note citation bubbles above it
     - capture-from-chat.png — a text selection in the conversation view with the "save to canvas / AI distill" popover
     - backlink-jump.png — the conversation view after clicking a note's "source / open conversation", with the origin text highlighted -->

## Features ✨

- **Infinite canvas** — pan, zoom, marquee group-move, grid snapping, plus free text and tag-clustered headings; the same notes can live on multiple canvas layouts, switchable anytime
- **Markdown notes** — each note is a `.md` file with frontmatter; live-preview editor, seven colors, light and dark themes
- **Capture from conversations** — select text to "save to canvas" verbatim or "AI distill" it into a note
- **Source backlinks** — every captured note remembers which session and passage it came from; "open conversation" jumps straight to the highlighted origin, and one click returns to the canvas
- **Send back to the AI** — notes join the composer as citation bubbles and go out as structured citations; sending is blocked beyond 32,000 cumulative characters
- **Organizing** — tag-pill focus filter, auto-rearrange by tag (backed up, restorable), search across titles / bodies / tags, off-board note library
- **AI tools** — 10 note tools and 4 bundled workflows let the model query, modify, organize, and synthesize notes (tables below)
- **History & restore** — every write shows a before/after diff and is restorable; conflicting restores are refused

## AI Tools & Workflows 🤖

10 model tools registered with the plugin:

| Tool | Description |
| --- | --- |
| `canvas_add_note` | Create a note and place it on a canvas; optionally record `derivedFrom` provenance |
| `noteboard_query` | Search workspace notes, or read full content, versions, and sources by ids |
| `noteboard_create` | Batch-create notes (up to 200 per call) |
| `noteboard_update` | Modify notes (must carry read-time versions); content edits affect every canvas |
| `noteboard_add` | Place existing notes onto a canvas without copying files |
| `noteboard_remove` | Remove notes from a canvas only; files are kept |
| `noteboard_layout` | Rearrange, align, or distribute notes (must carry the canvas version) |
| `noteboard_save_as` | Save the canvas layout under a new name |
| `noteboard_history` | List operations; inspect before/after file content |
| `noteboard_restore` | Restore an operation, refusing to overwrite later changes |

Plus 4 bundled workflows (skills):

| Workflow | Description |
| --- | --- |
| `noteboard-organize` | Group notes by theme, tag them, tidy the layout |
| `noteboard-compare` | Compare plans captured in notes; weigh trade-offs and spot disagreements |
| `noteboard-actions` | Break ideas in notes down into action items or implementation steps |
| `noteboard-synthesize` | Merge duplicate notes, deduplicate, or synthesize conclusions |

Regular operations use the session model; the "AI distill" model is configured separately in plugin settings.

## Install 📦

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

## Data Format 🗂️

```
<workspace>/.noteboard/
├── meta.json                      # { "activeCanvas": "Main" }
├── canvases/<name>.canvas         # JSON Canvas 1.0 layout (Obsidian Canvas compatible)
├── notes/<date>-<title>-<shortid>.md  # the note itself: Markdown + YAML frontmatter
└── history/                       # operation history
```

- Note frontmatter: `id`, `title`, `color`, `tags`, `created`, `source` (backlink), `derivedFrom` (provenance); unrecognized fields are always preserved
- A canvas file only describes the layout: node `id`s foreign-key note `id`s, and `text` uses Obsidian-style relative references; other JSON Canvas tools can open it directly
- Content versions are SHA256; writes go through a queue with conflict checks

## Settings ⚙️

Under "Settings → Plugins", expand the initially collapsed Noteboard entry. Preferences are saved by the host and apply across workspaces; viewport positions remain separate for each workspace and canvas.

| Option | Description |
| --- | --- |
| Selection capture toolbar | On by default; disable the capture actions shown after selecting conversation text |
| After capture | Stay in conversation (default) or open the note; never jump automatically after switching sessions |
| Default note color | Seven colors, yellow by default; affects new notes only, explicit colors take precedence |
| Background grid / snap while dragging | Both on by default, independently controlled; shared 24-unit spacing without moving existing content |
| Plain mouse wheel | Pan (default) or zoom; Ctrl / Command + wheel and pinch always zoom |
| Opening view | Restore the last view (default) or fit all; explicit note navigation takes priority |
| Distill provider / model | Automatically choose the first provider with models and its first model; show the resolved selection and report unavailable explicit selections |
| Distill length | Short (~100), standard (~200, default), detailed (~400); Chinese characters or English words, without truncating the generated body |
| Output language | Chinese (default), English, or match the source |
| Additional requirements | Advanced content and style instructions, empty by default; the plugin owns the title, tags, and Markdown body output contract |
| History retention | Latest 50 (default), 100, or 200 operations per workspace; reductions take effect after its next successful write, preserving note/canvas files and pending operations |

Each group can be reset. Switches and selections save immediately; text saves after 400ms idle or on blur. Failed edits remain available for retry. "Test distill" calls the model with saved preferences and submitted sample text without creating notes or history. These model settings only affect AI distill; conversations and note tools use the conversation model.

The old `prompt` setting is no longer consumed; use additional requirements instead. Restart Harness after updating the host plugin; refreshing the browser alone does not reload backend code.

## Development 🛠️

```sh
pnpm install
npm test            # vitest: unit / API tests
npx tsc --noEmit    # type check
npm run build       # tsdown build: host service + client bundle → lib/
```

`test/browser-*.mjs` are browser end-to-end scripts that need real Harness instances running locally (ports 3081–3083 by default), with auth state and logs under `/tmp`; screenshots go to `artifacts/` (gitignored). Client changes take effect on refresh after a build; host-side changes need an instance restart.

## Boundaries & Known Limitations ⚠️

- No UI for edges or groups yet; the file format already reserves them
- No file watching: the canvas re-reads everything on tab activation and before each RPC operation
- Single-user assumption: no cross-process file locking, no realtime collaboration
- The bottom action bar adapts to host DOM markers and injection APIs; re-verify after host upgrades rather than trusting version numbers
- No full in-canvas chat, rich text, or general undo/redo

## Acknowledgments 💛

Thanks to **EE** for sponsoring this project with tokens, supporting the plugin's development and verification. 🙏✨

## License 📄

[MIT](./LICENSE)
