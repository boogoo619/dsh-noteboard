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

## Features

### Canvas

- Workspace-wide infinite canvas shown as a conversation-view tab; layouts can be saved as multiple canvases, and the same note can appear on different canvases
- Pan, zoom (0.2×–3×), blank-space marquee, group drag, grid snapping
- Fixed-width note cards with sandboxed Markdown rendering; seven colors, light and dark themes
- Free-text nodes and tag-clustered category headings, both editable, movable, deletable; headings support suppression and regeneration
- Search across titles, bodies, and tags; a note library lists and recovers notes not on the current canvas
- Auto-rearrange by tag (clustering and shelf packing); the layout is backed up before rearranging and restorable in one click
- Viewport remembered per workspace and canvas

### Editing

- Clicking a card opens an action bar: recolor, tag editing, edit, source backlink, remove from canvas
- Centered modal editor with live full-Markdown preview; failed saves keep the draft
- Removing from a canvas only deletes the layout node; the note file is kept

### Conversation capture

- Select text in a conversation: "save to canvas" stores it verbatim with no model involved; "AI distill" has the host call an LLM for title, tags, and body outside the chat flow, falling back to verbatim storage on failure
- Captured notes record a source backlink (sessionId plus a readable label) and can jump back to the origin position in the conversation, then return to the canvas

### Note citations

- Dual-state bottom action bar (tools / input), reusing the host composer
- Notes join the composer as citation bubbles, previewable and removable individually or as a group; sending carries the note bodies and structured citations
- Sending is blocked beyond 32,000 cumulative characters; sends queue automatically while the AI is running
- Replies completed while the canvas is active raise a notification with a jump to the conversation

### History & restore

- Every write is recorded under `.noteboard/history/` with full before/after file content
- Any recorded operation can be restored; later changes are detected and conflicting restores are refused

## Screenshots

**Canvas overview**

![Canvas overview](screenshots/canvas-overview.png)

**Citing notes into the composer**

![Citing notes into the composer](screenshots/cite-notes.png)

**Capturing a note from a conversation**

![Capturing a note from a conversation](screenshots/capture-from-chat.png)

<!-- Put screenshots in the screenshots/ directory:
     - canvas-overview.png — canvas overview: notes in several colors + category headings + the top toolbar
     - cite-notes.png — input state: bottom composer expanded with 2–3 note citation bubbles above it
     - capture-from-chat.png — a text selection in the conversation view with the "save to canvas / AI distill" popover -->

## AI Tools & Workflows

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

## Data Format

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

## Settings

Under "Settings → Plugins → Plugin config", the Noteboard card:

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
- No file watching: the canvas re-reads everything on tab activation and before each RPC operation
- Single-user assumption: no cross-process file locking, no realtime collaboration
- The bottom action bar adapts to host DOM markers and injection APIs; re-verify after host upgrades rather than trusting version numbers
- No full in-canvas chat, rich text, or general undo/redo

## License

[MIT](./LICENSE)
