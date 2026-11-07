import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { TopologyNode } from '../../engine/topology/types';
import type * as THREE from 'three';

interface RouterMeshProps {
  node: TopologyNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const RouterMesh: React.FC<RouterMeshProps> = ({ node, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const wanLedRef = useRef<THREE.Mesh>(null);
  const position = (node.position || [0, 3, -6]) as [number, number, number];

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (wanLedRef.current) {
      const intensity = 1.0 + Math.sin(time * 4) * 0.3;
      if (!Array.isArray(wanLedRef.current.material) && wanLedRef.current.material) {
        (wanLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  });

  const rackFrameColor = isSelected ? '#1e3a5f' : hovered ? '#2c394b' : '#1e2634';
  const postColor = isSelected ? '#0284c7' : hovered ? '#475569' : '#334155';
  const chassisColor = isSelected ? '#14385a' : hovered ? '#2d3d52' : '#222d3d';

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
          1. 42U NETWORK GATEWAY RACK FRAME (Grounded all the way to floor y = 0)
         ========================================================================= */}
      {/* Base Plinth at Floor Level (y = -position[1]) */}
      <group position={[0, -position[1], 0]}>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.75, 0.12, 1.35]} />
          <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
        </mesh>
        {/* 4 x Leveling Feet on Floor */}
        {(
          [
            [-0.78, 0.58],
            [0.78, 0.58],
            [-0.78, -0.58],
            [0.78, -0.58],
          ] as const
        ).map(([fx, fz], idx) => (
          <mesh key={`r-foot-${idx}`} position={[fx, 0.02, fz]}>
            <cylinderGeometry args={[0.045, 0.05, 0.04, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
          </mesh>
        ))}
      </group>

      {/* 4 Heavy-Gauge Steel Structural Corner Posts (Floor to Top Canopy) */}
      {(
        [
          [-0.82, 0.62],
          [0.82, 0.62],
          [-0.82, -0.62],
          [0.82, -0.62],
        ] as const
      ).map(([px, pz], idx) => (
        <mesh
          key={`r-post-${idx}`}
          position={[px, (0.6 - position[1]) / 2, pz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.065, position[1] + 0.6, 0.065]} />
          <meshStandardMaterial color={postColor} roughness={0.3} metalness={0.82} />
        </mesh>
      ))}

      {/* Top Exhaust Canopy Frame */}
      <mesh position={[0, 0.56, 0]} receiveShadow>
        <boxGeometry args={[1.75, 0.08, 1.35]} />
        <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
      </mesh>
      {/* Top Dual Fan Exhausts */}
      {[-0.35, 0.35].map((fx, idx) => (
        <mesh key={`r-fan-${idx}`} position={[fx, 0.605, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.015, 20]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}

      {/* Front EIA-310 Mounting Rails */}
      {[-0.74, 0.74].map((rx, idx) => (
        <mesh key={`r-rail-${idx}`} position={[rx, 0, 0.54]}>
          <boxGeometry args={[0.035, 1.0, 0.035]} />
          <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}

      {/* =========================================================================
          2. CARRIER-GRADE 4U EDGE ROUTER CHASSIS (Dell/Cisco ASR 9000 Style)
         ========================================================================= */}
      {/* Main 4U Router Enclosure */}
      <mesh position={[0, 0, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.44, 0.58, 1.05]} />
        <meshStandardMaterial color={chassisColor} roughness={0.28} metalness={0.85} />
      </mesh>

      {/* Front Anodized Faceplate */}
      <mesh position={[0, 0, 0.582]}>
        <planeGeometry args={[1.42, 0.56]} />
        <meshStandardMaterial color="#1a2434" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Left/Right EIA Rack Mounting Ears with Thumbscrews */}
      {[-0.725, 0.725].map((earX, idx) => (
        <group key={`r-ear-${idx}`} position={[earX, 0, 0.584]}>
          <mesh>
            <planeGeometry args={[0.03, 0.56]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.92} />
          </mesh>
          {[0.22, -0.22].map((sy, sIdx) => (
            <mesh key={`r-screw-${sIdx}`} position={[0, sy, 0.005]}>
              <cylinderGeometry args={[0.007, 0.007, 0.008, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Dual Hot-Swap Front Exhaust Fan Modules */}
      {[-0.45, -0.15].map((fx, idx) => (
        <group key={`fan-mod-${idx}`} position={[fx, 0.14, 0.585]}>
          <mesh>
            <planeGeometry args={[0.26, 0.22]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.6} />
          </mesh>
          {[-0.06, 0, 0.06].map((vy, vIdx) => (
            <mesh key={`fslit-${vIdx}`} position={[0, vy, 0.002]}>
              <planeGeometry args={[0.24, 0.02]} />
              <meshStandardMaterial color="#020617" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Modular Route Processor (RP) Card with OLED Diagnostic Screen */}
      <group position={[0.3, 0.14, 0.585]}>
        {/* OLED Screen */}
        <mesh position={[0, 0.04, 0]}>
          <planeGeometry args={[0.42, 0.1]} />
          <meshStandardMaterial
            color="#082f49"
            emissive="#0284c7"
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Console & Aux Management Ports */}
        {[-0.12, 0, 0.12].map((px, idx) => (
          <mesh key={`mgmt-port-${idx}`} position={[px, -0.05, 0.002]}>
            <planeGeometry args={[0.05, 0.04]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* WAN High-Speed Optical Line Cards (QSFP28 100G) */}
      <group position={[0, -0.14, 0.585]}>
        <mesh>
          <planeGeometry args={[1.32, 0.2]} />
          <meshStandardMaterial color="#111927" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Glowing Cyan WAN Connection Light Bar */}
        <mesh position={[0, 0.08, 0.002]} ref={wanLedRef}>
          <planeGeometry args={[1.28, 0.015]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.4} />
        </mesh>
        {/* 8 x QSFP28 100GbE Optical Port Cages */}
        {[-0.52, -0.37, -0.22, -0.07, 0.07, 0.22, 0.37, 0.52].map((qx, idx) => (
          <group key={`qsfp-${idx}`} position={[qx, -0.03, 0.003]}>
            <mesh>
              <planeGeometry args={[0.1, 0.06]} />
              <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <planeGeometry args={[0.07, 0.035]} />
              <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 1U Horizontal Cable Management D-Ring Wire Organizers */}
      {[-0.34, 0.34].map((dy, idx) => (
        <group key={`d-ring-unit-${idx}`} position={[0, dy, 0.57]}>
          <mesh>
            <boxGeometry args={[1.44, 0.045, 0.06]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
          </mesh>
          {[-0.5, -0.25, 0, 0.25, 0.5].map((rx, rIdx) => (
            <mesh key={`ring-${rIdx}`} position={[rx, 0, 0.04]}>
              <torusGeometry args={[0.025, 0.006, 8, 16]} />
              <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Restrained Selection Halo on Floor */}
      {isSelected && (
        <group position={[0, -position[1] + 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.6, 32]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.65} />
          </mesh>
        </group>
      )}

      {/* Interactive Tooltip */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.68, 0.65]}
          center
          distanceFactor={13}
          zIndexRange={[90, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="px-2.5 py-1 rounded-md bg-slate-950/95 border border-cyan-500/80 shadow-2xl backdrop-blur-md font-mono text-[11px] text-cyan-300 flex items-center gap-1.5 ring-1 ring-cyan-500/30">
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-semibold">
              ROUTER
            </span>
            <span className="font-semibold text-white">{node.name}</span>
            <span className="text-[10px] text-slate-400">({node.id})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
