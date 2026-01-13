import { useMemo, useState, type DragEvent } from 'react';
import type { Ext32Pack, Ext32Assets } from '@metaverse-kit/ext32';
import { AssetPreview, clearPreviewCache } from './AssetPreview';

type AssetCategory = 'all' | 'svg' | '3d' | 'media' | 'documents';

type AssetEntry = {
  id: string;
  packId: string;
  packLabel: string;
  version: string;
  role?: string;
  type: string;
  ref: string;
  category: AssetCategory;
};

type DragPayload = {
  mode: 'pack' | 'asset';
  packId: string;
  packLabel?: string;
  assetType?: string;
  assetRef?: string;
  role?: string;
};

interface LibraryPanelProps {
  packs: Ext32Pack[];
  mode: 'edit' | 'explore';
  category: AssetCategory;
  setCategory: (category: AssetCategory) => void;
  onClose?: () => void;
}

const categories: Array<{ id: AssetCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'svg', label: 'SVG' },
  { id: '3d', label: '3D' },
  { id: 'media', label: 'Media' },
  { id: 'documents', label: 'Docs' },
];

function categoryForAsset(type: string): AssetCategory {
  if (type === 'svg') return 'svg';
  if (type === 'glb' || type === 'obj' || type === 'mtl') return '3d';
  if (type === 'wav' || type === 'mp4') return 'media';
  return 'documents';
}

function collectAssets(
  pack: Ext32Pack,
  assets: Ext32Assets | undefined,
  role?: string
): AssetEntry[] {
  if (!assets) return [];
  const entries: AssetEntry[] = [];
  const push = (type: keyof Ext32Assets, ref?: string) => {
    if (!ref) return;
    entries.push({
      id: `${pack.pack_id}:${role ?? 'default'}:${type}`,
      packId: pack.pack_id,
      packLabel: pack.namespace || pack.pack_id,
      version: pack.version,
      role,
      type,
      ref,
      category: categoryForAsset(type),
    });
  };
  push('svg', assets.svg);
  push('glb', assets.glb);
  push('obj', assets.obj);
  push('mtl', assets.mtl);
  push('wav', assets.wav);
  push('mp4', assets.mp4);
  return entries;
}

export default function LibraryPanel({
  packs,
  mode,
  category,
  setCategory,
  onClose,
}: LibraryPanelProps) {
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  const assetEntries = useMemo(() => {
    const all: AssetEntry[] = [];
    for (const pack of packs) {
      all.push(...collectAssets(pack, pack.assets?.default));
      if (pack.assets?.roles) {
        for (const [role, assets] of Object.entries(pack.assets.roles)) {
          all.push(...collectAssets(pack, assets, role));
        }
      }
    }
    return all;
  }, [packs]);

  const filteredAssets = assetEntries.filter((entry) => category === 'all' || entry.category === category);

  const dragPayload = (payload: DragPayload) => (event: DragEvent) => {
    event.dataTransfer.setData('application/x-mvk-asset', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const packCard = (pack: Ext32Pack) => (
    <div
      key={pack.pack_id}
      style={{
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #2a2a2a',
        background: '#141414',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ fontSize: '12px', color: '#e0e0e0' }}>{pack.namespace || pack.pack_id}</div>
      <div style={{ fontSize: '11px', color: '#666' }}>{pack.version}</div>
      <button
        draggable
        onDragStart={dragPayload({ mode: 'pack', packId: pack.pack_id, packLabel: pack.namespace || pack.pack_id })}
        style={{
          marginTop: '6px',
          padding: '6px 8px',
          fontSize: '11px',
          background: '#1d1d1d',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: '6px',
          cursor: 'grab',
        }}
      >
        Drag Pack
      </button>
      <button
        onClick={() => {
          clearPreviewCache(pack.pack_id);
          setCacheVersion((v) => v + 1);
        }}
        style={{
          padding: '4px 6px',
          fontSize: '10px',
          background: '#1b1b1b',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Clear Pack Cache
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10px', color: '#666' }}>
        {pack.assets?.default ? Object.keys(pack.assets.default).map((k) => <span key={k}>{k}</span>) : null}
      </div>
    </div>
  );

  const assetCard = (entry: AssetEntry) => (
    <div
      key={`${entry.packId}:${entry.type}:${entry.role ?? 'default'}:${entry.ref}:${cacheVersion}`}
      draggable
      onDragStart={dragPayload({
        mode: 'asset',
        packId: entry.packId,
        packLabel: entry.packLabel,
        assetType: entry.type,
        assetRef: entry.ref,
        role: entry.role,
      })}
      style={{
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid #2a2a2a',
        background: '#101010',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        cursor: 'grab',
      }}
    >
      <AssetPreview type={entry.type} refUrl={entry.ref} cacheKey={`${entry.packId}:${entry.ref}`} />
      <div style={{ fontSize: '11px', color: '#d0d0d0' }}>{entry.type.toUpperCase()}</div>
      <div style={{ fontSize: '10px', color: '#666' }}>{entry.packLabel}</div>
      <div style={{ fontSize: '10px', color: '#555' }}>{entry.role ?? 'default'}</div>
    </div>
  );

  if (mode === 'explore') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(6, 6, 6, 0.96)',
          zIndex: 25,
          color: '#ccc',
          padding: '24px',
          overflow: 'auto',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', color: '#eee' }}>EXT32 Library — Explore</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                clearPreviewCache();
                setCacheVersion((v) => v + 1);
              }}
              style={{
                padding: '6px 10px',
                background: '#1b1b1b',
                color: '#aaa',
                border: '1px solid #333',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Clear Preview Cache
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px 10px',
                background: '#1b1b1b',
                color: '#aaa',
                border: '1px solid #333',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {packs.map((pack) => (
            <div
              key={pack.pack_id}
              style={{
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #2a2a2a',
                background: '#0f0f0f',
              }}
              onClick={() => setActivePackId(pack.pack_id)}
            >
              <div style={{ fontSize: '12px', color: '#f0f0f0' }}>{pack.namespace || pack.pack_id}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{pack.version}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearPreviewCache(pack.pack_id);
                  setCacheVersion((v) => v + 1);
                }}
                style={{
                  marginTop: '8px',
                  padding: '4px 6px',
                  fontSize: '10px',
                  background: '#1b1b1b',
                  color: '#aaa',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Clear Pack Cache
              </button>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(pack.assets?.default ? Object.keys(pack.assets.default) : []).map((key) => (
                  <span key={key} style={{ fontSize: '10px', color: '#666' }}>
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {activePackId ? (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', color: '#e0e0e0', marginBottom: '8px' }}>
              Assets — {activePackId}
            </div>
            <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              {assetEntries
                .filter((entry) => entry.packId === activePackId)
                .map((entry) => (
                  <div
                    key={`${entry.packId}:${entry.type}:${entry.role ?? 'default'}:${entry.ref}:${cacheVersion}`}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #2a2a2a',
                      background: '#141414',
                      fontSize: '11px',
                      color: '#999',
                    }}
                  >
                    <AssetPreview type={entry.type} refUrl={entry.ref} cacheKey={`${entry.packId}:${entry.ref}`} />
                    <div style={{ marginTop: '6px' }}>{entry.type.toUpperCase()}</div>
                    <div style={{ color: '#555' }}>{entry.role ?? 'default'}</div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'clamp(200px, 20vw, 280px)',
        background: '#0b0b0b',
        borderRight: '1px solid #222',
        padding: '14px',
        color: '#ccc',
        fontFamily: 'monospace',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: '#eee' }}>Library Drawer</div>
        <button
          onClick={() => {
            clearPreviewCache();
            setCacheVersion((v) => v + 1);
          }}
          style={{
            padding: '4px 6px',
            fontSize: '10px',
            background: '#1b1b1b',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Clear Cache
        </button>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {categories.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: category === tab.id ? '#4477ff' : '#1a1a1a',
              color: category === tab.id ? '#fff' : '#888',
              border: '1px solid ' + (category === tab.id ? '#4477ff' : '#2a2a2a'),
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#777' }}>Packs</div>
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr', overflowY: 'auto' }}>
        {packs.length ? packs.map((pack) => packCard(pack)) : <div style={{ color: '#555' }}>No EXT32 packs installed.</div>}
      </div>
      <div style={{ fontSize: '11px', color: '#777' }}>Assets</div>
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', overflowY: 'auto' }}>
        {filteredAssets.length ? filteredAssets.map((entry) => assetCard(entry)) : <div style={{ color: '#555' }}>No assets for this category.</div>}
      </div>
    </div>
  );
}
