import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { TopologyNode } from '../../engine/topology/types';
import type * as THREE from 'three';

interface CoreSwitchMeshProps {
  node: TopologyNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const CoreSwitchMesh: React.FC<CoreSwitchMeshProps> = ({ node, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const matrixRef = useRef<THREE.Mesh>(null);
  const position = (node.position || [0, 2, -3.5]) as [number, number, number];

  useFrame((state) => {
    if (matrixRef.current) {
      const time = state.clock.getElapsedTime();
      const intensity = 0.85 + Math.sin(time * 5) * 0.3;
      if (!Array.isArray(matrixRef.current.material) && matrixRef.current.material) {
        (matrixRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  });

  const rackFrameColor = isSelected ? '#371e54' : hovered ? '#2a223e' : '#1e1c2b';
  const postColor = isSelected ? '#a855f7' : hovered ? '#4c3f66' : '#39334e';
  const chassisColor = isSelected ? '#2d1b46' : hovered ? '#2b233c' : '#211d2e';

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
          1. 42U CORE DIRECTOR RACK FRAME (Grounded to floor level y = 0)
         ========================================================================= */}
      {/* Base Plinth at Floor Level (y = -position[1]) */}
      <group position={[0, -position[1], 0]}>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.12, 1.35]} />
          <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
        </mesh>
        {/* 4 x Leveling Feet on Floor */}
        {(
          [
            [-0.75, 0.58],
            [0.75, 0.58],
            [-0.75, -0.58],
            [0.75, -0.58],
          ] as const
        ).map(([fx, fz], idx) => (
          <mesh key={`c-foot-${idx}`} position={[fx, 0.02, fz]}>
            <cylinderGeometry args={[0.045, 0.05, 0.04, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
          </mesh>
        ))}
      </group>

      {/* 4 Heavy-Gauge Steel Structural Corner Posts */}
      {(
        [
          [-0.78, 0.62],
          [0.78, 0.62],
          [-0.78, -0.62],
          [0.78, -0.62],
        ] as const
      ).map(([px, pz], idx) => (
        <mesh
          key={`c-post-${idx}`}
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
        <boxGeometry args={[1.7, 0.08, 1.35]} />
        <meshStandardMaterial color={rackFrameColor} roughness={0.35} metalness={0.78} />
      </mesh>
      {/* Dual Exhaust Fans on Roof */}
      {[-0.32, 0.32].map((fx, idx) => (
        <mesh key={`c-fan-${idx}`} position={[fx, 0.605, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.015, 20]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}

      {/* Front EIA Mounting Rails */}
      {[-0.72, 0.72].map((rx, idx) => (
        <mesh key={`c-rail-${idx}`} position={[rx, 0, 0.54]}>
          <boxGeometry args={[0.035, 1.0, 0.035]} />
          <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}

      {/* =========================================================================
          2. DIRECTOR CORE SWITCH 6U CHASSIS (Cisco Nexus 9500 / Arista 7500 Style)
         ========================================================================= */}
      {/* Director Modular Chassis Enclosure */}
      <mesh position={[0, 0, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.68, 1.05]} />
        <meshStandardMaterial color={chassisColor} roughness={0.28} metalness={0.85} />
      </mesh>

      {/* Front Anodized Faceplate */}
      <mesh position={[0, 0, 0.582]}>
        <planeGeometry args={[1.38, 0.66]} />
        <meshStandardMaterial color="#1a1827" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Left/Right EIA Chassis Mounting Flange Ears */}
      {[-0.705, 0.705].map((earX, idx) => (
        <group key={`c-ear-${idx}`} position={[earX, 0, 0.584]}>
          <mesh>
            <planeGeometry args={[0.03, 0.66]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.92} />
          </mesh>
          {[0.28, -0.28].map((sy, sIdx) => (
            <mesh key={`c-screw-${sIdx}`} position={[0, sy, 0.005]}>
              <cylinderGeometry args={[0.007, 0.007, 0.008, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Central High-Capacity Optical Fabric Card Matrix (Violet Glow) */}
      <group position={[0, 0.16, 0.585]}>
        <mesh ref={matrixRef}>
          <planeGeometry args={[1.28, 0.22]} />
          <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={1.0} />
        </mesh>
        {/* Fabric blade division ribs */}
        {[-0.45, -0.15, 0.15, 0.45].map((bx, idx) => (
          <mesh key={`frib-${idx}`} position={[bx, 0, 0.003]}>
            <planeGeometry args={[0.02, 0.22]} />
            <meshStandardMaterial color="#2e1065" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Four Horizontal High-Density Fiber Line-Card Blades (SFP+ Array) */}
      {[-0.45, -0.15, 0.15, 0.45].map((cardX, idx) => (
        <group key={`line-card-${idx}`} position={[cardX, -0.15, 0.585]}>
          <mesh>
            <planeGeometry args={[0.26, 0.24]} />
            <meshStandardMaterial color="#0f0e1a" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Status LED */}
          <mesh position={[-0.1, 0.08, 0.002]}>
            <circleGeometry args={[0.007, 8]} />
            <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={1.4} />
          </mesh>
          {/* 12 x SFP+ Port Cages per blade */}
          {[-0.08, -0.02, 0.04, 0.1].map((px, pIdx) =>
            [-0.04, 0.02].map((py, pyIdx) => (
              <mesh key={`sfp-${pIdx}-${pyIdx}`} position={[px, py, 0.003]}>
                <planeGeometry args={[0.04, 0.03]} />
                <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.8} />
              </mesh>
            ))
          )}
        </group>
      ))}

      {/* 1U Horizontal Wire Management D-Ring Trays */}
      {[-0.38, 0.38].map((dy, idx) => (
        <group key={`cd-ring-unit-${idx}`} position={[0, dy, 0.57]}>
          <mesh>
            <boxGeometry args={[1.4, 0.045, 0.06]} />
            <meshStandardMaterial color="#1e1c2b" roughness={0.4} metalness={0.8} />
          </mesh>
          {[-0.5, -0.25, 0, 0.25, 0.5].map((rx, rIdx) => (
            <mesh key={`cring-${rIdx}`} position={[rx, 0, 0.04]}>
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
            <ringGeometry args={[1.05, 1.55, 32]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.65} />
          </mesh>
        </group>
      )}

      {/* Interactive Tooltip */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.72, 0.65]}
          center
          distanceFactor={13}
          zIndexRange={[90, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="px-2.5 py-1 rounded-md bg-slate-950/95 border border-purple-500/80 shadow-2xl backdrop-blur-md font-mono text-[11px] text-purple-300 flex items-center gap-1.5 ring-1 ring-purple-500/30">
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-700/60 font-semibold">
              CORE SWITCH
            </span>
            <span className="font-semibold text-white">{node.name}</span>
            <span className="text-[10px] text-slate-400">({node.id})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
