import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { TileState, NodeState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';
import { computeRenderState, hasIsolate } from '../rendering/narrative';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Texture, VideoTexture } from 'three';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { resolveExt32Assets } from '../ext32';
import { resolveRef } from '../refs';

interface Canvas3DProps {
  tileState: TileState;
  cameraState?: { position: [number, number, number]; target: [number, number, number] };
  onCameraStateChange?: (state: { position: [number, number, number]; target: [number, number, number] }) => void;
  wireframe?: boolean;
}

export default function Canvas3D({ tileState, cameraState, onCameraStateChange, wireframe = false }: Canvas3DProps) {
  const nodes = getLiveNodes(tileState);
  const isolateActive = hasIsolate(nodes);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 60 }}>
        <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault />
        <CameraSync controlsRef={controlsRef} cameraState={cameraState} onCameraStateChange={onCameraStateChange} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 100]} intensity={0.7} />
        {wireframe ? <gridHelper args={[500, 50, '#222', '#111']} /> : null}
        {wireframe ? <axesHelper args={[80]} /> : null}
        <Suspense fallback={null}>
          {nodes.map((node) => (
            <NodeMesh key={node.node_id} node={node} isolateActive={isolateActive} wireframe={wireframe} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

function CameraSync({
  controlsRef,
  cameraState,
  onCameraStateChange,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  cameraState?: { position: [number, number, number]; target: [number, number, number] };
  onCameraStateChange?: (state: { position: [number, number, number]; target: [number, number, number] }) => void;
}) {
  const { camera } = useThree();
  const lastSent = useRef(0);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handler = () => {
      if (!onCameraStateChange) return;
      const now = performance.now();
      if (now - lastSent.current < 100) return;
      lastSent.current = now;
      onCameraStateChange({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      });
    };
    controls.addEventListener('change', handler);
    return () => controls.removeEventListener('change', handler);
  }, [camera, controlsRef, onCameraStateChange]);

  useEffect(() => {
    if (!cameraState) return;
    const controls = controlsRef.current;
    if (!controls) return;
    camera.position.set(...cameraState.position);
    controls.target.set(...cameraState.target);
    controls.update();
  }, [camera, cameraState, controlsRef]);

  return null;
}

function NodeMesh({ node, isolateActive, wireframe }: { node: NodeState; isolateActive: boolean; wireframe: boolean }) {
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
  const uniformScale = Math.max(scale[0], scale[1], scale[2], 1);
  const depthScale = Math.max(20, Math.min(scale[0], scale[1]) * 0.4);
  const ext32Pack = node.properties?.ext32_pack as string | undefined;
  const ext32Features = Array.isArray(node.properties?.ext32_features)
    ? (node.properties?.ext32_features as string[])
    : [];
  const role = (node.properties?.semantic_role as string | undefined) ?? (node.properties?.label as string | undefined);
  const ext32Assets = ext32Pack ? resolveExt32Assets(ext32Pack, role, ext32Features) : null;

  if (node.geometry?.kind === 'glb' || ext32Assets?.glb) {
    const ref = node.geometry?.kind === 'glb' ? node.geometry.ref : ext32Assets?.glb;
    const url = useResolvedRef(ref);
    if (!url) return null;
    const modelNodes = Array.isArray(node.properties?.model_nodes) ? (node.properties?.model_nodes as string[]) : null;
    return (
      <GlbMesh
        url={url}
        position={pos}
        scale={[uniformScale, uniformScale, uniformScale]}
        wireframe={wireframe}
        onlyNodes={modelNodes ?? undefined}
      />
    );
  }

  if (node.geometry?.kind === 'obj' || ext32Assets?.obj) {
    const ref = node.geometry?.kind === 'obj' ? node.geometry.ref : ext32Assets?.obj;
    const objUrl = useResolvedRef(ref);
    if (!objUrl) return null;
    const materialRef = node.media?.meta?.material_ref ?? ext32Assets?.mtl;
    const mtlUrl = useResolvedRef(materialRef ?? undefined);
    return (
      <ObjMesh
        objUrl={objUrl}
        mtlUrl={mtlUrl}
        position={pos}
        scale={[uniformScale, uniformScale, uniformScale]}
        wireframe={wireframe}
      />
    );
  }

  if (node.media?.kind === 'mp4' || ext32Assets?.mp4) {
    const ref = node.media?.kind === 'mp4' ? node.media.ref : ext32Assets?.mp4;
    const url = useResolvedRef(ref);
    if (!url) return null;
    return (
      <VideoPlane
        url={url}
        position={pos}
        scale={[scale[0], scale[1], 1]}
        wireframe={wireframe}
      />
    );
  }

  if (node.media?.kind === 'wav' || ext32Assets?.wav) {
    return (
      <mesh position={pos} scale={scale}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={'#66ccff'} />
      </mesh>
    );
  }

  return (
    <mesh position={pos} scale={[scale[0], scale[1], depthScale]}>
      <boxGeometry args={[1, 1, 1]} />
      {wireframe ? (
        <meshBasicMaterial color={'#66ccff'} wireframe />
      ) : (
        <meshStandardMaterial color={color} transparent opacity={renderState.opacity} />
      )}
    </mesh>
  );
}

function GlbMesh({
  url,
  position,
  scale,
  wireframe,
  onlyNodes,
}: {
  url: string;
  position: [number, number, number];
  scale: [number, number, number];
  wireframe: boolean;
  onlyNodes?: string[];
}) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => clone(gltf.scene), [gltf]);

  useEffect(() => {
    applyWireframe(scene, wireframe);
    if (onlyNodes?.length) {
      const keep = new Set<string>(onlyNodes);
      scene.traverse((child: any) => {
        if (!child?.name) return;
        if (keep.has(child.name)) {
          let cur: any = child;
          while (cur) {
            (cur as { visible?: boolean }).visible = true;
            cur = cur.parent;
          }
        }
      });
      scene.traverse((child: any) => {
        if (!child) return;
        if ((child as { visible?: boolean }).visible === true) return;
        (child as { visible?: boolean }).visible = false;
      });
    }
  }, [scene, wireframe, onlyNodes]);
  return <primitive object={scene} position={position} scale={scale} />;
}

function ObjMesh({
  objUrl,
  mtlUrl,
  position,
  scale,
  wireframe,
}: {
  objUrl: string;
  mtlUrl: string | null;
  position: [number, number, number];
  scale: [number, number, number];
  wireframe: boolean;
}) {
  if (mtlUrl) {
    const materials = useLoader(MTLLoader, mtlUrl);
    materials.preload();
    const obj = useLoader(OBJLoader, objUrl, (loader) => {
      loader.setMaterials(materials);
    });
    useEffect(() => {
      applyWireframe(obj, wireframe);
    }, [obj, wireframe]);
    return <primitive object={obj} position={position} scale={scale} />;
  }

  const obj = useLoader(OBJLoader, objUrl);
  useEffect(() => {
    applyWireframe(obj, wireframe);
  }, [obj, wireframe]);
  return <primitive object={obj} position={position} scale={scale} />;
}

function VideoPlane({
  url,
  position,
  scale,
  wireframe,
}: {
  url: string;
  position: [number, number, number];
  scale: [number, number, number];
  wireframe: boolean;
}) {
  const texture = useVideoTexture(url);
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      {wireframe ? (
        <meshBasicMaterial color={'#66ccff'} wireframe />
      ) : (
        <meshStandardMaterial map={texture} toneMapped={false} />
      )}
    </mesh>
  );
}

function resolveMeshRef(ref: string, onResolve?: () => void): string | null {
  if (ref.startsWith('symbol:')) {
    return symbolToGltf(ref);
  }
  const sample = resolveGltfSample(ref);
  if (sample) return sample;
  return resolveRef(ref, onResolve);
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

function useResolvedRef(ref?: string): string | null {
  const [resolved, setResolved] = useState<string | null>(() => (ref ? resolveMeshRef(ref) : null));

  useEffect(() => {
    if (!ref) {
      setResolved(null);
      return;
    }
    const url = resolveMeshRef(ref, () => setResolved(resolveMeshRef(ref)));
    setResolved(url);
  }, [ref]);

  return resolved;
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

function applyWireframe(object: { traverse: (cb: (child: any) => void) => void }, enabled: boolean) {
  object.traverse((child: any) => {
    if (!child || !('material' in child)) return;
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => {
        if (mat && typeof mat.wireframe === 'boolean') mat.wireframe = enabled;
      });
      return;
    }
    if (material && typeof material.wireframe === 'boolean') {
      material.wireframe = enabled;
    }
  });
}
