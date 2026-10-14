import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// A deliberately small Markdown renderer for AI-drafted text: paragraphs, headings, bullet and
// numbered lists, simple pipe tables, **bold**, *italic* and [DATA NEEDED: ...] placeholders.
// It builds React elements only, so model output can never inject HTML.

const INLINE = /(\[DATA NEEDED:[^\]]*\]|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith('[DATA NEEDED:')) {
        return (
          <mark
            key={key}
            className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800"
          >
            {part}
          </mark>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderInline(part.slice(2, -2), key)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered && !bullet);
      const last = blocks[blocks.length - 1];
      const item = (bullet ?? numbered)![1];
      if (last?.type === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ type: 'list', ordered, items: [item] });
      continue;
    }
    // A continuation line directly under a list item belongs to that item.
    const last = blocks[blocks.length - 1];
    if (!paragraph.length && last?.type === 'list' && /^\s{2,}/.test(line)) {
      last.items[last.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

export function MarkdownLite({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={cn('space-y-3 text-sm leading-relaxed text-foreground/90', className)}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.type) {
          case 'heading':
            return (
              <p key={key} className={cn('font-semibold text-foreground', block.level <= 2 ? 'pt-1 text-base' : 'text-sm')}>
                {renderInline(block.text, key)}
              </p>
            );
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={key} className={cn('space-y-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(item, `${key}-${j}`)}
                  </li>
                ))}
              </ListTag>
            );
          }
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {block.header.map((h, j) => (
                        <th key={j} className="px-3 py-2 font-medium">
                          {renderInline(h, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-t">
                        {row.map((cell, c) => (
                          <td key={c} className="px-3 py-2 align-top">
                            {renderInline(cell, `${key}-${r}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{renderInline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}

/** Counts [DATA NEEDED: ...] placeholders in a text. */
export function countPlaceholders(text: string): number {
  return (text.match(/\[DATA NEEDED:[^\]]*\]/g) ?? []).length;
}
