import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { ServerRackMesh } from '../objects/ServerRackMesh';
import { NetworkCorePedestal } from '../objects/NetworkCorePedestal';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Box, Layers, RefreshCw } from 'lucide-react';

export const DataCenterViewport: React.FC = () => {
  const { selectedNodeId, setSelectedNodeId } = useSimulationStore();

  const racks = [
    { id: 'rack-01', name: 'Rack A1 (Compute)', pos: [-3.0, 0, 0] as [number, number, number] },
    { id: 'rack-02', name: 'Rack A2 (Compute)', pos: [-1.0, 0, 0] as [number, number, number] },
    { id: 'rack-03', name: 'Rack B1 (Storage)', pos: [1.0, 0, 0] as [number, number, number] },
    { id: 'rack-04', name: 'Rack B2 (Database)', pos: [3.0, 0, 0] as [number, number, number] },
  ];

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#050811] rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl">
      {/* Viewport Overlay Badges */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-700/60 backdrop-blur-md text-xs font-mono text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>VIEWPORT: 3D LIVING DC (PHYSICAL)</span>
        </div>
        {selectedNodeId && (
          <div className="px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-xs font-mono text-cyan-300">
            SELECTED: {selectedNodeId.toUpperCase()}
          </div>
        )}
      </div>

      {/* Viewport Action Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setSelectedNodeId(null)}
          title="Clear Selection"
          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center rounded-lg bg-slate-900/80 border border-slate-700/50 p-0.5 text-xs">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 font-medium">
            <Box className="w-3 h-3" />
            3D Space
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-slate-200 cursor-not-allowed">
            <Layers className="w-3 h-3" />
            Topology Graph
          </span>
        </div>
      </div>

      {/* R3F WebGL Canvas */}
      <Canvas
        camera={{ position: [5.5, 5.0, 7.5], fov: 42 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <color attach="background" args={['#050811']} />
        <fog attach="fog" args={['#050811', 12, 28]} />

        {/* Lighting Rig */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          color="#f8fafc"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-8, 6, -5]} intensity={0.4} color="#38bdf8" />
        <pointLight position={[0, 4, 3]} intensity={0.8} color="#8b5cf6" distance={15} />

        <Suspense fallback={null}>
          {/* Ground Floor Grid */}
          <Grid
            position={[0, -0.01, 0]}
            args={[30, 30]}
            cellSize={0.5}
            cellThickness={0.6}
            cellColor="#1e293b"
            sectionSize={2.0}
            sectionThickness={1.2}
            sectionColor="#0ea5e9"
            fadeDistance={22}
            fadeStrength={1.5}
          />

          {/* Central Network Core Pedestal (Router & Core Switch) */}
          <NetworkCorePedestal position={[0, 0, -3.2]} />

          {/* Row of 42U Server Racks */}
          {racks.map((rack) => (
            <ServerRackMesh
              key={rack.id}
              rackId={rack.id}
              name={rack.name}
              position={rack.pos}
              isSelected={selectedNodeId === rack.id}
              onSelect={(id) => setSelectedNodeId(id)}
            />
          ))}
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={3}
          maxDistance={22}
          target={[0, 1.5, 0]}
        />
      </Canvas>

      {/* Bottom Viewport Legend */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/60">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            Router / Edge Network
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
            Core Switches
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            42U Compute Racks
          </span>
        </div>
        <div>Rotate: Left Click + Drag | Pan: Right Click | Zoom: Scroll</div>
      </div>
    </div>
  );
};
