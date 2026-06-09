'use strict';

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
  stripAnsi: true,
  dedent: true,
  normalizeBullets: true,
  straightenQuotes: false,
  reflowParagraphs: true,
  bulletizeParagraphs: true,
};

// Bullet glyphs that should be normalized to "- " at the start of a line.
const BULLET_GLYPHS = '•◦▪‣⁃●○∙·▸▹►▶➤➢➜';
const BULLET_RE = new RegExp('^(\\s*)[' + BULLET_GLYPHS + ']\\s+');

class TerminalPasteCleanerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on('editor-paste', (evt, editor) => {
        this.handlePaste(evt, editor);
      })
    );

    this.addSettingTab(new TerminalPasteCleanerSettingTab(this.app, this));
  }

  handlePaste(evt, editor) {
    const cd = evt.clipboardData;
    if (!cd) return;

    // Clean every paste from its plain-text version. When the clipboard also
    // carries rich HTML, we still take over so formatting is dropped in favor
    // of clean text (otherwise Obsidian would paste the formatted version).
    const text = cd.getData('text/plain');
    if (!text) return;

    const html = cd.getData('text/html');
    const hasHtml = !!(html && html.trim().length > 0);

    let cleaned = this.clean(text);

    // If we're pasting into an already-open bullet, the first item's "- " would
    // land mid-line as literal text. Drop it so the first paragraph continues
    // the existing bullet (joining with a space when needed); the rest keep
    // their bullets.
    if (this.settings.bulletizeParagraphs && editor && cleaned.startsWith('- ')) {
      const from = editor.getCursor('from');
      const line = editor.getLine(from.line);
      const before = line.slice(0, from.ch);
      if (/^\s*[-*+]\s/.test(before)) {
        // First item continues the existing bullet inline.
        cleaned = cleaned.slice(2);
        if (before.length > 0 && !/\s$/.test(before)) cleaned = ' ' + cleaned;
        // Indent the remaining bullets to match the existing bullet's depth,
        // copying whatever leading whitespace (tabs/spaces) the line uses.
        const indent = line.match(/^[ \t]*/)[0];
        if (indent) {
          cleaned = cleaned
            .split('\n')
            .map((l) => (/^- /.test(l) ? indent + l : l))
            .join('\n');
        }
      }
    }

    if (cleaned !== text || hasHtml) {
      evt.preventDefault();
      editor.replaceSelection(cleaned);
    }
  }

  clean(input) {
    let s = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (this.settings.stripAnsi) s = stripAnsi(s);
    if (this.settings.dedent) s = dedent(s);
    if (this.settings.normalizeBullets) s = normalizeBullets(s);
    if (this.settings.straightenQuotes) s = straightenQuotes(s);
    if (this.settings.reflowParagraphs) {
      s = reflowParagraphs(s, this.settings.bulletizeParagraphs);
    }

    return s;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// --- Transforms -----------------------------------------------------------

function stripAnsi(s) {
  // OSC: ESC ] ... terminated by BEL or ST (ESC \)
  s = s.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '');
  // CSI: ESC [ params intermediates final-byte
  s = s.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '');
  // Any remaining lone escape characters
  s = s.replace(/\x1b/g, '');
  // Stray control characters, but keep newline (\x0a) and tab (\x09)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  return s;
}

function dedent(s) {
  const lines = s.split('\n');
  let min = Infinity;
  for (const line of lines) {
    if (!/\S/.test(line)) continue; // skip blank lines
    const indent = line.match(/^ */)[0].length;
    if (indent < min) min = indent;
  }
  if (min === Infinity || min === 0) return s;

  const re = new RegExp('^ {0,' + min + '}');
  return lines.map((line) => line.replace(re, '')).join('\n');
}

function normalizeBullets(s) {
  return s
    .split('\n')
    .map((line) => line.replace(BULLET_RE, '$1- '))
    .join('\n');
}

function straightenQuotes(s) {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, '...');
}

// Structural-line classification for reflow.
// "Hard" structural lines stand alone and never absorb a continuation.
function isHardStructural(line) {
  if (/^\s*#{1,6}(\s|$)/.test(line)) return true; // ATX heading
  if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) return true; // horizontal rule
  if (/^\s*\|/.test(line)) return true; // table row
  return false;
}

// "Soft" structural lines start a block that a wrapped continuation joins onto.
function isSoftStructural(line) {
  if (/^\s*[-*+]\s+/.test(line)) return true; // bullet list
  if (/^\s*\d+[.)]\s+/.test(line)) return true; // ordered list
  if (/^\s*>/.test(line)) return true; // blockquote
  return false;
}

function reflowParagraphs(s, bulletize) {
  const lines = s.split('\n');
  const out = [];
  let buffer = '';
  let bufferIsPlain = false; // true when buffer is a plain paragraph (not a list/quote)
  let inFence = false;
  let fenceMarker = '';

  const flush = () => {
    if (buffer !== '') {
      // When bulletizing, turn each plain paragraph block into a list item
      // (trimming the leading indent the wrapped source left on the first line).
      out.push(bulletize && bufferIsPlain ? '- ' + buffer.replace(/^\s+/, '') : buffer);
      buffer = '';
      bufferIsPlain = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```|~~~)/);

    if (inFence) {
      out.push(line);
      if (fenceMatch && trimmed.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }

    if (fenceMatch) {
      flush();
      out.push(line);
      inFence = true;
      fenceMarker = fenceMatch[1];
      continue;
    }

    if (trimmed === '') {
      // Blank line is a paragraph break; squeeze repeated blanks to one.
      flush();
      if (out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    if (isHardStructural(line)) {
      flush();
      out.push(line);
      continue;
    }

    if (isSoftStructural(line)) {
      flush();
      buffer = line;
      bufferIsPlain = false;
      continue;
    }

    // Plain non-structural line: a wrapped continuation of the current block.
    if (buffer === '') {
      buffer = line;
      bufferIsPlain = true;
    } else {
      buffer = buffer + ' ' + trimmed;
    }
  }

  flush();

  // Tight list: when bulletizing, drop blank lines that sit between two bullet
  // items so the bullets render as one list with no gaps.
  if (bulletize) {
    const isBullet = (x) => typeof x === 'string' && /^\s*[-*+]\s/.test(x);
    const tight = [];
    for (let i = 0; i < out.length; i++) {
      if (out[i] === '' && isBullet(tight[tight.length - 1]) && isBullet(out[i + 1])) {
        continue;
      }
      tight.push(out[i]);
    }
    return tight.join('\n');
  }

  return out.join('\n');
}

// --- Settings -------------------------------------------------------------

class TerminalPasteCleanerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const toggles = [
      ['stripAnsi', 'Strip ANSI escapes', 'Remove terminal color codes, cursor controls, and other escape sequences.'],
      ['dedent', 'Remove shared indentation', 'Strip the common left margin so indented output is not parsed as a code block.'],
      ['normalizeBullets', 'Normalize bullet glyphs', 'Replace bullet characters (•, ◦, ▪, …) at line start with Markdown "- ".'],
      ['straightenQuotes', 'Straighten curly quotes', 'Convert curly quotes to ASCII and … to "...".'],
      ['reflowParagraphs', 'Reflow hard-wrapped paragraphs', 'Join wrapped lines back into single paragraphs and list items.'],
      ['bulletizeParagraphs', 'Convert paragraphs to bullets', 'Turn each plain paragraph into a "- " list item. Useful when pasting bulleted text whose bullet markers were lost. Leave off for normal prose. Requires reflow.'],
    ];

    for (const [key, name, desc] of toggles) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          })
        );
    }
  }
}

module.exports = TerminalPasteCleanerPlugin;
