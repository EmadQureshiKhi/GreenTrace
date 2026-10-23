// Renders the system diagrams in docs/diagrams/*.mmd to assets/diagrams/*.png (both at the repo root).
// Usage: node scripts/render-diagrams.mjs [name ...]
//
// The README figures in assets/readme are drawn with Pillow (tools/make_readme_art.py). Graph-shaped
// diagrams (flows, sequences, an ER model) need a layout engine, so they are written in Mermaid and
// rendered here in the same frame: the palette is read from the Pillow script (--palette), and each
// figure gets the same header (mark, title, subtitle, rule) at the same 960px nominal width, drawn at
// 2x for print. Each .mmd file starts with `%% title:` and `%% subtitle:` lines; `class X emph`
// marks the one emphasised node.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { launch } from './chrome.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REPO = join(ROOT, '..');
const SRC = join(REPO, 'docs', 'diagrams');
const OUT = join(REPO, 'assets', 'diagrams');
const MARK = join(REPO, 'assets', 'readme', 'mark.png');
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
const ELK = 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs';
const WIDTH = 960;

const python = join(ROOT, '.venv', 'bin', 'python');
const { light: p } = JSON.parse(execFileSync(python, ['-m', 'tools.make_readme_art', '--palette'], { cwd: ROOT, encoding: 'utf8' }));

const only = process.argv.slice(2);
const files = readdirSync(SRC).filter((f) => f.endsWith('.mmd') && (!only.length || only.includes(basename(f, '.mmd'))));
mkdirSync(OUT, { recursive: true });

const theme = {
  fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
  fontSize: '15px',
  background: p.page,
  primaryColor: p.surface,
  primaryBorderColor: p.border_strong,
  primaryTextColor: p.text,
  secondaryColor: p.surface,
  tertiaryColor: p.page,
  lineColor: p.border_strong,
  textColor: p.text,
  clusterBkg: p.page,
  clusterBorder: p.border,
  edgeLabelBackground: p.page,
  titleColor: p.text_muted,
  nodeTextColor: p.text,
  actorBkg: p.surface,
  actorBorder: p.border_strong,
  actorTextColor: p.text,
  actorLineColor: p.border,
  signalColor: p.text_secondary,
  signalTextColor: p.text,
  labelBoxBkgColor: p.band,
  labelBoxBorderColor: p.accent,
  labelTextColor: p.accent_text,
  loopTextColor: p.text_secondary,
  noteBkgColor: p.band,
  noteBorderColor: p.accent,
  noteTextColor: p.text,
  activationBkgColor: p.band,
  activationBorderColor: p.accent,
  sequenceNumberColor: p.page,
  attributeBackgroundColorOdd: p.page,
  attributeBackgroundColorEven: p.surface,
};

const css = `
  * { box-sizing: border-box; margin: 0; }
  body { background: ${p.page}; width: ${WIDTH}px; font-family: ${theme.fontFamily}; -webkit-font-smoothing: antialiased; }
  #card { padding: 30px; width: ${WIDTH}px; }
  header { display: grid; grid-template-columns: 30px 1fr; column-gap: 12px; padding-bottom: 9px; border-bottom: 1px solid ${p.rule}; margin-bottom: 22px; }
  header img { width: 30px; height: 30px; }
  h1 { font-size: 18px; font-weight: 700; color: ${p.text}; line-height: 1.32; margin-top: -2px; letter-spacing: -0.01em; }
  header p { grid-column: 2; font-size: 9.5px; color: ${p.text_muted}; line-height: 1.4; }
  #diagram { display: block; }
  #diagram svg { display: block; margin: 0 auto; width: 100%; height: auto; }
  .cluster-label .nodeLabel, .cluster-label span { color: ${p.text_muted} !important; font-weight: 600; font-size: 14px; }
  .edgeLabel, .edgeLabel span, .edgeLabel p { color: ${p.text_muted} !important; font-size: 13px; background: ${p.page} !important; }
  .node .label, .nodeLabel { line-height: 1.35; }
  .er.entityLabel, .er .entityLabel { fill: ${p.text}; }
  .er.entityBox { fill: ${p.surface} !important; stroke: ${p.border_strong} !important; }
  .er.relationshipLabel { fill: ${p.text_secondary}; }
  .er.relationshipLine { stroke: ${p.border_strong} !important; }
  text.actor > tspan { font-weight: 600; }
  .messageText { font-size: 15px !important; }
  .labelText, .labelText > tspan { font-weight: 600; }
  .sequenceNumber { font-size: 11px !important; font-weight: 700; }
  circle.sequenceNumber, marker#sequencenumber circle { fill: ${p.accent} !important; }
`;

const chrome = await launch();
const work = mkdtempSync(join(tmpdir(), 'gt-diagrams-'));
try {
  for (const file of files) {
    const name = basename(file, '.mmd');
    const raw = readFileSync(join(SRC, file), 'utf8');
    const title = raw.match(/^%% title: (.*)$/m)?.[1] ?? name;
    const subtitle = raw.match(/^%% subtitle: (.*)$/m)?.[1] ?? '';
    let source = raw.replace(/^%%.*\n/gm, '');
    if (/^\s*(flowchart|graph)\b/.test(source)) {
      source += `\n  classDef emph fill:${p.surface},stroke:${p.accent},stroke-width:2px,color:${p.accent_text},font-weight:600\n`;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
      <div id="card"><header><img src="file://${MARK}"/><h1>${title}</h1><p>${subtitle}</p></header>
      <div id="diagram"><pre class="mermaid">${source.replace(/</g, '&lt;')}</pre></div></div>
      <script type="module">
        import mermaid from '${MERMAID}';
        import elk from '${ELK}';
        mermaid.registerLayoutLoaders(elk);
        mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: ${JSON.stringify(theme)},
          layout: 'elk', elk: { mergeEdges: false, nodePlacementStrategy: 'NETWORK_SIMPLEX' },
          flowchart: { curve: 'linear', padding: 14, nodeSpacing: 34, rankSpacing: 46, htmlLabels: true, useMaxWidth: true },
          sequence: { useMaxWidth: true, actorMargin: 30, width: 130, boxMargin: 8, messageMargin: 34, mirrorActors: false, showSequenceNumbers: true, messageFontSize: 15, actorFontSize: 15, noteFontSize: 14 },
          er: { useMaxWidth: true, layoutDirection: 'TB', minEntityWidth: 120, fontSize: 15 } });
        window.done = mermaid.run({ querySelector: '.mermaid' }).then(() => document.fonts.ready);
      </script></body></html>`;
    const page = join(work, `${name}.html`);
    writeFileSync(page, html);
    await chrome.open(`file://${page}`, { width: WIDTH, height: 900, scale: 2 });
    const box = await chrome.evaluate(`new Promise((r) => { const t = setInterval(() => window.done && (clearInterval(t), r()), 50); }).then(() => window.done).then(() => {
      const svg = document.querySelector('#diagram svg');
      const vb = svg.viewBox.baseVal;
      const r = document.querySelector('#card').getBoundingClientRect();
      return { width: r.width, height: Math.ceil(r.height), natural: vb.width, shown: svg.getBoundingClientRect().width };
    })`);
    const { data } = await chrome.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: box.width, height: box.height + (box.height % 2), scale: 1 },
    });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    const shrink = box.shown / box.natural;
    console.log(`  wrote  assets/diagrams/${name}.png  ${box.width}x${box.height} @2x${shrink < 0.97 ? `  (diagram scaled to ${Math.round(shrink * 100)}%)` : ''}`);
  }
} finally {
  await chrome.close();
  rmSync(work, { recursive: true, force: true });
}
