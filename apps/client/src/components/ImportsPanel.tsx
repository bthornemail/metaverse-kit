import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { Ext32Pack, Ext32Assets } from '@metaverse-kit/ext32';
import { AssetPreview, clearPreviewCache } from './AssetPreview';

type AssetEntry = {
  id: string;
  packId: string;
  packLabel: string;
  role?: string;
  type: string;
  ref: string;
};

type DragPayload = {
  mode: 'pack' | 'asset';
  packId: string;
  packLabel?: string;
  assetType?: string;
  assetRef?: string;
  role?: string;
};

interface ImportsPanelProps {
  packs: Ext32Pack[];
  onImportFiles: (files: FileList) => void;
  onImportUrl: (url: string) => Promise<boolean>;
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
      role,
      type,
      ref,
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

export default function ImportsPanel({ packs, onImportFiles, onImportUrl }: ImportsPanelProps) {
  const [cacheVersion, setCacheVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const dragPayload = (payload: DragPayload) => (event: DragEvent) => {
    event.dataTransfer.setData('application/x-mvk-asset', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'copy';
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: '#eee' }}>Imports</div>
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
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '6px 10px',
          background: '#1d1d1d',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Import Files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".glb,.gltf,.obj,.mtl,.svg,.wav,.mp4"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (!e.target.files?.length) return;
          onImportFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <label style={{ fontSize: '11px', color: '#777' }}>Import via URL (supports gltf-sample:Model@glb)</label>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="https://... or gltf-sample:Box@glb"
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
          onClick={async () => {
            const trimmed = urlValue.trim();
            if (!trimmed) return;
            setUrlError(null);
            setToast(null);
            if (trimmed.startsWith('gltf-sample:') || trimmed.startsWith('gltf-sample://')) {
              const normalized = trimmed.replace('gltf-sample://', '').replace('gltf-sample:', '');
              const match = normalized.match(/^([A-Za-z0-9_-]+)(@(?:glb|gltf|gltf-embedded))?$/);
              if (!match) {
                setUrlError('Invalid gltf-sample format. Use gltf-sample:Model@glb');
                return;
              }
            } else {
              try {
                const parsed = new URL(trimmed);
                if (!/^https?:$/.test(parsed.protocol)) {
                  setUrlError('Only http/https URLs are supported.');
                  return;
                }
              } catch {
                setUrlError('Invalid URL format.');
                return;
              }
            }
            setIsImporting(true);
            const ok = await onImportUrl(trimmed);
            if (!ok) {
              setUrlError('Failed to import URL. Check the address or sample name.');
            } else {
              setUrlValue('');
              setToast('Import completed.');
              setTimeout(() => setToast(null), 2000);
            }
            setIsImporting(false);
          }}
          style={{
            padding: '6px 10px',
            background: '#1d1d1d',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {isImporting ? 'Importing...' : 'Import'}
        </button>
      </div>
      {urlError ? <div style={{ color: '#ff8f8f', fontSize: '11px' }}>{urlError}</div> : null}
      {toast ? <div style={{ color: '#9fe3b0', fontSize: '11px' }}>{toast}</div> : null}
      <div style={{ fontSize: '11px', color: '#777' }}>Packs</div>
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr', overflowY: 'auto' }}>
        {packs.length ? (
          packs.map((pack) => (
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
          ))
        ) : (
          <div style={{ color: '#555' }}>No imports yet.</div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#777' }}>Assets</div>
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', overflowY: 'auto' }}>
        {assetEntries.length ? (
          assetEntries.map((entry) => (
            <div
              key={`${entry.packId}:${entry.type}:${entry.ref}:${cacheVersion}`}
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
            </div>
          ))
        ) : (
          <div style={{ color: '#555' }}>No assets.</div>
        )}
      </div>
    </div>
  );
}
