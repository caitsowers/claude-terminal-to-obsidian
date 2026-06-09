# Dot

**Dot cleans up text as you paste it into Obsidian.**

Text copied from a terminal, an AI chat, a PDF, or a code console often arrives messy: terminal color codes, a shared left margin that Obsidian misreads as a code block, fancy bullet characters, and paragraphs that are hard-wrapped into many short lines. Dot fixes all of that automatically on paste, so what lands in your note is clean Markdown.

It runs on every paste, uses the plain-text version of what you copied, and only takes over when it actually changes something.

## What it does

On paste, Dot applies these steps (each can be toggled on or off in settings):

1. **Strip ANSI escapes** — removes terminal color codes, cursor controls, and other escape sequences (e.g. the junk in `\x1b[0;32mtext\x1b[0m`).
2. **Remove shared indentation** — if every line is indented by the same amount, that common left margin is stripped, so indented output is not parsed as a Markdown code block.
3. **Normalize bullet glyphs** — bullet characters at the start of a line (`•`, `◦`, `▪`, `‣`, `●`, `▸`, `►`, and more) become standard Markdown `- `.
4. **Straighten curly quotes** *(off by default)* — converts curly quotes (`“ ” ‘ ’`) to straight ASCII quotes and `…` to `...`.
5. **Reflow hard-wrapped paragraphs** — joins lines that were wrapped to a fixed width back into single flowing paragraphs and list items. Headings, blockquotes, lists, tables, horizontal rules, and fenced code blocks are left intact.
6. **Convert paragraphs to bullets** *(on by default)* — turns each paragraph into a `- ` list item. Great for pasting AI-chat or bulleted content whose bullet markers were lost in the copy. Turn it off if you mostly paste normal prose and want plain paragraphs. See [Bullet-aware pasting](#bullet-aware-pasting).

## Example

Pasting hard-wrapped terminal/AI output like this:

```
  The quick brown fox jumps over the lazy dog and keeps running across
  the field until it reaches the far fence at the edge of the meadow.

  A second thought that was wrapped the same way and should also become
  one clean line instead of several short ones.
```

…lands in your note as two tidy bullets (or, with **Convert paragraphs to bullets** turned off, two clean paragraphs).

## Bullet-aware pasting

When **Convert paragraphs to bullets** is on, Dot is aware of where your cursor is:

- **On an empty line** — each pasted paragraph becomes its own top-level bullet, with no blank gaps between them.
- **Inside an existing bullet** — the first paragraph continues that bullet (no stray `- `), and the rest become sibling bullets.
- **Inside an indented (sub-)bullet** — the whole paste stays at that indentation level, matching the depth and indent style (tabs or spaces) of the bullet you are in.

## Settings

Open **Settings → Community plugins → Dot** (gear icon). Each step above has its own toggle.

| Setting | Default | What it does |
| --- | --- | --- |
| Strip ANSI escapes | On | Remove terminal escape sequences and stray control characters |
| Remove shared indentation | On | Strip a common left margin from all lines |
| Normalize bullet glyphs | On | Replace bullet characters with `- ` |
| Straighten curly quotes | Off | Curly quotes → ASCII, `…` → `...` |
| Reflow hard-wrapped paragraphs | On | Join wrapped lines into single paragraphs/list items |
| Convert paragraphs to bullets | On | Turn each paragraph into a `- ` list item |

**Convert paragraphs to bullets** is on by default, so a paste becomes a tidy bullet list. Turn it off when you are pasting normal prose and want plain paragraphs instead.

## Notes

- Dot works from the **plain-text** version of the clipboard, so pasting formatted (rich) text will drop bold/italic in favor of clean text.
- If a cleaned paste is ever not what you wanted, just press `Cmd/Ctrl + Z` to undo back to the raw text.
- No build step: the plugin is plain CommonJS loaded directly as `main.js`. No network access, no telemetry, no data leaves your vault.

## Installation

### From the Community Plugins browser (once approved)

Settings → Community plugins → Browse → search for **Dot** → Install → Enable.

### Manual

1. Download `manifest.json` and `main.js` from the [latest release](https://github.com/caitsowers/dot-paste-cleaner/releases/latest).
2. Create a folder `dot-paste-cleaner` inside your vault’s `.obsidian/plugins/` directory.
3. Put both files in that folder.
4. Restart Obsidian, then enable **Dot** under Settings → Community plugins.

### Via BRAT (for beta/early installs)

Use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin and add this repository: `caitsowers/dot-paste-cleaner`.

## License

[MIT](LICENSE)
