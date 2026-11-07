import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { TopologyNode } from '../../engine/topology/types';
import type * as THREE from 'three';

interface AccessSwitchMeshProps {
  node: TopologyNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const AccessSwitchMesh: React.FC<AccessSwitchMeshProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const portsRef = useRef<THREE.Mesh>(null);
  const position = (node.position || [0, 1.5, -1.5]) as [number, number, number];

  useFrame((state) => {
    if (portsRef.current) {
      const time = state.clock.getElapsedTime();
      const intensity = 0.8 + Math.sin(time * 5 + position[0]) * 0.3;
      if (!Array.isArray(portsRef.current.material) && portsRef.current.material) {
        (portsRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  });

  const rackFrameColor = isSelected ? '#124773' : hovered ? '#253a52' : '#1e2634';
  const postColor = isSelected ? '#0284c7' : hovered ? '#41556e' : '#334155';
  const chassisColor = isSelected ? '#103859' : hovered ? '#24374d' : '#1c2838';

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
          1. POD DISTRIBUTION 4-POST EQUIPMENT RACK FRAME (Grounded to floor y = 0)
         ========================================================================= */}
      {/* Base Plinth at Floor Level (y = -position[1]) */}
      <group position={[0, -position[1], 0]}>
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.1, 1.2]} />
          <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
        </mesh>
        {/* 4 x Leveling Feet on Floor */}
        {(
          [
            [-0.65, 0.52],
            [0.65, 0.52],
            [-0.65, -0.52],
            [0.65, -0.52],
          ] as const
        ).map(([fx, fz], idx) => (
          <mesh key={`a-foot-${idx}`} position={[fx, 0.02, fz]}>
            <cylinderGeometry args={[0.04, 0.045, 0.04, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
          </mesh>
        ))}
      </group>

      {/* 4 Heavy-Gauge Steel Structural Corner Posts */}
      {(
        [
          [-0.68, 0.55],
          [0.68, 0.55],
          [-0.68, -0.55],
          [0.68, -0.55],
        ] as const
      ).map(([px, pz], idx) => (
        <mesh
          key={`a-post-${idx}`}
          position={[px, (0.5 - position[1]) / 2, pz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.055, position[1] + 0.5, 0.055]} />
          <meshStandardMaterial color={postColor} roughness={0.3} metalness={0.82} />
        </mesh>
      ))}

      {/* Top Header Canopy Frame */}
      <mesh position={[0, 0.48, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.06, 1.2]} />
        <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
      </mesh>

      {/* Front EIA Mounting Rails */}
      {[-0.62, 0.62].map((rx, idx) => (
        <mesh key={`a-rail-${idx}`} position={[rx, 0, 0.48]}>
          <boxGeometry args={[0.03, 0.9, 0.03]} />
          <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}

      {/* =========================================================================
          2. TOP 1U 48-PORT HIGH-DENSITY PATCH PANEL (Directly Above Switch)
         ========================================================================= */}
      <group position={[0, 0.22, 0.48]}>
        <mesh>
          <boxGeometry args={[1.2, 0.08, 0.08]} />
          <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Patch port rows */}
        {[-0.45, -0.15, 0.15, 0.45].map((bx, idx) => (
          <mesh key={`patch-bank-${idx}`} position={[bx, 0, 0.042]}>
            <planeGeometry args={[0.24, 0.05]} />
            <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* =========================================================================
          3. 2U POD AGGREGATION SWITCH CHASSIS (Cisco Catalyst / Juniper EX Style)
         ========================================================================= */}
      {/* Switch 2U Main Enclosure */}
      <mesh position={[0, 0, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.3, 0.85]} />
        <meshStandardMaterial color={chassisColor} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* Front Anodized Faceplate */}
      <mesh position={[0, 0, 0.482]}>
        <planeGeometry args={[1.18, 0.28]} />
        <meshStandardMaterial color="#1a2536" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* EIA Mounting Ears with Thumbscrews */}
      {[-0.605, 0.605].map((earX, idx) => (
        <group key={`a-ear-${idx}`} position={[earX, 0, 0.484]}>
          <mesh>
            <planeGeometry args={[0.025, 0.28]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.92} />
          </mesh>
          {[0.1, -0.1].map((sy, sIdx) => (
            <mesh key={`a-screw-${sIdx}`} position={[0, sy, 0.005]}>
              <cylinderGeometry args={[0.006, 0.006, 0.007, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 48-Port RJ45 Gigabit Port Matrix with Status LEDs */}
      <group position={[-0.15, 0.02, 0.485]}>
        <mesh>
          <planeGeometry args={[0.8, 0.16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* 4 banks of 12 RJ45 ports */}
        {[-0.3, -0.1, 0.1, 0.3].map((bx, bIdx) => (
          <group key={`rj45-bank-${bIdx}`} position={[bx, 0, 0.003]}>
            <mesh>
              <planeGeometry args={[0.16, 0.12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Activity LED bar above port bank */}
            <mesh position={[0, 0.065, 0.002]}>
              <planeGeometry args={[0.15, 0.008]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4 x SFP+ 10GbE Uplink/Downlink Cages (Sky Blue Glow) */}
      <group position={[0.42, 0.02, 0.485]} ref={portsRef}>
        <mesh>
          <planeGeometry args={[0.26, 0.16]} />
          <meshStandardMaterial color="#082f49" roughness={0.3} metalness={0.8} />
        </mesh>
        {[-0.08, -0.03, 0.03, 0.08].map((sx, sIdx) => (
          <mesh key={`asfp-${sIdx}`} position={[sx, 0, 0.004]}>
            <planeGeometry args={[0.04, 0.08]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>

      {/* 4. Bottom 1U Horizontal D-Ring Cable Management Arm */}
      <group position={[0, -0.22, 0.48]}>
        <mesh>
          <boxGeometry args={[1.2, 0.06, 0.06]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
        </mesh>
        {[-0.4, -0.2, 0, 0.2, 0.4].map((rx, rIdx) => (
          <mesh key={`aring-${rIdx}`} position={[rx, 0, 0.035]}>
            <torusGeometry args={[0.02, 0.005, 8, 14]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Restrained Selection Halo on Floor */}
      {isSelected && (
        <group position={[0, -position[1] + 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.95, 1.4, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
          </mesh>
        </group>
      )}

      {/* Interactive Tooltip */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.62, 0.6]}
          center
          distanceFactor={13}
          zIndexRange={[90, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="px-2.5 py-1 rounded-md bg-slate-950/95 border border-sky-500/80 shadow-2xl backdrop-blur-md font-mono text-[11px] text-sky-300 flex items-center gap-1.5 ring-1 ring-sky-500/30">
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-700/60 font-semibold">
              ACCESS SWITCH
            </span>
            <span className="font-semibold text-white">{node.name}</span>
            <span className="text-[10px] text-slate-400">({node.id})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
