import React, { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { TopologyNode } from '../../engine/topology/types';

interface ServerBladeMeshProps {
  node: TopologyNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const ServerBladeMesh: React.FC<ServerBladeMeshProps> = ({ node, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const powerLedRef = useRef<THREE.Mesh>(null);
  const nicLedRef = useRef<THREE.Mesh>(null);
  const diskLedRef = useRef<THREE.Mesh>(null);
  const position = (node.position || [0, 1.1, 1.5]) as [number, number, number];

  // 2U server blade chassis geometry
  const chassisGeo = useMemo(() => new THREE.BoxGeometry(0.82, 0.3, 0.96), []);

  // Subtle telemetry LED pulse
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (powerLedRef.current) {
      const pIntensity = 1.1 + Math.sin(time * 3 + position[0]) * 0.15;
      if (!Array.isArray(powerLedRef.current.material) && powerLedRef.current.material) {
        (powerLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pIntensity;
      }
    }
    if (nicLedRef.current) {
      const nIntensity = 0.9 + Math.sin(time * 8 + position[1] * 4) * 0.35;
      if (!Array.isArray(nicLedRef.current.material) && nicLedRef.current.material) {
        (nicLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = nIntensity;
      }
    }
    if (diskLedRef.current) {
      const dIntensity = 0.7 + Math.sin(time * 12 + position[0] * 3) * 0.45;
      if (!Array.isArray(diskLedRef.current.material) && diskLedRef.current.material) {
        (diskLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = dIntensity;
      }
    }
  });

  // Dark graphite and brushed metal palette with high visibility
  const chassisColor = isSelected ? '#1a4168' : hovered ? '#3a4b62' : '#273447';
  const faceplateColor = isSelected ? '#163859' : hovered ? '#314156' : '#222d3d';
  const earColor = isSelected ? '#38bdf8' : '#64748b';
  const trimColor = isSelected ? '#38bdf8' : hovered ? '#94a3b8' : '#475569';

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* =========================================================================
          1. 2U COMPUTE SERVER CHASSIS (Deep sheet metal enclosure extending into rack)
         ========================================================================= */}
      <mesh position={[0, 0, 0.05]} castShadow receiveShadow>
        <primitive object={chassisGeo} attach="geometry" />
        <meshStandardMaterial color={chassisColor} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* =========================================================================
          2. FRONT FACEPLATE & BEVELED PERIMETER (Brushed Anodized Aluminum)
         ========================================================================= */}
      <mesh position={[0, 0, 0.531]}>
        <planeGeometry args={[0.8, 0.28]} />
        <meshStandardMaterial color={faceplateColor} roughness={0.25} metalness={0.85} />
      </mesh>

      {/* Subtle Faceplate Border Trim */}
      <lineSegments position={[0, 0, 0.532]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(0.8, 0.28)]} />
        <lineBasicMaterial color={trimColor} linewidth={isSelected ? 2 : 1} />
      </lineSegments>

      {/* =========================================================================
          3. DIE-CAST PULL HANDLES & EIA MOUNTING EARS (Left & Right)
         ========================================================================= */}
      {[-0.415, 0.415].map((earX, idx) => (
        <group key={`ear-${idx}`} position={[earX, 0, 0.533]}>
          {/* Heavy aluminum mounting flange ear */}
          <mesh>
            <planeGeometry args={[0.026, 0.28]} />
            <meshStandardMaterial color={earColor} roughness={0.2} metalness={0.92} />
          </mesh>

          {/* Die-Cast Pull Handle Loop */}
          <group position={[earX > 0 ? 0.008 : -0.008, 0, 0.02]}>
            {/* Upper arm */}
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[0.012, 0.01, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.15} metalness={0.95} />
            </mesh>
            {/* Lower arm */}
            <mesh position={[0, -0.07, 0]}>
              <boxGeometry args={[0.012, 0.01, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.15} metalness={0.95} />
            </mesh>
            {/* Vertical grip bar */}
            <mesh position={[0, 0, 0.018]}>
              <cylinderGeometry args={[0.006, 0.006, 0.15, 12]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.15} metalness={0.95} />
            </mesh>
          </group>

          {/* Captive Knurled Thumbscrews Fastening to Rack EIA Rail */}
          {[0.11, -0.11].map((sy, sIdx) => (
            <mesh key={`screw-${sIdx}`} position={[0, sy, 0.006]}>
              <cylinderGeometry args={[0.006, 0.006, 0.008, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      {/* =========================================================================
          4. FOUR HOT-SWAP 2.5" DRIVE CADDIES (2x2 Matrix with Silver Levers)
         ========================================================================= */}
      {[-0.24, -0.08].map((dx, colIdx) =>
        [0.065, -0.065].map((dy, rowIdx) => (
          <group key={`drive-${colIdx}-${rowIdx}`} position={[dx, dy, 0.534]}>
            {/* Drive Caddy Tray Bezel */}
            <mesh>
              <planeGeometry args={[0.14, 0.11]} />
              <meshStandardMaterial color="#141c28" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Brushed Silver Quick-Release Lever Latch */}
            <mesh position={[0, -0.032, 0.003]}>
              <planeGeometry args={[0.12, 0.018]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.15} metalness={0.95} />
            </mesh>
            {/* Release Push Button */}
            <mesh position={[-0.045, -0.032, 0.005]}>
              <circleGeometry args={[0.005, 8]} />
              <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.8} />
            </mesh>
            {/* Drive Activity Dot LED */}
            <mesh position={[0.045, 0.035, 0.004]}>
              <circleGeometry args={[0.005, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.3} />
            </mesh>
          </group>
        ))
      )}

      {/* =========================================================================
          5. STAMPED HONEYCOMB INTAKE VENTILATION GRILLE (Right Section)
         ========================================================================= */}
      <group position={[0.18, 0.03, 0.534]}>
        {/* Recessed ventilation intake backing */}
        <mesh>
          <planeGeometry args={[0.22, 0.18]} />
          <meshStandardMaterial color="#0b111e" roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Horizontal honeycomb ventilation slits */}
        {[-0.06, -0.03, 0, 0.03, 0.06].map((vy, idx) => (
          <mesh key={`hcomb-${idx}`} position={[0, vy, 0.002]}>
            <planeGeometry args={[0.2, 0.012]} />
            <meshStandardMaterial color="#030712" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* =========================================================================
          6. FRONT CONTROL & TELEMETRY PANEL (Left Margin)
         ========================================================================= */}
      {/* Power Microswitch with Green LED Halo */}
      <group position={[-0.355, 0.08, 0.535]}>
        <mesh position={[0, 0, 0]}>
          <circleGeometry args={[0.012, 12]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.008, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
      </group>

      {/* Three-LED Vertical Status Column */}
      {/* 1. Steady Power LED (Emerald Green) */}
      <mesh position={[-0.355, 0.01, 0.536]} ref={powerLedRef}>
        <circleGeometry args={[0.008, 10]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.3} />
      </mesh>
      {/* 2. Network NIC Activity LED (Electric Cyan) */}
      <mesh position={[-0.355, -0.04, 0.536]} ref={nicLedRef}>
        <circleGeometry args={[0.007, 10]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.3} />
      </mesh>
      {/* 3. Disk / Workload Activity LED (Amber) */}
      <mesh position={[-0.355, -0.09, 0.536]} ref={diskLedRef}>
        <circleGeometry args={[0.007, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.0} />
      </mesh>

      {/* =========================================================================
          7. FRONT NETWORK SFP+ 10GbE OPTICAL PORT CAGES (Right Margin)
         ========================================================================= */}
      <group position={[0.26, -0.085, 0.536]}>
        {/* Metal Port Cage */}
        <mesh>
          <planeGeometry args={[0.08, 0.05]} />
          <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Optical Transceiver Core */}
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[0.055, 0.03]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.4} />
        </mesh>
      </group>

      {/* Silkscreen Asset Model Badge */}
      <mesh position={[0.18, -0.085, 0.535]}>
        <planeGeometry args={[0.1, 0.035]} />
        <meshStandardMaterial
          color={isSelected ? '#0e3a5f' : '#1e293b'}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* =========================================================================
          8. REFINED SELECTION FRAME (Subtle Cyan Outline on Faceplate)
         ========================================================================= */}
      {isSelected && (
        <lineSegments position={[0, 0, 0.54]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(0.8, 0.28)]} />
          <lineBasicMaterial color="#38bdf8" linewidth={2} />
        </lineSegments>
      )}

      {/* =========================================================================
          9. INTERACTIVE HOVER / SELECTION TOOLTIP
         ========================================================================= */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.24, 0.6]}
          center
          distanceFactor={11}
          zIndexRange={[90, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="px-2.5 py-1 rounded-md bg-slate-950/95 border border-cyan-500/80 shadow-2xl backdrop-blur-md font-mono text-[11px] text-cyan-300 flex items-center gap-1.5 animate-in fade-in duration-100 ring-1 ring-cyan-500/30">
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/60 font-semibold">
              SERVER
            </span>
            <span className="font-semibold text-white">{node.name}</span>
            <span className="text-[10px] text-slate-400">({node.id})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
