import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { createStarterTopology } from '../../engine/topology';
import type { TopologyNode } from '../../engine/topology';
import { useSimulationStore } from '../../store/useSimulationStore';
import { RouterMesh } from '../objects/RouterMesh';
import { CoreSwitchMesh } from '../objects/CoreSwitchMesh';
import { AccessSwitchMesh } from '../objects/AccessSwitchMesh';
import { ServerRackMesh } from '../objects/ServerRackMesh';
import { ServerBladeMesh } from '../objects/ServerBladeMesh';
import { NetworkCableMesh } from '../objects/NetworkCableMesh';
import { DataCenterEnvironment } from '../objects/DataCenterEnvironment';
import { NodeInspector } from '../ui/NodeInspector';
import { RefreshCw, Video } from 'lucide-react';

export type CameraPreset = 'front' | 'rear' | 'left' | 'right' | 'top' | 'isometric' | 'cinematic';

interface PresetConfig {
  id: CameraPreset;
  label: string;
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<CameraPreset, PresetConfig> = {
  front: {
    id: 'front',
    label: 'Front',
    pos: [0, 1.8, 6.2],
    target: [0, 1.45, 1.5],
  },
  rear: {
    id: 'rear',
    label: 'Rear',
    pos: [0, 2.0, -0.6],
    target: [0, 1.45, 1.5],
  },
  left: {
    id: 'left',
    label: 'Left',
    pos: [-7.2, 1.9, 1.5],
    target: [0, 1.45, 1.5],
  },
  right: {
    id: 'right',
    label: 'Right',
    pos: [7.2, 1.9, 1.5],
    target: [0, 1.45, 1.5],
  },
  top: {
    id: 'top',
    label: 'Top',
    pos: [0, 9.6, 0],
    target: [0, 0, 0],
  },
  isometric: {
    id: 'isometric',
    label: 'Isometric',
    pos: [5.4, 4.6, 7.8],
    target: [0, 1.45, 1.5],
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    pos: [0.8, 4.0, 8.6],
    target: [0, 1.5, 0.5],
  },
};

// Smooth Camera Controller Component inside Canvas
const CameraController: React.FC<{
  activePreset: CameraPreset | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onTransitionComplete: () => void;
}> = ({ activePreset, controlsRef, onTransitionComplete }) => {
  const { camera } = useThree();
  const isTransitioningRef = useRef(false);
  const targetPosRef = useRef(new THREE.Vector3());
  const targetLookAtRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (activePreset) {
      const cfg = CAMERA_PRESETS[activePreset];
      targetPosRef.current.set(...cfg.pos);
      targetLookAtRef.current.set(...cfg.target);
      isTransitioningRef.current = true;
    }
  }, [activePreset]);

  useFrame(() => {
    if (!isTransitioningRef.current) return;

    camera.position.lerp(targetPosRef.current, 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAtRef.current, 0.08);
      controlsRef.current.update();
    }

    if (
      camera.position.distanceTo(targetPosRef.current) < 0.04 &&
      (!controlsRef.current ||
        controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.04)
    ) {
      camera.position.copy(targetPosRef.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAtRef.current);
        controlsRef.current.update();
      }
      isTransitioningRef.current = false;
      onTransitionComplete();
    }
  });

  return null;
};

export const DataCenterViewport: React.FC = () => {
  const { selectedNodeId, selectedLinkId, setSelectedNodeId, setSelectedLinkId } =
    useSimulationStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [activePreset, setActivePreset] = useState<CameraPreset | null>('isometric');

  // Deterministic PRD v2.0 Starter Topology (20 Nodes, 15 Links)
  const topology = useMemo(() => createStarterTopology(), []);

  // Quick lookup dictionary for node coordinates and metadata
  const nodeMap = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    for (const node of topology.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [topology]);

  // Selected node object
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  // Filter hardware tiers for dedicated 3D object rendering
  const routerNode = useMemo(() => topology.nodes.find((n) => n.type === 'router'), [topology]);
  const coreSwitchNode = useMemo(
    () => topology.nodes.find((n) => n.type === 'core_switch'),
    [topology]
  );
  const accessSwitchNodes = useMemo(
    () => topology.nodes.filter((n) => n.type === 'access_switch'),
    [topology]
  );
  const rackNodes = useMemo(() => topology.nodes.filter((n) => n.type === 'rack'), [topology]);
  const serverNodes = useMemo(() => topology.nodes.filter((n) => n.type === 'server'), [topology]);

  // Reset camera view to default orientation
  const handleResetCamera = () => {
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setActivePreset('isometric');
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleSelectPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
  };

  return (
    <div className="relative w-full h-full min-h-[540px] bg-[#070b16] rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl">
      {/* Viewport Top Header & Badges */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-700/60 backdrop-blur-md text-xs font-mono text-cyan-400 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="hidden sm:inline">VIEWPORT:</span> AAA 3D LIVING DATA CENTER
        </div>
        {selectedNodeId && (
          <div className="px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-xs font-mono text-cyan-300 pointer-events-auto flex items-center gap-2">
            <span>SELECTED: {selectedNodeId.toUpperCase()}</span>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="hover:text-white"
              title="Clear Selection"
            >
              ✕
            </button>
          </div>
        )}
        {selectedLinkId && (
          <div className="px-3 py-1 rounded-md bg-violet-950/80 border border-violet-500/40 text-xs font-mono text-violet-300 pointer-events-auto flex items-center gap-2">
            <span>LINK: {selectedLinkId.toUpperCase()}</span>
            <button
              onClick={() => setSelectedLinkId(null)}
              className="hover:text-white"
              title="Clear Link Selection"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Top Right Camera Presets Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 flex-wrap justify-end">
        {/* Camera Preset Toolbar */}
        <div className="flex items-center gap-1 bg-slate-950/85 border border-slate-800/80 p-1 rounded-lg backdrop-blur-md text-[10px] font-mono">
          <div className="flex items-center gap-1 px-1.5 py-0.5 text-slate-400 border-r border-slate-800/70 mr-0.5">
            <Video className="w-3 h-3 text-cyan-400" />
            <span className="hidden md:inline">CAM</span>
          </div>
          {(['front', 'rear', 'left', 'right', 'top', 'isometric', 'cinematic'] as const).map(
            (presetKey) => {
              const cfg = CAMERA_PRESETS[presetKey];
              const isActive = activePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  onClick={() => handleSelectPreset(presetKey)}
                  className={`px-2 py-0.5 rounded transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                  title={`${cfg.label} View`}
                >
                  {cfg.label.toUpperCase()}
                </button>
              );
            }
          )}
        </div>

        <button
          onClick={handleResetCamera}
          title="Reset Camera & Selection"
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Node Inspector HUD */}
      {selectedNode && (
        <NodeInspector
          selectedNode={selectedNode}
          allNodes={topology.nodes}
          allLinks={topology.links}
          onClose={() => setSelectedNodeId(null)}
          onSelectNode={(id) => setSelectedNodeId(id)}
        />
      )}

      {/* R3F WebGL Canvas — Persistent Single Instance */}
      <Canvas
        camera={{ position: [5.4, 4.6, 7.8], fov: 45, near: 0.1, far: 100 }}
        shadows="soft"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerMissed={() => {
          setSelectedNodeId(null);
          setSelectedLinkId(null);
        }}
      >
        <color attach="background" args={['#080d1a']} />
        <fog attach="fog" args={['#080d1a', 22, 48]} />

        {/* Ambient & High-Clarity Studio Directional Lighting Rig */}
        <ambientLight intensity={1.1} color="#f8fafc" />

        {/* Frontal Aisle Direct Illumination (Directly illuminates server front faceplates) */}
        <directionalLight position={[0, 4.8, 6.8]} intensity={1.8} color="#ffffff" />

        {/* Key Lighting from Front-Right with Soft Shadow Maps */}
        <directionalLight
          position={[9, 14, 10]}
          intensity={1.8}
          color="#ffffff"
          castShadow
          shadow-bias={-0.0001}
          shadow-mapSize={[2048, 2048]}
        />

        {/* Cool Fill Light from Front-Left */}
        <directionalLight position={[-10, 10, 8]} intensity={1.1} color="#e2e8f0" />

        {/* Crisp Rim Silhouette Light from Rear */}
        <directionalLight position={[0, 10, -8]} intensity={1.2} color="#38bdf8" />

        {/* Overhead Aisle Downlight */}
        <pointLight position={[0, 4.6, 1.5]} intensity={1.2} color="#e0f2fe" distance={16} />

        {/* Distribution Downlight */}
        <pointLight position={[0, 4.6, -2.5]} intensity={1.0} color="#f1f5f9" distance={14} />

        {/* Under-Rack Floor Bounce Fill */}
        <pointLight position={[0, 0.8, 2.5]} intensity={0.5} color="#64748b" distance={12} />

        <Suspense fallback={null}>
          {/* Focused Equipment Pod Grid Floor */}
          <Grid
            position={[0, -0.015, -0.3]}
            args={[24, 20]}
            cellSize={0.6}
            cellThickness={0.7}
            cellColor="#1a2333"
            sectionSize={2.4}
            sectionThickness={1.1}
            sectionColor="#334155"
            fadeDistance={26}
            fadeStrength={1.5}
          />

          {/* Architectural Data Center Room, Walls, Ceiling, Cable Ladder & Floor Tiles */}
          <DataCenterEnvironment />

          {/* 1. Edge Router Node (Mounted in 42U Gateway Rack) */}
          {routerNode && (
            <RouterMesh
              key={routerNode.id}
              node={routerNode}
              isSelected={selectedNodeId === routerNode.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          )}

          {/* 2. Core Distribution Switch Node (Mounted in 42U Director Rack) */}
          {coreSwitchNode && (
            <CoreSwitchMesh
              key={coreSwitchNode.id}
              node={coreSwitchNode}
              isSelected={selectedNodeId === coreSwitchNode.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          )}

          {/* 3. Access Switches (Mounted in Pod Distribution Racks) */}
          {accessSwitchNodes.map((asNode) => (
            <AccessSwitchMesh
              key={asNode.id}
              node={asNode}
              isSelected={selectedNodeId === asNode.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          ))}

          {/* 4. Physical Racks (4 Spatial Grouping Enclosures) */}
          {rackNodes.map((rackNode) => (
            <ServerRackMesh
              key={rackNode.id}
              node={rackNode}
              isSelected={selectedNodeId === rackNode.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          ))}

          {/* 5. Server Blades (12 Compute Nodes mounted in racks) */}
          {serverNodes.map((srvNode) => (
            <ServerBladeMesh
              key={srvNode.id}
              node={srvNode}
              isSelected={selectedNodeId === srvNode.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          ))}

          {/* 6. Network Links (15 Logical Bidirectional Connections) */}
          {topology.links.map((link) => {
            const srcNode = nodeMap.get(link.source_id || link.sourceId || '');
            const tgtNode = nodeMap.get(link.target_id || link.targetId || '');

            if (!srcNode?.position || !tgtNode?.position) return null;

            const isLinkHighlighted =
              selectedLinkId === link.id ||
              selectedNodeId === srcNode.id ||
              selectedNodeId === tgtNode.id;

            return (
              <NetworkCableMesh
                key={link.id}
                link={link}
                sourcePos={srcNode.position}
                targetPos={tgtNode.position}
                isHighlighted={isLinkHighlighted}
                onSelect={(id) => setSelectedLinkId(id)}
              />
            );
          })}

          {/* Smooth Camera Preset Transition Controller */}
          <CameraController
            activePreset={activePreset}
            controlsRef={controlsRef}
            onTransitionComplete={() => {}}
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={2.5}
          maxDistance={25.0}
          target={[0, 1.45, 1.5]}
          onStart={() => {
            // Disengage preset animation when user manually orbits/pans
            setActivePreset(null);
          }}
        />
      </Canvas>

      {/* Bottom Viewport Legend & Navigation Help */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-400 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800/60 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            Gateway Router
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
            Core Director
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            Pod Access
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            12 Server Blades
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-500" />4 Server Racks
          </span>
        </div>
        <div className="text-[10px] text-slate-400 hidden lg:block">
          Presets: Front • Rear • Left • Right • Top • Iso • Cinema | Orbit: Drag • Zoom: Scroll
        </div>
      </div>
    </div>
  );
};
