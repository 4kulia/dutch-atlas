import { Fragment, type ReactNode } from 'react';

// Tiny self-rolled markdown subset — enough for assistant replies. Supports:
//   • paragraphs (double newline split)
//   • headings #, ##, ### (rendered as h3/h4/h5)
//   • horizontal rules ---
//   • bullet lists with `-`, `*`, or `•`
//   • numbered lists (1., 2., 3.)
//   • inline **bold**, *italic*, _italic_, `code`
//   • inline code spans
//
// Anything we don't recognise is rendered as plain text. We never inject HTML.

export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);
  return blocks.map((b, i) => (
    <Fragment key={i}>{renderBlock(b, i)}</Fragment>
  ));
}

function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  if (/^---+$|^\*\*\*+$/.test(trimmed)) {
    return <hr className="my-3 border-ink-700/40" />;
  }

  const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
  if (heading) {
    const level = heading[1]!.length;
    const content = heading[2]!;
    const cls =
      level === 1
        ? 'mt-3 mb-1 text-[16px] font-semibold text-ink-100'
        : level === 2
          ? 'mt-2 mb-1 text-[14px] font-semibold text-ink-100'
          : 'mt-1 mb-0.5 text-[13px] font-semibold text-ink-100';
    return <div className={cls}>{renderInline(content)}</div>;
  }

  const lines = trimmed.split('\n').map((l) => l.trimEnd());

  // Bullet list (every non-empty line starts with -, *, or •)
  if (lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l))) {
    return (
      <ul className="my-1 list-disc space-y-0.5 pl-5 marker:text-ink-500">
        {lines.map((l, j) => (
          <li key={j} className="text-[14px] leading-relaxed text-ink-100">
            {renderInline(l.replace(/^[-*•]\s+/, ''))}
          </li>
        ))}
      </ul>
    );
  }

  // Numbered list (every line starts with N.)
  if (lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l))) {
    return (
      <ol className="my-1 list-decimal space-y-0.5 pl-5 marker:text-ink-500">
        {lines.map((l, j) => (
          <li key={j} className="text-[14px] leading-relaxed text-ink-100">
            {renderInline(l.replace(/^\d+[.)]\s+/, ''))}
          </li>
        ))}
      </ol>
    );
  }

  // Default: paragraph with soft line breaks.
  return (
    <p className="text-[14px] leading-relaxed text-ink-100">
      {lines.map((line, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(line)}
        </Fragment>
      ))}
    </p>
  );
  void key;
}

// Inline tokenizer — single pass that finds **bold**, *italic*, _italic_, `code`.
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*\n]+?\*\*)|(\*[^*\n]+?\*)|(_[^_\n]+?_)|(`[^`\n]+?`)/g;
  let last = 0;
  let key = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(<strong key={key++} className="font-semibold text-ink-100">{m[1].slice(2, -2)}</strong>);
    } else if (m[2]) {
      out.push(<em key={key++} className="italic">{m[2].slice(1, -1)}</em>);
    } else if (m[3]) {
      out.push(<em key={key++} className="italic">{m[3].slice(1, -1)}</em>);
    } else if (m[4]) {
      out.push(
        <code key={key++} className="rounded bg-ink-800/60 px-1 py-[1px] font-mono text-[12px] text-ink-100">
          {m[4].slice(1, -1)}
        </code>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
