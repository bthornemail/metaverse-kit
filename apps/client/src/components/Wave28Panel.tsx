import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import {
  type Wave27Residual,
  type Wave28PolyDecomp,
  type Wave28SignalPolyProjection,
} from '../wave28/validators';
import {
  clearWave28PanelState,
  ingestWave28PanelArtifact,
  initialWave28PanelState,
} from '../wave28/panel-model';

type LoadedItem = {
  name: string;
  digest: string;
};

type Wave28PanelProps = {
  projectionPathHint?: string;
};

async function readFileJson(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

async function readUrlJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  return await res.json();
}

function badge(loaded: boolean): CSSProperties {
  return {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '999px',
    border: '1px solid ' + (loaded ? '#2f6d45' : '#4a3a3a'),
    background: loaded ? '#173723' : '#2b1e1e',
    color: loaded ? '#9fe3b0' : '#f3b4b4',
  };
}

function Row({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{ color: '#777', minWidth: '120px' }}>{label}</div>
      <div style={{ color: '#ddd', wordBreak: 'break-all', flex: 1 }}>{value}</div>
      {copyable ? (
        <button
          onClick={() => void navigator.clipboard.writeText(value)}
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            background: '#1d1d1d',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Copy
        </button>
      ) : null}
    </div>
  );
}

export default function Wave28Panel({ projectionPathHint }: Wave28PanelProps) {
  const initial = useMemo(() => initialWave28PanelState(), []);
  const [projection, setProjection] = useState<Wave28SignalPolyProjection | null>(initial.projection);
  const [projectionName, setProjectionName] = useState<string>(initial.projectionName);
  const [decomp, setDecomp] = useState<Wave28PolyDecomp | null>(initial.decomp);
  const [decompName, setDecompName] = useState<string>(initial.decompName);
  const [residual, setResidual] = useState<Wave27Residual | null>(initial.residual);
  const [residualName, setResidualName] = useState<string>(initial.residualName);
  const [status, setStatus] = useState<string>(initial.status);
  const [error, setError] = useState<string | null>(initial.error);
  const [urlValue, setUrlValue] = useState('');
  const [activeTab, setActiveTab] = useState<'signal' | 'decompose' | 'residual'>('signal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadedByDigest = useMemo(() => {
    const map = new Map<string, LoadedItem>();
    if (projection) map.set(projection.digest, { digest: projection.digest, name: projectionName || 'projection' });
    if (decomp) map.set(decomp.digest, { digest: decomp.digest, name: decompName || 'decomposition' });
    if (residual) map.set(residual.digest, { digest: residual.digest, name: residualName || 'residual' });
    return map;
  }, [projection, projectionName, decomp, decompName, residual, residualName]);

  async function ingestArtifact(data: unknown, sourceName: string) {
    const next = await ingestWave28PanelArtifact(
      {
        projection,
        projectionName,
        decomp,
        decompName,
        residual,
        residualName,
        status,
        error,
        activeTab,
      },
      data,
      sourceName
    );
    setProjection(next.projection);
    setProjectionName(next.projectionName);
    setDecomp(next.decomp);
    setDecompName(next.decompName);
    setResidual(next.residual);
    setResidualName(next.residualName);
    setStatus(next.status);
    setError(next.error);
    setActiveTab(next.activeTab);
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      try {
        const parsed = await readFileJson(file);
        await ingestArtifact(parsed, file.name);
      } catch (err: any) {
        setError(`Invalid artifact (${file.name}): ${String(err?.message ?? err)}`);
        setStatus('Validation failed');
      }
    }
  }

  return (
    <div
      data-testid="wave28-panel"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'clamp(260px, 24vw, 360px)',
        background: '#0b0b0b',
        borderRight: '1px solid #222',
        padding: '14px',
        color: '#ccc',
        fontFamily: 'monospace',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: '#eee' }}>Signal Poly</div>
        <button
          onClick={() => {
            const cleared = clearWave28PanelState();
            setProjection(cleared.projection);
            setProjectionName(cleared.projectionName);
            setDecomp(cleared.decomp);
            setDecompName(cleared.decompName);
            setResidual(cleared.residual);
            setResidualName(cleared.residualName);
            setStatus(cleared.status);
            setError(cleared.error);
            setActiveTab(cleared.activeTab);
          }}
          style={{
            padding: '4px 8px',
            background: '#1d1d1d',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ color: '#888' }}>{status}</div>
      {projectionPathHint ? <div style={{ color: '#666' }}>Hint: {projectionPathHint}</div> : null}
      {error ? <div style={{ color: '#ff8f8f', border: '1px solid #4a1f1f', background: '#210f0f', borderRadius: '6px', padding: '8px' }}>{error}</div> : null}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          data-testid="wave28-load-file"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '6px 10px',
            background: '#1d1d1d',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Load JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (!e.target.files?.length) return;
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          if (!e.dataTransfer.files?.length) return;
          void handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: '1px dashed #333',
          borderRadius: '8px',
          padding: '10px',
          color: '#666',
        }}
      >
        Drag & drop artifact JSON files
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="https://.../artifact.json"
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
          data-testid="wave28-load-url"
          onClick={async () => {
            const u = urlValue.trim();
            if (!u) return;
            try {
              const parsed = await readUrlJson(u);
              await ingestArtifact(parsed, u);
            } catch (err: any) {
              setError(`Invalid artifact (${u}): ${String(err?.message ?? err)}`);
              setStatus('Validation failed');
            }
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
          Load URL
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          data-testid="wave28-tab-signal-poly"
          onClick={() => setActiveTab('signal')}
          style={{
            padding: '4px 8px',
            background: activeTab === 'signal' ? '#4f8cff' : '#1d1d1d',
            color: activeTab === 'signal' ? '#fff' : '#aaa',
            border: '1px solid ' + (activeTab === 'signal' ? '#4f8cff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Signal Poly
        </button>
        <button
          data-testid="wave28-tab-decomposition"
          onClick={() => setActiveTab('decompose')}
          style={{
            padding: '4px 8px',
            background: activeTab === 'decompose' ? '#4f8cff' : '#1d1d1d',
            color: activeTab === 'decompose' ? '#fff' : '#aaa',
            border: '1px solid ' + (activeTab === 'decompose' ? '#4f8cff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Decomposition
        </button>
        <button
          data-testid="wave28-tab-residual"
          onClick={() => setActiveTab('residual')}
          style={{
            padding: '4px 8px',
            background: activeTab === 'residual' ? '#4f8cff' : '#1d1d1d',
            color: activeTab === 'residual' ? '#fff' : '#aaa',
            border: '1px solid ' + (activeTab === 'residual' ? '#4f8cff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Residual
        </button>
      </div>

      <div style={{ overflowY: 'auto', display: 'grid', gap: '8px', paddingRight: '4px' }}>
        {activeTab === 'signal' ? (
          projection ? (
            <>
              <Row label="source" value={projectionName || 'unknown'} />
              <Row label="v" value={projection.v} />
              <Row label="authority" value={projection.authority} />
              <Row label="digest" value={projection.digest} copyable />
              <Row label="norm_id" value={projection.norm_id} />
              <Row label="source_type" value={projection.source_type} />
              <Row label="source_digest" value={projection.source_digest} copyable />
              <Row label="input_poly" value={projection.input_poly} />
              <div style={{ borderTop: '1px solid #222', paddingTop: '8px' }}>
                <div style={{ color: '#888', marginBottom: '6px' }}>Cross-links</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ color: '#aaa', wordBreak: 'break-all', flex: 1 }}>poly_decomp_digest: {projection.poly_decomp_digest || '<none>'}</div>
                  <div style={badge(!!projection.poly_decomp_digest && loadedByDigest.has(projection.poly_decomp_digest))}>
                    {!!projection.poly_decomp_digest && loadedByDigest.has(projection.poly_decomp_digest) ? 'loaded' : 'missing'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#666' }}>Load `wave28.signal_poly_projection.v0` to view Signal Poly data.</div>
          )
        ) : null}

        {activeTab === 'decompose' ? (
          decomp ? (
            <>
              <Row label="source" value={decompName || 'unknown'} />
              <Row label="v" value={decomp.v} />
              <Row label="authority" value={decomp.authority} />
              <Row label="digest" value={decomp.digest} copyable />
              <Row label="basis_digest" value={decomp.basis_digest} copyable />
              <Row label="closed_config_digest" value={decomp.closed_config_digest} copyable />
              <Row label="norm_id" value={decomp.norm_id} />
              <Row label="input_poly" value={decomp.input_poly} />
              <Row label="residual_poly" value={decomp.residual_poly} />
              <div style={{ borderTop: '1px solid #222', paddingTop: '8px' }}>
                <div style={{ color: '#888', marginBottom: '6px' }}>coeff_vector</div>
                <div style={{ display: 'grid', gap: '4px' }}>
                  {decomp.coeff_vector.map((bit, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ color: '#777' }}>{i}</div>
                      <div style={{ color: '#ddd' }}>{bit}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#666' }}>Load `wave28.poly_decomp.v0` to view decomposition details.</div>
          )
        ) : null}

        {activeTab === 'residual' ? (
          residual ? (
            <>
              <Row label="source" value={residualName || 'unknown'} />
              <Row label="v" value={residual.v} />
              <Row label="authority" value={residual.authority} />
              <Row label="digest" value={residual.digest} copyable />
              <Row label="turn_clock_id" value={residual.turn_clock_id} />
              <Row label="turn_project_id" value={residual.turn_project_id} />
              <Row label="reflect_id" value={residual.reflect_id} />
              <Row label="fail_k" value={residual.fail_k} />
              <Row label="p_before" value={residual.p_before} />
              <Row label="candidate_a" value={residual.candidate_a} />
              <Row label="candidate_b" value={residual.candidate_b} />
              <Row label="ring_fingerprint" value={residual.ring_fingerprint} copyable />
            </>
          ) : (
            <div style={{ color: '#666' }}>Load `wave27.pointer_sync_residual.v0` to view residual diagnostics.</div>
          )
        ) : null}
      </div>
    </div>
  );
}
