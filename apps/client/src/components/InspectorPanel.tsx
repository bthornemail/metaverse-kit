import { useEffect, useRef, useState } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import type { NodeId } from '@metaverse-kit/protocol';
import type { SemanticRole } from '../semantic/roles';
import { SEMANTIC_ROLES } from '../semantic/roles';

interface InspectorPanelProps {
  tileState: TileState | null;
  selectedIds: NodeId[];
  onUpdateProperties: (nodeId: NodeId, properties: Record<string, unknown>, label?: string) => void;
  onDeleteNode: (nodeId: NodeId) => void;
  onUpdateLink: (
    from: NodeId,
    to: NodeId,
    relation: string,
    nextRelation: string,
    nextRoute: 'orth' | 'straight' | 'bezier'
  ) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  historyGroupWindowMs?: number;
  importMeta?: {
    rid?: string;
    filename?: string;
    size?: number;
    created_at?: number;
    source?: string;
    url?: string;
  } | null;
}

export default function InspectorPanel({
  tileState,
  selectedIds,
  onUpdateProperties,
  onDeleteNode,
  onUpdateLink,
  pinned = false,
  onTogglePin,
  historyGroupWindowMs = 1500,
  importMeta = null,
}: InspectorPanelProps) {
  const node = tileState?.nodes && selectedIds.length ? tileState.nodes.get(selectedIds[0]) : null;
  const [featureInput, setFeatureInput] = useState('');
  const [hoveredFeatureIndex, setHoveredFeatureIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (pinned) setIsOpen(true);
  }, [pinned]);

  const visible = !isMobile || isOpen || pinned;

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 'clamp(200px, 22vw, 300px)',
        background: '#0d0d0d',
        borderLeft: '1px solid #222',
        padding: '14px',
        color: '#ccc',
        fontFamily: 'monospace',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        zIndex: 15,
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? 0;
        const dx = endX - touchStartX.current;
        if (dx < -40) setIsOpen(true);
        if (dx > 40 && !pinned) setIsOpen(false);
        touchStartX.current = null;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#8aa', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Inspector</span>
          <span
            title={pinned ? 'Pinned' : 'Unpinned'}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: pinned ? '#44cc88' : '#333',
              border: '1px solid #222',
              display: 'inline-block',
            }}
          />
        </div>
        {onTogglePin ? (
          <button
            onClick={() => {
              onTogglePin();
              if (!pinned) setIsOpen(true);
            }}
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              background: pinned ? '#224' : '#1b1b1b',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : null}
      </div>
      {isMobile ? (
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{
            position: 'absolute',
            left: '-18px',
            top: '20px',
            width: '18px',
            height: '60px',
            background: '#111',
            color: '#888',
            border: '1px solid #333',
            borderRadius: '6px 0 0 6px',
            cursor: 'pointer',
          }}
        >
          {visible ? '›' : '‹'}
        </button>
      ) : null}
      <div>
        <div style={{ color: '#666' }}>
          {selectedIds.length === 0 ? 'No selection' : `${selectedIds.length} selected`}
        </div>
      </div>
      {node ? (
        <>
          <div style={{ color: '#666' }}>
            Stencil: {(node.properties?.stencil_id as string) ?? 'custom'}
          </div>
          <label style={{ display: 'block' }}>
            Label
            <input
              defaultValue={(node.properties?.label as string) ?? ''}
              onBlur={(e) => onUpdateProperties(node.node_id, { label: e.target.value })}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                background: '#090909',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
            />
          </label>
          <label style={{ display: 'block' }}>
            Role
            <select
              value={(node.properties?.semantic_role as string) ?? 'law'}
              onChange={(e) =>
                onUpdateProperties(node.node_id, {
                  semantic_role: e.target.value as SemanticRole,
                  label: e.target.value,
                })
              }
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                background: '#090909',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
            >
              {SEMANTIC_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            EXT32 Pack
            <input
              defaultValue={(node.properties?.ext32_pack as string) ?? ''}
              onBlur={(e) => onUpdateProperties(node.node_id, { ext32_pack: e.target.value })}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                background: '#090909',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
            />
          </label>
          {importMeta ? (
            <div>
              <div style={{ color: '#8aa', marginBottom: '6px' }}>Import Metadata</div>
              <div style={{ color: '#666', fontSize: '11px' }}>
                {importMeta.rid ? <div>RID: {importMeta.rid}</div> : null}
                <div>File: {importMeta.filename ?? 'unknown'}</div>
                <div>Size: {typeof importMeta.size === 'number' ? `${Math.round(importMeta.size / 1024)} KB` : 'unknown'}</div>
                <div>
                  Created:{' '}
                  {importMeta.created_at ? new Date(importMeta.created_at).toLocaleString() : 'unknown'}
                </div>
                {importMeta.source ? <div>Source: {importMeta.source}</div> : null}
                {importMeta.url ? (
                  <div style={{ wordBreak: 'break-all' }}>URL: {importMeta.url}</div>
                ) : null}
                {importMeta.rid ? (
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(importMeta.rid ?? '');
                    }}
                    style={{
                      marginTop: '6px',
                      padding: '4px 6px',
                      fontSize: '10px',
                      background: '#1b1b1b',
                      color: '#aaa',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy RID
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div>
            <div style={{ color: '#8aa', marginBottom: '6px' }}>EXT32 Features</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                placeholder="feature pack id"
                style={{
                  flex: 1,
                  padding: '6px',
                  background: '#090909',
                  color: '#ddd',
                  border: '1px solid #333',
                  borderRadius: '6px',
                }}
              />
              <button
                onClick={() => {
                  const trimmed = featureInput.trim();
                  if (!trimmed) return;
                  const current = Array.isArray(node.properties?.ext32_features)
                    ? (node.properties?.ext32_features as string[])
                    : [];
                  if (current.includes(trimmed)) {
                    setFeatureInput('');
                    return;
                  }
                  onUpdateProperties(node.node_id, { ext32_features: [...current, trimmed] }, 'feature_stack:add');
                  setFeatureInput('');
                }}
                style={{
                  padding: '6px 8px',
                  background: '#1b1b1b',
                  color: '#aaa',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
            {Array.isArray(node.properties?.ext32_features) && (node.properties?.ext32_features as string[]).length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(node.properties?.ext32_features as string[]).map((feature, idx, arr) => (
                  <div
                    key={`${feature}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px',
                      border: '1px solid #222',
                      borderRadius: '6px',
                      background: '#0b0b0b',
                    }}
                  >
                    <div style={{ flex: 1, color: '#bbb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{feature}</span>
                      {hoveredFeatureIndex === idx ? (
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#666',
                            border: '1px solid #333',
                            borderRadius: '10px',
                            padding: '2px 6px',
                            background: '#111',
                          }}
                        >
                          group {historyGroupWindowMs}ms
                        </span>
                      ) : null}
                    </div>
                    <button
                      disabled={idx === 0}
                      title={`Grouping window: ${historyGroupWindowMs}ms`}
                      onMouseEnter={() => setHoveredFeatureIndex(idx)}
                      onMouseLeave={() => setHoveredFeatureIndex(null)}
                      onClick={() => {
                        if (idx === 0) return;
                        const next = [...arr];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        onUpdateProperties(node.node_id, { ext32_features: next }, 'feature_stack:move');
                      }}
                      style={{
                        padding: '4px 6px',
                        background: '#1b1b1b',
                        color: idx === 0 ? '#444' : '#aaa',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        cursor: idx === 0 ? 'default' : 'pointer',
                      }}
                    >
                      ↑
                    </button>
                    <button
                      disabled={idx === arr.length - 1}
                      title={`Grouping window: ${historyGroupWindowMs}ms`}
                      onMouseEnter={() => setHoveredFeatureIndex(idx)}
                      onMouseLeave={() => setHoveredFeatureIndex(null)}
                      onClick={() => {
                        if (idx === arr.length - 1) return;
                        const next = [...arr];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        onUpdateProperties(node.node_id, { ext32_features: next }, 'feature_stack:move');
                      }}
                      style={{
                        padding: '4px 6px',
                        background: '#1b1b1b',
                        color: idx === arr.length - 1 ? '#444' : '#aaa',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        cursor: idx === arr.length - 1 ? 'default' : 'pointer',
                      }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        const next = arr.filter((_, i) => i !== idx);
                        onUpdateProperties(node.node_id, { ext32_features: next }, 'feature_stack:remove');
                      }}
                      style={{
                        padding: '4px 6px',
                        background: '#2a1414',
                        color: '#ffb3b3',
                        border: '1px solid #663333',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#555' }}>No features</div>
            )}
          </div>
          <label style={{ display: 'block' }}>
            Actions
            <input
              defaultValue={
                Array.isArray(node.properties?.narrative?.actions)
                  ? (node.properties?.narrative?.actions as string[]).join(',')
                  : ''
              }
              onBlur={(e) =>
                onUpdateProperties(node.node_id, {
                  narrative: {
                    ...(node.properties?.narrative as Record<string, unknown>),
                    actions: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  },
                })
              }
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                background: '#090909',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
            />
          </label>
          <label style={{ display: 'block' }}>
            Intensity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={Number(node.properties?.narrative?.intensity ?? 0.6)}
              onMouseUp={(e) =>
                onUpdateProperties(node.node_id, {
                  narrative: {
                    ...(node.properties?.narrative as Record<string, unknown>),
                    intensity: Number((e.target as HTMLInputElement).value),
                  },
                })
              }
              style={{ width: '100%', marginTop: '6px' }}
            />
          </label>
          <div>
            <div style={{ color: '#8aa', marginBottom: '6px' }}>Relations</div>
            {node.links?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {node.links.map((link, idx) => {
                  const [base, route = 'orth'] = String(link.relation).split('::');
                  return (
                  <label key={`${link.relation}-${link.to}-${idx}`} style={{ display: 'block' }}>
                    <div style={{ color: '#777', marginBottom: '4px' }}>{link.to}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        defaultValue={base}
                        onBlur={(e) =>
                          onUpdateLink(
                            node.node_id,
                            link.to,
                            link.relation,
                            e.target.value,
                            route as 'orth' | 'straight' | 'bezier'
                          )
                        }
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: '#090909',
                          color: '#ddd',
                          border: '1px solid #333',
                          borderRadius: '6px',
                        }}
                      />
                      <select
                        defaultValue={route}
                        onChange={(e) =>
                          onUpdateLink(
                            node.node_id,
                            link.to,
                            link.relation,
                            base,
                            e.target.value as 'orth' | 'straight' | 'bezier'
                          )
                        }
                        style={{
                          width: '90px',
                          padding: '6px',
                          background: '#090909',
                          color: '#ddd',
                          border: '1px solid #333',
                          borderRadius: '6px',
                        }}
                      >
                        <option value="orth">Orth</option>
                        <option value="straight">Straight</option>
                        <option value="bezier">Bezier</option>
                      </select>
                    </div>
                  </label>
                )})}
              </div>
            ) : (
              <div style={{ color: '#555' }}>No relations</div>
            )}
          </div>
          <button
            onClick={() => onDeleteNode(node.node_id)}
            style={{
              padding: '8px 10px',
              background: '#3a1f1f',
              color: '#ffb3b3',
              border: '1px solid #663333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Delete Node
          </button>
        </>
      ) : null}
    </div>
  );
}
