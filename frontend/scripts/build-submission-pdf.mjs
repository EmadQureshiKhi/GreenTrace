// Builds the IEEE ClimateChain submission dossier (the Devpost file upload) from docs/*.md.
// Usage: node scripts/build-submission-pdf.mjs <out.pdf>
// Needs Google Chrome and poppler (pdftotext, pdfunite). Run the diagram generators first
// (tools/make_readme_art.py and scripts/render-diagrams.mjs) so the figures are current.
//
// The cover is printed on its own (no running header), the body is printed twice: once to find the
// page each chapter starts on (pdftotext), once with those numbers in the contents. The two are
// then joined with pdfunite.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { marked } from 'marked';
import { launch } from './chrome.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const out = resolve(process.argv[2] || 'GreenTrace-Submission.pdf');
const { light: p } = JSON.parse(
  execFileSync(join(ROOT, '.venv', 'bin', 'python'), ['-m', 'tools.make_readme_art', '--palette'], { cwd: ROOT, encoding: 'utf8' }),
);
const file = (...parts) => `file://${join(ROOT, ...parts)}`;

const chapters = [
  {
    doc: 'PROBLEM-AND-SOLUTION.md', title: 'Problem statement and solution overview', requirement: 'Problem statement and solution overview (max 2 pages)',
    summary: 'Why carbon claims are hard to trust today, who that hurts most, and how GreenTrace combines AI for the labour with Hedera for the record.',
  },
  {
    doc: 'ARCHITECTURE.md', title: 'Architecture and technical specification', requirement: 'Architecture diagram and technical specification',
    summary: 'How the system is put together: components, trust boundaries, the data model, the AI layer and the certify, buy and retire flows.',
  },
  {
    doc: 'SECURITY.md', title: 'Security and data integrity assessment', requirement: 'Security and data integrity assessment',
    summary: 'What GreenTrace protects and how: key management, row level security, hashing, double-counting guards, AI-specific risks and known limits.',
  },
  {
    doc: 'CLIMATE-IMPACT.md', title: 'Climate impact assessment and reduction projections', requirement: 'Climate impact assessment and carbon reduction projections',
    summary: 'The pathways by which GreenTrace reduces emissions, how each is measured, and transparent, assumption-driven projections.',
  },
  {
    doc: 'ADOPTION-AND-ROADMAP.md', title: 'Implementation, adoption and scalability roadmap', requirement: 'Implementation plan, adoption strategy and scalability roadmap',
    summary: 'Who adopts GreenTrace first and why, the implementation plan, and how the system scales to mainnet and many organizations.',
  },
  {
    doc: 'TESTING.md', title: 'User testing results', requirement: 'User testing results',
    summary: 'The end-to-end run on Hedera testnet with live AI and database, the automated suites, the model evaluation and the issues testing found.',
  },
  {
    doc: 'RESPONSIBLE-AI.md', title: 'Responsible AI statement', requirement: 'Responsible AI (IEEE learning series)',
    summary: 'Where AI is used and where it is not, and how transparency, accountability, privacy, fairness and footprint are handled.',
  },
];

const shots = [
  ['hero-certificate.png', '/certificates/GT-2026-DG4WM6', 'Public certificate verification: inventory hash, consensus record, NFT, IPFS metadata and audit all pass'],
  ['bill-reading.png', '/upload', 'AI bill reading with quoted evidence, confidence, and a duplicate bill held back'],
  ['audit.png', '/inventories', 'Pre-certification audit: nine rules plus the AI reviewer, with a risk score computed by code'],
  ['marketplace.png', '/marketplace', 'Marketplace with AI quality grades on every listing'],
  ['credit-rating.png', '/marketplace', 'AI credit rating: five dimensions with reasons; the grade is computed by code'],
  ['reduction-plan.png', '/reduce', 'AI reduction plan with tonnes computed from the measured inventory'],
  ['gri-draft.png', '/sema', 'AI-drafted GRI disclosures, with missing facts marked instead of invented'],
  ['dashboard.png', '/', 'Organization dashboard'],
];

const onChain = [
  ['Live app (Hedera testnet)', 'greentrace-app.vercel.app', 'https://greentrace-app.vercel.app', 'The deployed prototype; sign up, link MetaMask and claim 25 test HBAR once'],
  ['Certificate from the live test', 'GT-2026-Q5LL89', 'https://greentrace-app.vercel.app/certificates/GT-2026-Q5LL89', '9.21 t CO2e, fully offset; verification re-runs on every page load'],
  ['Audit topic (Consensus Service)', '0.0.11116480', 'https://hashscan.io/testnet/topic/0.0.11116480', 'Ordered record of every AI result, certificate, purchase and retirement'],
  ['CO2e credit token (Token Service)', '0.0.11116482', 'https://hashscan.io/testnet/token/0.0.11116482', '1 token = 1 t CO2e; the wipe key retires credits from supply'],
  ['Certificate NFTs (Token Service)', '0.0.11116483', 'https://hashscan.io/testnet/token/0.0.11116483', 'One NFT per certificate; metadata is the ipfs:// URI'],
  ['GreenTraceExchange (EVM)', '0.0.11116506', 'https://hashscan.io/testnet/contract/0.0.11116506', 'HBAR purchases (one payment per order) and retirement requests'],
  ['Treasury account', '0.0.11116474', 'https://hashscan.io/testnet/account/0.0.11116474', 'Mints, delivers and retires; key held only on the server'],
  ['Example certificate', 'GT-2026-DG4WM6', 'https://hashscan.io/testnet/token/0.0.11116483/1', '27.91 t CO2e, fully offset by 28 retired credits'],
];

// ------------------------------------------------------------------ markdown

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let figure = 0;
marked.use({
  renderer: {
    code: ({ text }) => `<pre><code>${escape(text)}</code></pre>`,
    image: ({ href, text }) => `<img src="${href}" alt="${escape(text)}"/>`,
  },
});

function renderDoc(name) {
  const md = readFileSync(join(DOCS, name), 'utf8')
    .replace(/^# .*\n/, '')
    .replace(/\]\(([A-Z-]+\.md)(#[^)]*)?\)/g, ']($2)');
  const html = marked.parse(md).replace(/<p><img src="([^"]+)" alt="([^"]*)"\/><\/p>/g, (_, src, alt) => {
    figure += 1;
    const diagram = /assets\//.test(src);
    return `<figure class="${diagram ? 'diagram' : 'shot'}"><img src="${src}"/><figcaption><b>Figure ${figure}.</b> ${alt}</figcaption></figure>`;
  });
  const sections = [...md.matchAll(/^## (.*)$/gm)].map((m) => m[1]);
  return { html, sections };
}

// ------------------------------------------------------------------ styles

const css = `
@page { size: A4; margin: 21mm 17mm 19mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; color: ${p.text}; font-size: 9.6pt; line-height: 1.52; }
a { color: ${p.accent_text}; text-decoration: none; }
p { margin: 0 0 7pt; }
strong, b { font-weight: 650; }
code { font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 8.2pt; background: #F2F2F4; border-radius: 3px; padding: 0.5pt 3pt; }
pre { background: #F2F2F4; border-radius: 6px; padding: 8pt 10pt; font-size: 8pt; line-height: 1.45; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
ul, ol { margin: 0 0 8pt; padding-left: 15pt; }
li { margin-bottom: 2.5pt; }
li::marker { color: ${p.accent}; }
h2 { font-size: 13pt; font-weight: 700; margin: 16pt 0 7pt; padding-left: 9pt; border-left: 3pt solid ${p.accent}; line-height: 1.25; break-after: avoid; }
h3 { font-size: 10.5pt; font-weight: 650; margin: 12pt 0 5pt; break-after: avoid; }
h4 { font-size: 9.6pt; font-weight: 650; margin: 10pt 0 4pt; color: ${p.text_secondary}; break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 11pt; font-size: 8.3pt; line-height: 1.42; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: ${p.band}; color: ${p.accent_text}; font-weight: 650; text-align: left; padding: 5pt 7pt; border-bottom: 1pt solid ${p.accent}; }
td { padding: 4.5pt 7pt; border-bottom: 0.6pt solid ${p.border}; vertical-align: top; }
tbody tr:nth-child(even) td { background: ${p.surface}; }
figure { margin: 8pt 0 13pt; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 222mm; border: 0.6pt solid ${p.border}; border-radius: 6px; }
figure.diagram img { border-color: ${p.rule}; }
figcaption { font-size: 7.8pt; color: ${p.text_muted}; margin-top: 4pt; text-align: left; }
figcaption b { color: ${p.text_secondary}; }
blockquote { margin: 8pt 0; padding: 7pt 11pt; background: ${p.band}; border-left: 3pt solid ${p.accent}; border-radius: 0 6px 6px 0; }

/* chapter openers */
.chapter { break-before: page; }
.opener { margin: 0 0 14pt; padding-bottom: 12pt; border-bottom: 0.8pt solid ${p.rule}; }
.kicker { font-size: 7.6pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${p.accent_text}; }
.opener h1 { font-size: 23pt; line-height: 1.12; font-weight: 750; letter-spacing: -0.015em; margin: 5pt 0 7pt; }
.opener .summary { font-size: 10.8pt; color: ${p.text_secondary}; line-height: 1.45; max-width: 150mm; margin-bottom: 10pt; }
.opener .rule { width: 46px; height: 3px; border-radius: 2px; background: ${p.accent}; margin-bottom: 10pt; }
.chips { display: flex; flex-wrap: wrap; gap: 4pt; }
.chip { font-size: 7.4pt; color: ${p.text_secondary}; background: ${p.surface}; border: 0.6pt solid ${p.border}; border-radius: 99px; padding: 1.5pt 7pt; }

/* contents and overview */
.toc-title { font-size: 23pt; font-weight: 750; letter-spacing: -0.015em; margin: 4pt 0 12pt; }
.toc { width: 100%; border-collapse: collapse; font-size: 9.6pt; margin-bottom: 18pt; }
.toc td { padding: 7pt 4pt; border-bottom: 0.6pt solid ${p.border}; background: none !important; vertical-align: baseline; }
.toc .n { width: 26pt; color: ${p.accent_text}; font-weight: 700; font-variant-numeric: tabular-nums; }
.toc .t { font-weight: 600; }
.toc .r { color: ${p.text_muted}; font-size: 8pt; }
.toc .pg { width: 30pt; text-align: right; font-variant-numeric: tabular-nums; color: ${p.text_secondary}; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7pt; margin: 8pt 0 14pt; }
.stat { background: ${p.surface}; border: 0.6pt solid ${p.border}; border-radius: 8px; padding: 9pt 11pt; break-inside: avoid; }
.stat .v { font-size: 17pt; font-weight: 750; color: ${p.accent_text}; letter-spacing: -0.01em; line-height: 1.1; }
.stat .l { font-size: 7.8pt; color: ${p.text_secondary}; margin-top: 3pt; line-height: 1.35; }
.callout { background: ${p.band}; border-left: 3pt solid ${p.accent}; border-radius: 0 8px 8px 0; padding: 9pt 12pt; margin: 6pt 0 12pt; font-size: 9.2pt; }

/* screenshots */
.frame { border: 0.6pt solid ${p.border_strong}; border-radius: 8px; overflow: hidden; margin: 0 0 5pt; }
.frame .bar { height: 15pt; background: #F2F2F4; border-bottom: 0.6pt solid ${p.border}; display: flex; align-items: center; gap: 3.5pt; padding: 0 7pt; }
.frame .dot { width: 5.5pt; height: 5.5pt; border-radius: 50%; background: ${p.border_strong}; }
.frame .url { margin-left: 8pt; flex: 1; max-width: 95mm; height: 9pt; border-radius: 4px; background: #FFFFFF; font-size: 6.6pt; color: ${p.text_muted}; line-height: 9pt; padding: 0 6pt; font-family: "SF Mono", ui-monospace, monospace; }
.frame img { display: block; width: 100%; }
.shotfig { margin: 0 0 12pt; break-inside: avoid; }
.shotfig figcaption { margin-top: 3pt; }
.links td:nth-child(2) { white-space: nowrap; }
`;

// ------------------------------------------------------------------ pages

function coverHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; color: ${p.text}; }
    .page { width: 210mm; height: 297mm; position: relative; overflow: hidden;
      background: linear-gradient(180deg, ${p.surface} 0%, #FFFFFF 46%); }
    .top { padding: 18mm 18mm 0; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: ${p.text_muted}; font-weight: 600; }
    .top .ieee { color: ${p.accent_text}; }
    .hero { margin: 24mm auto 0; width: 174mm; display: block; }
    .title { text-align: center; margin-top: 12mm; }
    .title .k { font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${p.accent_text}; font-weight: 700; }
    .title h1 { font-size: 30pt; font-weight: 760; letter-spacing: -0.02em; margin: 5pt auto 4pt; max-width: 165mm; text-wrap: balance; }
    .title p { font-size: 12pt; color: ${p.text_secondary}; margin: 0; }
    .shot { margin: 13mm auto 0; width: 150mm; border: 0.6pt solid ${p.border_strong}; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(19,19,22,0.12); }
    .shot .bar { height: 16pt; background: #F2F2F4; border-bottom: 0.6pt solid ${p.border}; display: flex; align-items: center; gap: 4pt; padding: 0 8pt; }
    .shot .dot { width: 6pt; height: 6pt; border-radius: 50%; background: ${p.border_strong}; }
    .shot img { display: block; width: 100%; }
    .foot { position: absolute; left: 0; right: 0; bottom: 0; padding: 9mm 18mm 11mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; border-top: 0.8pt solid ${p.rule}; background: #FFFFFF; }
    .foot .l { font-size: 6.8pt; letter-spacing: 0.1em; text-transform: uppercase; color: ${p.text_muted}; font-weight: 600; }
    .foot .v { font-size: 8.6pt; color: ${p.text}; margin-top: 2pt; line-height: 1.4; }
    .foot .v code { font-family: "SF Mono", ui-monospace, monospace; font-size: 8pt; }
    .band { position: absolute; left: 0; right: 0; bottom: 0; height: 2.4mm; background: ${p.accent}; }
  </style></head><body><div class="page">
    <div class="top"><span class="ieee">IEEE ClimateChain Global Hackathon 2026</span><span>Submission dossier</span></div>
    <img class="hero" src="${file('assets', 'readme', 'hero-light.png')}"/>
    <div class="title">
      <div class="k">Track 1 · Carbon Markets &amp; Emissions Transparency</div>
      <h1>AI-audited, Hedera-verified carbon accounting</h1>
      <p>From a utility bill to a retired tonne, with a public proof for every step.</p>
    </div>
    <div class="shot"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
      <img src="${file('docs', 'images', 'hero-certificate.png')}"/></div>
    <div class="foot">
      <div><div class="l">Live demo</div><div class="v">greentrace-app.vercel.app</div></div>
      <div><div class="l">Audit topic</div><div class="v"><code>0.0.11116480</code></div></div>
      <div><div class="l">Certificate NFTs</div><div class="v"><code>0.0.11116483</code></div></div>
      <div><div class="l">Edition</div><div class="v">October 2026</div></div>
    </div>
    <div class="band"></div>
  </div></body></html>`;
}

function bodyHtml(pages) {
  figure = 0;
  const rendered = chapters.map((c) => renderDoc(c.doc));
  const pg = (key) => (pages[key] ? String(pages[key]) : '00');

  const tocRows = [
    ...chapters.map((c, i) => `<tr><td class="n">${String(i + 1).padStart(2, '0')}</td><td><div class="t">${c.title}</div><div class="r">IEEE deliverable: ${c.requirement}</div></td><td class="pg">${pg(`c${i}`)}</td></tr>`),
    `<tr><td class="n">A</td><td><div class="t">Product screenshots</div><div class="r">The working prototype, captured on Hedera testnet</div></td><td class="pg">${pg('shots')}</td></tr>`,
    `<tr><td class="n">B</td><td><div class="t">Live app, on-chain references and links</div><div class="r">The deployed prototype and everything above, checkable on HashScan</div></td><td class="pg">${pg('links')}</td></tr>`,
  ].join('');

  const overview = `
    <div class="kicker">Overview</div>
    <div class="toc-title">Contents</div>
    <table class="toc"><tbody>${tocRows}</tbody></table>
    <div class="kicker">At a glance</div>
    <div class="stats">
      <div class="stat"><div class="v">6</div><div class="l">AI features, each a schema-checked call whose result is hashed and anchored on Hedera</div></div>
      <div class="stat"><div class="v">0</div><div class="l">numbers taken from the model: emissions, tonnes, grades and baskets are computed in code</div></div>
      <div class="stat"><div class="v">9</div><div class="l">deterministic audit rules run before any certificate can be minted</div></div>
      <div class="stat"><div class="v">5 / 5</div><div class="l">public verification checks: hash, consensus record, NFT, IPFS metadata, audit</div></div>
      <div class="stat"><div class="v">28 t</div><div class="l">CO2e bought in HBAR and retired on chain in the end-to-end test; supply 100,000 to 99,972</div></div>
      <div class="stat"><div class="v">47</div><div class="l">automated unit and contract tests, plus row level security tests on real Postgres</div></div>
    </div>
    <div class="callout"><b>How to read this dossier.</b> Each chapter is one deliverable requested by the IEEE ClimateChain organizers.
      Every on-chain claim links to HashScan, and the same documents live in the repository under <code>docs/</code>, where the diagrams are generated from source.</div>`;

  const body = chapters.map((c, i) => `
    <section class="chapter">
      <div class="opener">
        <div class="kicker">Deliverable ${String(i + 1).padStart(2, '0')} · ${c.requirement}</div>
        <h1>${c.title}</h1>
        <div class="summary">${c.summary}</div>
        <div class="rule"></div>
        <div class="chips">${rendered[i].sections.map((s) => `<span class="chip">${escape(s)}</span>`).join('')}</div>
      </div>
      ${rendered[i].html}
    </section>`).join('');

  const shotPages = shots.map(([img, path, caption]) => {
    figure += 1;
    return `<figure class="shotfig"><div class="frame"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="url">greentrace ${path}</span></div>
      <img src="${file('docs', 'images', img)}"/></div><figcaption><b>Figure ${figure}.</b> ${caption}</figcaption></figure>`;
  }).join('');

  const links = onChain.map(([what, id, url, note]) => `<tr><td>${what}</td><td><a href="${url}"><code>${id}</code></a></td><td>${note}</td></tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><base href="file://${DOCS}/"><style>${css}</style></head><body>
    <section>${overview}</section>
    ${body}
    <section class="chapter"><div class="opener"><div class="kicker">Appendix A</div><h1>Product screenshots</h1>
      <div class="summary">The working prototype on Hedera testnet, driven end to end through the browser with live AI and a real wallet.</div><div class="rule"></div></div>
      ${shotPages}</section>
    <section class="chapter"><div class="opener"><div class="kicker">Appendix B</div><h1>Live app, on-chain references and links</h1>
      <div class="summary">The prototype is deployed, and every identifier below is live on Hedera testnet.</div><div class="rule"></div></div>
      <table class="links"><thead><tr><th>What</th><th>ID</th><th>Purpose</th></tr></thead><tbody>${links}</tbody></table>
      <h2>Submission</h2>
      <table><tbody>
        <tr><td>Hackathon</td><td><a href="https://ieee-climatechain-hack.devpost.com/">IEEE ClimateChain Global Hackathon 2026</a>, organized by the IEEE Blockchain Türkiye Group with the IEEE Blockchain Technical Committee</td></tr>
        <tr><td>Track</td><td>Track 1: Carbon Markets &amp; Emissions Transparency</td></tr>
        <tr><td>Stack</td><td>Next.js 14, TypeScript, Supabase (Postgres with row level security), Hedera Consensus Service, Token Service and EVM, Solidity, OpenAI or Claude structured outputs, IPFS via Pinata</td></tr>
      </tbody></table>
    </section>
  </body></html>`;
}

const header = `<div style="width:100%;font-family:-apple-system,'Helvetica Neue',sans-serif;font-size:7px;color:${p.text_muted};padding:0 17mm;display:flex;justify-content:space-between;align-items:flex-end;">
  <span><b style="color:${p.text}">Green</b><b style="color:${p.accent_text}">Trace</b>&nbsp;&nbsp;·&nbsp;&nbsp;Submission dossier</span><span>IEEE ClimateChain Global Hackathon 2026 · Track 1</span></div>`;
const footer = `<div style="width:100%;font-family:-apple-system,'Helvetica Neue',sans-serif;font-size:7px;color:${p.text_muted};padding:0 17mm;display:flex;justify-content:space-between;">
  <span>Carbon accounting you can verify, not just trust.</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

// ------------------------------------------------------------------ print

const work = mkdtempSync(join(tmpdir(), 'gt-dossier-'));
const chrome = await launch();

async function print(html, name, { headerFooter }) {
  const page = join(work, `${name}.html`);
  writeFileSync(page, html);
  await chrome.open(`file://${page}`, { width: 1200, height: 1600 });
  await chrome.evaluate(`Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))])`);
  const { data } = await chrome.send('Page.printToPDF', {
    preferCSSPageSize: true, printBackground: true, displayHeaderFooter: headerFooter,
    headerTemplate: headerFooter ? header : '<span></span>', footerTemplate: headerFooter ? footer : '<span></span>',
  });
  const pdf = join(work, `${name}.pdf`);
  writeFileSync(pdf, Buffer.from(data, 'base64'));
  return pdf;
}

function locate(pdf) {
  const count = Number(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1]);
  const text = [];
  for (let n = 1; n <= count; n++) {
    text.push(execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ''));
  }
  const find = (needle) => text.findIndex((t) => t.includes(needle.replace(/\s+/g, ''))) + 1;
  const pages = {};
  chapters.forEach((c, i) => { pages[`c${i}`] = find(`Deliverable ${String(i + 1).padStart(2, '0')} ·`.toUpperCase()); });
  pages.shots = find('APPENDIX A');
  pages.links = find('APPENDIX B');
  return { pages, count };
}

try {
  const cover = await print(coverHtml(), 'cover', { headerFooter: false });
  const first = locate(await print(bodyHtml({}), 'body-1', { headerFooter: true }));
  const body = await print(bodyHtml(first.pages), 'body-2', { headerFooter: true });
  const second = locate(body);
  if (JSON.stringify(first.pages) !== JSON.stringify(second.pages)) throw new Error('page numbers moved between passes');
  if (Object.values(second.pages).some((n) => n < 1)) throw new Error(`a chapter was not found: ${JSON.stringify(second.pages)}`);
  execFileSync('pdfunite', [cover, body, out]);
  const problem = second.pages.c1 - second.pages.c0;
  console.log(`${out}\n  ${second.count + 1} pages; chapters start on body pages ${JSON.stringify(second.pages)}; problem statement ${problem} page(s)`);
} finally {
  await chrome.close();
  if (!process.env.KEEP) rmSync(work, { recursive: true, force: true }); else console.log(work);
}
