import { useEffect, useMemo, useRef, useState } from 'react';
import type { TileState, NodeState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';

interface Overlay2DProps {
  tileState: TileState;
  viewport: { offsetX: number; offsetY: number; scale: number };
}

export default function Overlay2D({ tileState, viewport }: Overlay2DProps) {
  const contentCacheRef = useRef<Map<string, string>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  const nodes = useMemo(() => getLiveNodes(tileState), [tileState]);
  const overlayNodes = nodes.filter((node) => node.text || node.document || node.media?.kind === 'mp4');
  const interactiveDocs = overlayNodes.filter(
    (node) => node.document?.kind === 'html' || node.document?.kind === 'pdf'
  );
  const passiveNodes = overlayNodes.filter(
    (node) => !(node.document?.kind === 'html' || node.document?.kind === 'pdf')
  );

  useEffect(() => {
    for (const node of overlayNodes) {
      if (node.text) {
        const ref = node.text.ref;
        if (isInlineText(ref)) continue;
        const url = resolveRef(ref);
        if (contentCacheRef.current.has(url) || loadingRef.current.has(url)) continue;
        loadingRef.current.add(url);
        void fetch(url)
          .then((r) => r.text())
          .then((text) => {
            contentCacheRef.current.set(url, text);
            setTick((t) => t + 1);
          })
          .finally(() => loadingRef.current.delete(url));
      }

      if (node.document) {
        const ref = node.document.ref;
        if (node.document.kind === 'pdf') continue;
        if (isInlineText(ref)) continue;
        const url = resolveRef(ref);
        if (contentCacheRef.current.has(url) || loadingRef.current.has(url)) continue;
        loadingRef.current.add(url);
        void fetch(url)
          .then((r) => r.text())
          .then((text) => {
            contentCacheRef.current.set(url, text);
            setTick((t) => t + 1);
          })
          .finally(() => loadingRef.current.delete(url));
      }
    }
  }, [overlayNodes, tick]);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {passiveNodes.map((node) => {
          const [x, y] = node.transform.position;
          const [w, h] = node.transform.scale;
          const [sx, sy] = worldToScreen(x, y, viewport);
          const sw = w * viewport.scale;
          const sh = h * viewport.scale;

          if (node.text) {
            return (
              <TextBlock
                key={`${node.node_id}:${tick}`}
                node={node}
                x={sx}
                y={sy}
                w={sw}
                h={sh}
                cache={contentCacheRef.current}
              />
            );
          }

          if (node.document) {
            return (
              <DocumentBlock
                key={`${node.node_id}:${tick}`}
                node={node}
                x={sx}
                y={sy}
                w={sw}
                h={sh}
                cache={contentCacheRef.current}
              />
            );
          }

          return null;
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {interactiveDocs.map((node) => {
          const [x, y] = node.transform.position;
          const [w, h] = node.transform.scale;
          const [sx, sy] = worldToScreen(x, y, viewport);
          const sw = w * viewport.scale;
          const sh = h * viewport.scale;

          return (
            <DocumentBlock
              key={`${node.node_id}:${tick}`}
              node={node}
              x={sx}
              y={sy}
              w={sw}
              h={sh}
              cache={contentCacheRef.current}
            />
          );
        })}
      </div>
    </>
  );
}

function TextBlock({
  node,
  x,
  y,
  w,
  h,
  cache,
}: {
  node: NodeState;
  x: number;
  y: number;
  w: number;
  h: number;
  cache: Map<string, string>;
}) {
  const ref = node.text?.ref ?? '';
  const inline = isInlineText(ref) ? ref : cache.get(resolveRef(ref)) ?? 'Loading...';
  const html = node.text?.kind === 'markdown' ? renderMarkdown(inline) : escapeHtml(inline);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid #333',
        color: '#ddd',
        padding: '8px',
        fontFamily: node.text?.kind === 'code' ? 'monospace' : 'system-ui',
        fontSize: '12px',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DocumentBlock({
  node,
  x,
  y,
  w,
  h,
  cache,
}: {
  node: NodeState;
  x: number;
  y: number;
  w: number;
  h: number;
  cache: Map<string, string>;
}) {
  const doc = node.document!;
  const ref = doc.ref;
  const url = resolveRef(ref);

  if (doc.kind === 'pdf') {
    return (
      <object
        data={url}
        type="application/pdf"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          border: '1px solid #333',
        background: '#111',
        pointerEvents: 'auto',
      }}
      >
        <div style={{ color: '#888', fontSize: '12px', padding: '8px' }}>
          PDF document
        </div>
      </object>
    );
  }

  if (doc.kind === 'html') {
    const html = isInlineText(ref) ? ref : cache.get(url) ?? '';
    return (
      <iframe
        title={`doc-${node.node_id}`}
        srcDoc={html}
        sandbox=""
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          border: '1px solid #333',
        background: '#111',
        pointerEvents: 'auto',
      }}
      />
    );
  }

  const content = isInlineText(ref) ? ref : cache.get(url) ?? 'Loading...';
  const html = doc.kind === 'md-page' ? renderMarkdown(content) : escapeHtml(content);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid #333',
        color: '#ddd',
        padding: '8px',
        fontFamily: 'system-ui',
        fontSize: '12px',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function worldToScreen(x: number, y: number, vp: { offsetX: number; offsetY: number; scale: number }): [number, number] {
  return [x * vp.scale + vp.offsetX, y * vp.scale + vp.offsetY];
}

function resolveRef(ref: string): string {
  if (ref.startsWith('sha256:') || ref.startsWith('blake3:')) {
    return `/object/${encodeURIComponent(ref)}`;
  }
  return ref;
}

function isInlineText(ref: string): boolean {
  if (ref.startsWith('sha256:') || ref.startsWith('blake3:')) return false;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return false;
  return true;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(input: string): string {
  const escaped = escapeHtml(input);
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      out.push(inCode ? '<pre><code>' : '</code></pre>');
      continue;
    }

    if (inCode) {
      out.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      out.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('- ')) {
      const item = inlineMarkdown(line.slice(2));
      const prev = out[out.length - 1];
      if (!prev || !prev.startsWith('<ul')) {
        out.push('<ul>');
      }
      out.push(`<li>${item}</li>`);
      continue;
    }

    if (out.length > 0 && out[out.length - 1].startsWith('<li>') && line.trim() === '') {
      out.push('</ul>');
      continue;
    }

    if (line.trim() === '') {
      out.push('<br />');
      continue;
    }

    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (out.length > 0 && out[out.length - 1].startsWith('<li>')) {
    out.push('</ul>');
  }

  return out.join('\n');
}

function inlineMarkdown(input: string): string {
  return input
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}
