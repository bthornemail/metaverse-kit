import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas as R3FCanvas, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveRef } from '../refs';

const waveformCache = new Map<string, Float32Array>();
const videoFrameCache = new Map<string, string>();

export function clearPreviewCache(prefix?: string) {
  if (!prefix) {
    waveformCache.clear();
    videoFrameCache.clear();
    return;
  }
  for (const key of waveformCache.keys()) {
    if (key.startsWith(`${prefix}:`)) waveformCache.delete(key);
  }
  for (const key of videoFrameCache.keys()) {
    if (key.startsWith(`${prefix}:`)) videoFrameCache.delete(key);
  }
}

function SvgPreview({ refUrl }: { refUrl: string }) {
  const url = useResolvedRef(refUrl);
  if (!url) return null;
  return (
    <img
      src={url}
      style={{ width: '100%', height: '80px', objectFit: 'contain', background: '#0b0b0b', borderRadius: '6px' }}
    />
  );
}

function VideoPreview({ refUrl, cacheKey }: { refUrl: string; cacheKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cachedFrame, setCachedFrame] = useState<string | null>(null);
  const url = useResolvedRef(refUrl);

  useEffect(() => {
    const cached = videoFrameCache.get(cacheKey);
    if (cached) {
      setCachedFrame(cached);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (cachedFrame || !url) return;
    if (!url) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('loadeddata', () => {
      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      videoFrameCache.set(cacheKey, dataUrl);
      setCachedFrame(dataUrl);
    });
    video.addEventListener('error', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    video.load();
    return () => {
      video.pause();
      video.src = '';
    };
  }, [refUrl, cacheKey, cachedFrame, url]);

  if (cachedFrame) {
    return (
      <img
        src={cachedFrame}
        style={{ width: '100%', height: '80px', objectFit: 'cover', background: '#0b0b0b', borderRadius: '6px' }}
      />
    );
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height: '80px', background: '#0b0b0b', borderRadius: '6px' }} />;
}

function drawWaveform(ctx: CanvasRenderingContext2D, samples: Float32Array) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#66ccff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = Math.max(1, Math.floor(samples.length / width));
  for (let x = 0; x < width; x += 1) {
    const slice = samples.subarray(x * step, (x + 1) * step);
    let min = 1;
    let max = -1;
    for (const v of slice) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = (1 - (max + 1) / 2) * height;
    const y2 = (1 - (min + 1) / 2) * height;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
}

function WavePreview({ refUrl, cacheKey }: { refUrl: string; cacheKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const url = useResolvedRef(refUrl);

  useEffect(() => {
    const cached = waveformCache.get(cacheKey);
    if (cached) {
      setSamples(cached);
      return;
    }
    if (!url) return;
    let cancelled = false;
    async function load() {
      try {
        const ctx = new AudioContext();
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const audio = await ctx.decodeAudioData(buffer);
        if (!cancelled) {
          const channel = audio.getChannelData(0);
          waveformCache.set(cacheKey, channel);
          setSamples(channel);
        }
        ctx.close();
      } catch {
        if (!cancelled) setSamples(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refUrl, cacheKey, url]);

  useEffect(() => {
    if (!samples || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 160;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWaveform(ctx, samples);
  }, [samples]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '80px', background: '#0b0b0b', borderRadius: '6px' }} />;
}

function GlbPreview({ refUrl }: { refUrl: string }) {
  const url = useResolvedRef(refUrl);
  if (!url) return null;
  return (
    <div style={{ width: '100%', height: '80px', background: '#0b0b0b', borderRadius: '6px' }}>
      <R3FCanvas camera={{ position: [0, 0, 2.4], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} intensity={0.8} />
        <Suspense fallback={null}>
          <GlbModel url={url} />
        </Suspense>
      </R3FCanvas>
    </div>
  );
}

function GlbModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} scale={[0.8, 0.8, 0.8]} />;
}

export function AssetPreview({
  type,
  refUrl,
  cacheKey,
}: {
  type: string;
  refUrl: string;
  cacheKey: string;
}) {
  if (type === 'svg') return <SvgPreview refUrl={refUrl} />;
  if (type === 'glb') return <GlbPreview refUrl={refUrl} />;
  if (type === 'mp4') return <VideoPreview refUrl={refUrl} cacheKey={cacheKey} />;
  if (type === 'wav') return <WavePreview refUrl={refUrl} cacheKey={cacheKey} />;
  return (
    <div
      style={{
        width: '100%',
        height: '80px',
        background: '#0b0b0b',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#444',
        fontSize: '10px',
        textTransform: 'uppercase',
      }}
    >
      {type}
    </div>
  );
}

function useResolvedRef(ref: string): string | null {
  const [resolved, setResolved] = useState<string | null>(() => resolveRef(ref, () => setResolved(resolveRef(ref))));

  useEffect(() => {
    const url = resolveRef(ref, () => setResolved(resolveRef(ref)));
    setResolved(url);
  }, [ref]);

  return resolved;
}
