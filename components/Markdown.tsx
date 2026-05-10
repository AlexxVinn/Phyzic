"use client";

import { useLayoutEffect, useRef } from "react";
import { escapeHtml } from "@/lib/utils";

function mdToHtml(text: string): string {
  if (!text) return "";

  const segments: { html: string; isRaw: boolean }[] = [];
  const tokenRe = /```(\w+)?\n[\s\S]*?```|`[^`]+`|\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)[^$\n]+\$(?!\$)|\\\[[\s\S]*?\\\]|\\\([^)]+?\\\)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ html: text.slice(lastIdx, match.index), isRaw: false });
    }

    const m = match[0];
    if (m.startsWith("```")) {
      const langMatch = m.match(/^```(\w+)?\n/);
      const lang = langMatch?.[1] || "";
      const code = m.slice(langMatch![0].length, -3);
      segments.push({
        html: `<pre class="md-pre"><code class="md-code ${lang ? `language-${lang}` : ""}">${escapeHtml(code)}</code></pre>`,
        isRaw: true,
      });
    } else if (m.startsWith("`") && !m.startsWith("```")) {
      segments.push({
        html: `<code class="md-inline-code">${escapeHtml(m.slice(1, -1))}</code>`,
        isRaw: true,
      });
    } else if (m.startsWith("$$")) {
      segments.push({
        html: `<div class="md-math md-math-display">\\[${escapeHtml(m.slice(2, -2))}\\]</div>`,
        isRaw: true,
      });
    } else if (m.startsWith("$")) {
      segments.push({
        html: `<span class="md-math md-math-inline">\\(${escapeHtml(m.slice(1, -1))}\\)</span>`,
        isRaw: true,
      });
    } else if (m.startsWith("\\[")) {
      segments.push({
        html: `<div class="md-math md-math-display">\\[${escapeHtml(m.slice(2, -2))}\\]</div>`,
        isRaw: true,
      });
    } else if (m.startsWith("\\(")) {
      segments.push({
        html: `<span class="md-math md-math-inline">\\(${escapeHtml(m.slice(2, -2))}\\)</span>`,
        isRaw: true,
      });
    }

    lastIdx = match.index + m.length;
  }

  if (lastIdx < text.length) {
    segments.push({ html: text.slice(lastIdx), isRaw: false });
  }

  const output: string[] = [];
  for (const seg of segments) {
    if (seg.isRaw) {
      output.push(seg.html);
      continue;
    }

    let s = escapeHtml(seg.html);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-strong">$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong class="md-strong">$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em class="md-em">$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em class="md-em">$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del class="md-del">$1</del>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote class="md-bq">$1</blockquote>');
    s = s.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    s = s.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');
    s = s.replace(/^(\s*)- (.+)$/gm, (_, indent, item) => {
      return `<li class="md-li" style="margin-left:${indent.length * 16}px">${item}</li>`;
    });
    s = s.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');

    const paragraphs = s.split("\n\n").map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
      return `<p class="md-p">${trimmed}</p>`;
    });
    output.push(paragraphs.join("\n"));
  }

  return output.join("\n");
}

interface MarkdownProps {
  text: string;
  className?: string;
}

export default function Markdown({ text, className = "" }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Set HTML directly so React never clobbers MathJax output via reconciliation.
    node.innerHTML = mdToHtml(text);

    const win = window as any;

    const doTypeset = (): boolean => {
      if (!win.MathJax?.typesetPromise) return false;
      win.MathJax.typesetPromise([node]).catch(() => {});
      return true;
    };

    if (doTypeset()) return;

    // MathJax not loaded yet — poll until it is.
    let timer: ReturnType<typeof setInterval> | null = null;
    timer = setInterval(() => {
      if (doTypeset() && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 200);

    const timeout = setTimeout(() => {
      if (timer) clearInterval(timer);
    }, 10000);

    return () => {
      if (timer) clearInterval(timer);
      clearTimeout(timeout);
      // Remove this element from MathJax's processed list so future
      // renders (after React replaces the DOM) are guaranteed to re-typeset.
      if (win.MathJax?.typesetClear && ref.current) {
        win.MathJax.typesetClear([ref.current]);
      }
    };
  }, [text]);

  return <div ref={ref} className={`md-body ${className}`} />;
}
