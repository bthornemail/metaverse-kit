import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { TileState, NodeState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';
import { computeRenderState, hasIsolate } from '../rendering/narrative';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Texture, VideoTexture } from 'three';
import { Suspense, useEffect, useMemo } from 'react';

interface Canvas3DProps {
  tileState: TileState;
}

export default function Canvas3D({ tileState }: Canvas3DProps) {
  const nodes = getLiveNodes(tileState);
  const isolateActive = hasIsolate(nodes);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 60 }}>
        <OrbitControls enablePan enableZoom enableRotate makeDefault />
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 100]} intensity={0.7} />
        <Suspense fallback={null}>
          {nodes.map((node) => (
            <NodeMesh key={node.node_id} node={node} isolateActive={isolateActive} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

function NodeMesh({ node, isolateActive }: { node: NodeState; isolateActive: boolean }) {
  const renderState = computeRenderState(node, isolateActive);
  const [x, y, z] = node.transform.position;
  const [sx, sy, sz] = node.transform.scale;
  const color = (node.properties.color as string) || '#ffffff';
  const pos: [number, number, number] = [
    x + renderState.offset[0],
    y + renderState.offset[1],
    z + renderState.offset[2],
  ];
  const scale: [number, number, number] = [
    sx * renderState.scale,
    sy * renderState.scale,
    sz * renderState.scale,
  ];

  if (node.geometry?.kind === 'glb') {
    return (
      <GlbMesh url={resolveRef(node.geometry.ref)} position={pos} scale={scale} />
    );
  }

  if (node.geometry?.kind === 'obj') {
    const materialRef = node.media?.meta?.material_ref;
    return (
      <ObjMesh
        objUrl={resolveRef(node.geometry.ref)}
        mtlUrl={materialRef ? resolveRef(materialRef) : null}
        position={pos}
        scale={scale}
      />
    );
  }

  if (node.media?.kind === 'mp4') {
    return (
      <VideoPlane
        url={resolveRef(node.media.ref)}
        position={pos}
        scale={[scale[0], scale[1], 1]}
      />
    );
  }

  if (node.media?.kind === 'wav') {
    return (
      <mesh position={pos} scale={scale}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={'#66ccff'} />
      </mesh>
    );
  }

  return (
    <mesh position={pos} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} transparent opacity={renderState.opacity} />
    </mesh>
  );
}

function GlbMesh({
  url,
  position,
  scale,
}: {
  url: string;
  position: [number, number, number];
  scale: [number, number, number];
}) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} position={position} scale={scale} />;
}

function ObjMesh({
  objUrl,
  mtlUrl,
  position,
  scale,
}: {
  objUrl: string;
  mtlUrl: string | null;
  position: [number, number, number];
  scale: [number, number, number];
}) {
  if (mtlUrl) {
    const materials = useLoader(MTLLoader, mtlUrl);
    materials.preload();
    const obj = useLoader(OBJLoader, objUrl, (loader) => {
      loader.setMaterials(materials);
    });
    return <primitive object={obj} position={position} scale={scale} />;
  }

  const obj = useLoader(OBJLoader, objUrl);
  return <primitive object={obj} position={position} scale={scale} />;
}

function VideoPlane({
  url,
  position,
  scale,
}: {
  url: string;
  position: [number, number, number];
  scale: [number, number, number];
}) {
  const texture = useVideoTexture(url);
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function resolveRef(ref: string): string {
  if (ref.startsWith('symbol:')) {
    return symbolToGltf(ref);
  }
  const sample = resolveGltfSample(ref);
  if (sample) return sample;
  if (ref.startsWith('sha256:') || ref.startsWith('blake3:')) {
    return `/object/${encodeURIComponent(ref)}`;
  }
  return ref;
}

function symbolToGltf(ref: string): string {
  const name = ref.replace('symbol:', '');
  const mapping: Record<string, string> = {
    law: 'gltf-sample:BoxAnimated@glb',
    wisdom: 'gltf-sample:Avocado@glb',
    identity: 'gltf-sample:DamagedHelmet@glb',
    witness: 'gltf-sample:Fox@glb',
    boundary: 'gltf-sample:Box@glb',
    gate: 'gltf-sample:BoxTextured@glb',
    tower: 'gltf-sample:Box@glb',
    flood: 'gltf-sample:WaterBottle@glb',
    ark: 'gltf-sample:Box@glb',
    conversation: 'gltf-sample:OrientationTest@glb',
    alignment: 'gltf-sample:BoxAnimated@glb',
  };
  return resolveGltfSample(mapping[name] ?? 'gltf-sample:Box@glb') ?? 'gltf-sample:Box@glb';
}

function resolveGltfSample(ref: string): string | null {
  if (!ref.startsWith('gltf-sample:') && !ref.startsWith('gltf-sample://')) return null;
  const raw = ref.replace('gltf-sample://', '').replace('gltf-sample:', '');
  if (!raw) return null;
  const [name, variant] = raw.split('@');
  const flavor = variant || 'glb';
  const base = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
  if (flavor === 'gltf') {
    return `${base}/${name}/glTF/${name}.gltf`;
  }
  if (flavor === 'gltf-embedded') {
    return `${base}/${name}/glTF-Embedded/${name}.gltf`;
  }
  return `${base}/${name}/glTF-Binary/${name}.glb`;
}

function useVideoTexture(url: string): Texture {
  const video = useMemo(() => {
    const el = document.createElement('video');
    el.src = url;
    el.crossOrigin = 'anonymous';
    el.loop = true;
    el.muted = true;
    el.playsInline = true;
    return el;
  }, [url]);

  useEffect(() => {
    void video.play();
    return () => {
      video.pause();
      video.src = '';
    };
  }, [video]);

  return useMemo(() => {
    const texture = new VideoTexture(video);
    texture.needsUpdate = true;
    return texture;
  }, [video]);
}
