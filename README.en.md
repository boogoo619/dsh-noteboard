<h1 align="center">dsh-noteboard</h1>

<p align="center"><a href="README.md">中文</a> | English</p>

<p align="center">
  A <b>noteboard canvas</b> for the DeepSeek Harness (DSH) Web GUI: a workspace-wide infinite canvas where every note is a plain Markdown file and every canvas is a JSON Canvas layout — content and placement are fully separated, readable and editable by both humans and Git.<br>
  Select any text in a conversation to capture it onto the canvas; 10 AI tools and 4 bundled workflows let the model query, organize, and synthesize your notes directly.
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
  <img src="https://badgen.net/badge/dsh/%3E%3D0.1.2-rc.1/blue" alt="dsh version">
  <img src="https://badgen.net/badge/node/%3E%3D22.19/blue" alt="node version">
</p>

## Features

- **Infinite canvas** — pan, zoom (0.2×–3×, cursor-anchored), dot grid, drag-to-marquee with group move and grid snapping
- **Markdown notes** — each note is a plain `.md` file with YAML frontmatter; seven colors, light/dark themes; "remove from canvas" only deletes the layout node, never the file
- **Multiple canvases** — the same note can appear at different positions on several canvases; "save as new canvas" snapshots the layout without copying files
- **Tags & rearrange** — add/remove tags on cards, tap a tag pill to focus-filter; auto-rearrange by tag (clustering + shelf packing) with automatic backup and one-click restore
- **Search & library** — top-centered search across titles / bodies / tags; an off-board library to recover notes not on the current canvas
- **Free text & headings** — free text owned by its canvas, editable/movable/duplicable; auto-generated category headings can be edited, suppressed, and regenerated
- **Conversation capture** — select text in a conversation: "save to canvas" stores it verbatim (no model), or "AI distill" has the Host call an LLM directly to produce title, tags, and body (outside the chat flow, with verbatim fallback on failure)
- **Source backlinks** — notes record sessionId plus a readable label; jump back to the highlighted origin in the conversation, then return to the canvas
- **Cited sending** — a dual-state bottom bar adds notes as structured citations to the host composer: bubble previews, per-note / whole-group removal, cumulative length check before sending (32,000-character cap)
- **AI tools & workflows** — 10 model tools (query / create / update / add / remove / layout / save-as / history / restore) and 4 bundled workflows registered with the plugin
- **History & restore** — every write lands in `.noteboard/history/`; inspect before/after content and restore, with conflict detection that refuses to overwrite

## Screenshots

**Desktop width · light theme**

![Desktop width · light theme](screenshots/desktop-light.png)

**Desktop width · dark theme**

![Desktop width · dark theme](screenshots/desktop-dark.png)

**Narrow window · dark theme**

![Narrow window · dark theme](screenshots/narrow-dark.png)

## Capabilities

| Capability | Details |
| --- | --- |
| Canvas tab | Registered via `conversation.view` alongside conversation views; canvas data is workspace-level and shared by all sessions |
| Viewport | Blank-drag / trackpad panning, Ctrl/⌘+wheel and pinch zoom (0.2–3×, cursor-anchored), dot grid fading with zoom, fit-all overview |
| Note cards | Fixed 260px width, sandboxed Markdown rendering (raw HTML disabled), overflow clipped with bottom fade; drag writes through (debounced), dragging raises to top |
| Card action bar | Click a card for: recolor, tag editing, edit, source backlink, remove from canvas |
| Editor | Centered modal with live full-Markdown preview; failed saves keep the draft with retry |
| Bulk operations | Blank marquee (Shift appends), Shift/Meta/Ctrl click toggles membership, unified group-drag snapping, bulk color & tags, align/distribute |
| Auto rearrange | Tag clustering + ⌈√n⌉ adaptive grids + shelf packing; backs up to `.backup.json` first with restore; rearranging only selected notes leaves headings untouched |
| Free text | Owned by its canvas, no files; 14/20/28px sizes and theme colors; mixed selection, align/distribute; duplicates offset by 24px |
| Category headings | Auto-generated and editable; manual edits convert to free text and record suppression; regeneration clears suppression and fully rearranges |
| Dual-state action bar | Bottom-centered tool state (select / pan / new note / new text / AI assistant) ⇄ input state (max 560px wide); switching never moves the camera |
| Structured citations | Note bubbles sit above the host composer; click a name to preview, × to remove; deduplicated by ID; bodies re-read at send time, stale citations removable |
| Reply notices | Subscribes to host Chat turns; completed replies during canvas activity toast a notice (three lines max, 12s auto-dismiss, hover pauses) with a jump-to-conversation action |
| Conversation capture | `shell.overlay` selection popover: "save to canvas" stores verbatim; "AI distill" calls the `llm` Service once for title/tags/body, falling back to verbatim on failure |
| Source backlinks | Frontmatter always keeps a readable label; "open conversation" appears when `sessionId` resolves; locates by session / view / loaded history / collapsed sections / matched selection, distinguishing full, partial, and ambiguous matches |
| History & restore | `.noteboard/history/` records every write; list operations, inspect before/after file content, restore with later-change conflict detection |
| Data compatibility | YAML Document preserves nested sources, unknown fields, and comments; canvases keep external top-level fields (incl. `edges`/`groups`); versions are content SHA256; legacy RPC accepts version-less calls |
| Viewport memory | Viewport remembered per workspace and canvas; empty canvases show onboarding hints |

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

## Usage

1. Open any session and switch to the **Noteboard** tab: the whole workspace shares one pool of notes, and the active canvas renders here.
2. Double-click empty space to create a note; click a card to recolor, tag, edit (live Markdown preview), open its source, or remove it from the canvas.
3. Select text in a conversation to get "save to canvas" / "AI distill"; new notes carry a source backlink — "open conversation" jumps to the highlighted origin, then returns to the canvas.
4. Tap a tag pill on a card to focus-filter; the toolbar rearranges by tag in one click (layout backed up first, restorable).
5. Switch the bottom bar to input state to add notes as citation bubbles to the host composer and send them with your message; sends queue automatically while the AI is busy.
6. Just say "organize these notes by theme" in the conversation — the model reads and writes the canvas through `noteboard_*` tools and bundled workflows; every operation is inspectable and restorable in the canvas history.

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

Regular AI actions use the session model; the "AI distill" model is configured separately in plugin settings.

## Data Format

```
<workspace>/.noteboard/
├── meta.json                      # { "activeCanvas": "Main" }
├── canvases/<name>.canvas         # JSON Canvas 1.0 layout (Obsidian Canvas compatible)
├── notes/<date>-<title>-<shortid>.md  # the note itself: Markdown + YAML frontmatter
└── history/                       # operation history (diffs & restore)
```

- Note frontmatter: `id`, `title`, `color`, `tags`, `created`, `source` (backlink), `derivedFrom` (provenance); unrecognized fields are always preserved
- A canvas file is only a layout view: node `id`s foreign-key note `id`s, and `text` uses Obsidian-style relative references; other JSON Canvas tools can open it directly
- Content versions are SHA256; writes go through a queue with conflict checks

## Settings

Under "Settings → Plugins → Plugin config", expand the Noteboard card:

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
