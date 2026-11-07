import React, { useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { TopologyNode } from '../../engine/topology/types';

interface ServerRackMeshProps {
  node: TopologyNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const ServerRackMesh: React.FC<ServerRackMeshProps> = ({ node, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const position = (node.position || [0, 0, 1.5]) as [number, number, number];

  // Professional enterprise dark graphite and brushed steel palette
  const frameColor = isSelected ? '#1e3a5f' : hovered ? '#2c394b' : '#1e2634';
  const postColor = isSelected ? '#0284c7' : hovered ? '#475569' : '#334155';
  const panelColor = isSelected ? '#192b3f' : hovered ? '#253243' : '#1a222e';
  const railColor = isSelected ? '#38bdf8' : '#64748b';
  const accentTrimColor = isSelected ? '#38bdf8' : hovered ? '#475569' : '#334155';

  // 42U EIA Unit markings along mounting rails (1U to 42U)
  const uMarks = useMemo(() => {
    const marks: { y: number; isMajor: boolean; label?: string }[] = [];
    // Rack interior spans y = 0.16 to 2.72 (height 2.56m across 42 units -> ~0.061m per U)
    const startY = 0.18;
    const stepY = (2.72 - 0.18) / 42;
    for (let u = 1; u <= 42; u++) {
      const y = startY + (u - 1) * stepY;
      const isMajor = u % 5 === 0 || u === 1 || u === 42;
      marks.push({
        y: parseFloat(y.toFixed(3)),
        isMajor,
        label: isMajor ? `${u}U` : undefined,
      });
    }
    return marks;
  }, []);

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
          1. BASE STRUCTURE: Heavy Steel Base Plinth, Leveling Feet & Dual Casters
         ========================================================================= */}
      {/* Solid welded bottom base frame */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.1, 1.24]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.75} />
      </mesh>

      {/* 4 x Heavy-Duty Threaded Leveling Feet with Hex Adjustment Nuts */}
      {(
        [
          [-0.48, 0.54],
          [0.48, 0.54],
          [-0.48, -0.54],
          [0.48, -0.54],
        ] as const
      ).map(([fx, fz], idx) => (
        <group key={`foot-${idx}`} position={[fx, 0, fz]}>
          {/* Rubber floor isolation pad */}
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.03, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Threaded steel stem */}
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.04, 12]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
          </mesh>
          {/* Hexagonal adjustment collar nut */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.02, 6]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
          </mesh>
        </group>
      ))}

      {/* 4 x Dual-Wheel Swivel Casters */}
      {(
        [
          [-0.38, 0.44],
          [0.38, 0.44],
          [-0.38, -0.44],
          [0.38, -0.44],
        ] as const
      ).map(([cx, cz], idx) => (
        <group key={`caster-${idx}`} position={[cx, 0.04, cz]}>
          <mesh position={[-0.018, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.016, 14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0.018, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.016, 14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Front bottom kickplate with recessed hex ventilation pattern */}
      <mesh position={[0, 0.08, 0.621]}>
        <planeGeometry args={[0.96, 0.07]} />
        <meshStandardMaterial color="#111827" roughness={0.6} metalness={0.6} />
      </mesh>
      {/* Kickplate stamped vents */}
      {[-0.32, -0.16, 0, 0.16, 0.32].map((vx, idx) => (
        <mesh key={`kick-vent-${idx}`} position={[vx, 0.08, 0.622]}>
          <planeGeometry args={[0.1, 0.025]} />
          <meshStandardMaterial color="#030712" roughness={0.9} />
        </mesh>
      ))}

      {/* =========================================================================
          2. STRUCTURAL POSTS: Four Heavy-Gauge Roll-Formed Steel Corner Posts
         ========================================================================= */}
      {(
        [
          [-0.51, 0.58],
          [0.51, 0.58],
          [-0.51, -0.58],
          [0.51, -0.58],
        ] as const
      ).map(([px, pz], idx) => (
        <group key={`post-${idx}`} position={[px, 1.45, pz]}>
          {/* Main vertical corner column */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.06, 2.64, 0.06]} />
            <meshStandardMaterial color={postColor} roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Beveled corner chamfer */}
          <mesh position={[px > 0 ? 0.028 : -0.028, 0, pz > 0 ? 0.028 : -0.028]}>
            <boxGeometry args={[0.012, 2.62, 0.012]} />
            <meshStandardMaterial color={accentTrimColor} roughness={0.25} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* =========================================================================
          3. TOP FRAME & ROOF EXHAUST CANOPY (No shadow casting over internal bays)
         ========================================================================= */}
      {/* Top welded canopy frame */}
      <mesh position={[0, 2.82, 0]} receiveShadow>
        <boxGeometry args={[1.08, 0.1, 1.24]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Dual high-capacity exhaust fan cowls on top of rack */}
      {[-0.22, 0.22].map((fx, idx) => (
        <group key={`roof-fan-${idx}`} position={[fx, 2.875, 0]}>
          {/* Outer circular cowl */}
          <mesh>
            <cylinderGeometry args={[0.17, 0.17, 0.015, 24]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Fan finger-guard concentric rings */}
          <mesh position={[0, 0.009, 0]}>
            <ringGeometry args={[0.04, 0.05, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <ringGeometry args={[0.09, 0.1, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <ringGeometry args={[0.14, 0.15, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Overhead brush cable pass-through entry glands */}
      {[-0.4, 0.4].map((bx, idx) => (
        <mesh key={`brush-entry-${idx}`} position={[bx, 2.872, 0.46]}>
          <boxGeometry args={[0.14, 0.01, 0.1]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      ))}

      {/* =========================================================================
          4. SIDE ENCLOSURE PANELS: Removable Panels with Stamped Louvers & Latches
         ========================================================================= */}
      {/* Left side panel */}
      <mesh position={[-0.525, 1.45, 0]} receiveShadow>
        <boxGeometry args={[0.02, 2.6, 1.12]} />
        <meshStandardMaterial color={panelColor} roughness={0.38} metalness={0.72} />
      </mesh>
      {/* Left panel recessed quarter-turn latch */}
      <mesh position={[-0.536, 1.45, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
      </mesh>
      {/* Left panel stamped upper & lower ventilation louver arrays */}
      {[-0.8, 0.8].map((yOff, lIdx) => (
        <group key={`left-louver-block-${lIdx}`} position={[-0.536, 1.45 + yOff, 0]}>
          {[-0.15, -0.05, 0.05, 0.15].map((ly, idx) => (
            <mesh key={`ll-${idx}`} position={[0, ly, 0]}>
              <planeGeometry args={[0.005, 0.8]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Right side panel */}
      <mesh position={[0.525, 1.45, 0]} receiveShadow>
        <boxGeometry args={[0.02, 2.6, 1.12]} />
        <meshStandardMaterial color={panelColor} roughness={0.38} metalness={0.72} />
      </mesh>
      {/* Right panel recessed quarter-turn latch */}
      <mesh position={[0.536, 1.45, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
      </mesh>
      {/* Right panel stamped upper & lower ventilation louvers */}
      {[-0.8, 0.8].map((yOff, lIdx) => (
        <group key={`right-louver-block-${lIdx}`} position={[0.536, 1.45 + yOff, 0]}>
          {[-0.15, -0.05, 0.05, 0.15].map((ly, idx) => (
            <mesh key={`rl-${idx}`} position={[0, ly, 0]}>
              <planeGeometry args={[0.005, 0.8]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* =========================================================================
          5. REAR EXHAUST: High-Density Perforated Hexagonal Mesh Panel
         ========================================================================= */}
      <mesh position={[0, 1.45, -0.59]} receiveShadow>
        <planeGeometry args={[0.96, 2.6]} />
        <meshStandardMaterial color="#111827" roughness={0.65} metalness={0.55} />
      </mesh>

      {/* =========================================================================
          6. FRONT MOUNTING RAILS (EIA-310-D) & 42U UNIT POSITION MARKINGS
         ========================================================================= */}
      {/* Left Front EIA Mounting Rail */}
      <mesh position={[-0.435, 1.45, 0.53]} castShadow>
        <boxGeometry args={[0.035, 2.6, 0.035]} />
        <meshStandardMaterial color={railColor} roughness={0.22} metalness={0.92} />
      </mesh>
      {/* Right Front EIA Mounting Rail */}
      <mesh position={[0.435, 1.45, 0.53]} castShadow>
        <boxGeometry args={[0.035, 2.6, 0.035]} />
        <meshStandardMaterial color={railColor} roughness={0.22} metalness={0.92} />
      </mesh>

      {/* 42U Unit Markings along Left & Right EIA Rails */}
      {uMarks.map((m, idx) => (
        <group key={`u-mark-${idx}`} position={[0, m.y, 0.548]}>
          {/* Left rail tick */}
          <mesh position={[-0.435, 0, 0]}>
            <planeGeometry args={[m.isMajor ? 0.026 : 0.016, m.isMajor ? 0.007 : 0.004]} />
            <meshStandardMaterial
              color={m.isMajor ? '#f1f5f9' : '#94a3b8'}
              roughness={0.15}
              metalness={0.95}
            />
          </mesh>
          {/* Right rail tick */}
          <mesh position={[0.435, 0, 0]}>
            <planeGeometry args={[m.isMajor ? 0.026 : 0.016, m.isMajor ? 0.007 : 0.004]} />
            <meshStandardMaterial
              color={m.isMajor ? '#f1f5f9' : '#94a3b8'}
              roughness={0.15}
              metalness={0.95}
            />
          </mesh>
        </group>
      ))}

      {/* Horizontal Depth Tie Braces connecting front EIA rails to rear frame */}
      {[-0.435, 0.435].map((rx, idx) =>
        [0.6, 1.45, 2.3].map((by, bIdx) => (
          <mesh key={`tie-brace-${idx}-${bIdx}`} position={[rx, by, 0]}>
            <boxGeometry args={[0.02, 0.025, 1.05]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.85} />
          </mesh>
        ))
      )}

      {/* =========================================================================
          7. DETAILED FRONT DOOR FRAME GEOMETRY (Outer Beveled Perimeter & Latch)
         ========================================================================= */}
      {/* Outer Door Top Stile */}
      <mesh position={[0, 2.74, 0.61]}>
        <boxGeometry args={[0.98, 0.05, 0.025]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.78} />
      </mesh>
      {/* Outer Door Bottom Stile */}
      <mesh position={[0, 0.16, 0.61]}>
        <boxGeometry args={[0.98, 0.05, 0.025]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.78} />
      </mesh>
      {/* Outer Door Left Vertical Stile */}
      <mesh position={[-0.475, 1.45, 0.61]}>
        <boxGeometry args={[0.04, 2.58, 0.025]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.78} />
      </mesh>
      {/* Outer Door Right Vertical Stile */}
      <mesh position={[0.475, 1.45, 0.61]}>
        <boxGeometry args={[0.04, 2.58, 0.025]} />
        <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.78} />
      </mesh>

      {/* Heavy Industrial Door Hinge Blocks (Right side) */}
      {[0.4, 1.45, 2.5].map((hy, idx) => (
        <group key={`hinge-${idx}`} position={[0.495, hy, 0.615]}>
          <mesh>
            <cylinderGeometry args={[0.014, 0.014, 0.06, 12]} />
            <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[-0.012, 0, 0]}>
            <boxGeometry args={[0.02, 0.04, 0.015]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Recessed Industrial Swing-Handle Latch with Key Barrel & Sensor (Left side) */}
      <group position={[-0.475, 1.4, 0.625]}>
        {/* Recessed escutcheon bezel */}
        <mesh>
          <boxGeometry args={[0.028, 0.18, 0.012]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* Die-cast swing lever handle */}
        <mesh position={[0, -0.02, 0.008]}>
          <boxGeometry args={[0.018, 0.12, 0.014]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
        </mesh>
        {/* Key lock cylinder */}
        <mesh position={[0, 0.055, 0.009]}>
          <circleGeometry args={[0.006, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>
      </group>

      {/* =========================================================================
          8. AIRFLOW BLANKING PANELS: Filling unpopulated U-bays between servers
         ========================================================================= */}
      {/* Bottom blanking panel (between bottom kick and Server 1) */}
      <group position={[0, 0.52, 0.53]}>
        <mesh>
          <planeGeometry args={[0.82, 0.6]} />
          <meshStandardMaterial color="#1a2332" roughness={0.5} metalness={0.65} />
        </mesh>
        {[-0.2, -0.1, 0, 0.1, 0.2].map((by, idx) => (
          <mesh key={`b-vent-${idx}`} position={[0, by, 0.002]}>
            <planeGeometry args={[0.74, 0.015]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Blanking panel between Server 1 and Server 2 */}
      <group position={[0, 1.4, 0.53]}>
        <mesh>
          <planeGeometry args={[0.82, 0.22]} />
          <meshStandardMaterial color="#1a2332" roughness={0.5} metalness={0.65} />
        </mesh>
        {[-0.05, 0.05].map((by, idx) => (
          <mesh key={`m1-vent-${idx}`} position={[0, by, 0.002]}>
            <planeGeometry args={[0.74, 0.015]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Blanking panel between Server 2 and Server 3 */}
      <group position={[0, 2.0, 0.53]}>
        <mesh>
          <planeGeometry args={[0.82, 0.22]} />
          <meshStandardMaterial color="#1a2332" roughness={0.5} metalness={0.65} />
        </mesh>
        {[-0.05, 0.05].map((by, idx) => (
          <mesh key={`m2-vent-${idx}`} position={[0, by, 0.002]}>
            <planeGeometry args={[0.74, 0.015]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Top blanking panel (above Server 3 to top canopy) */}
      <group position={[0, 2.58, 0.53]}>
        <mesh>
          <planeGeometry args={[0.82, 0.24]} />
          <meshStandardMaterial color="#1a2332" roughness={0.5} metalness={0.65} />
        </mesh>
        {[-0.06, 0.06].map((by, idx) => (
          <mesh key={`t-vent-${idx}`} position={[0, by, 0.002]}>
            <planeGeometry args={[0.74, 0.015]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* =========================================================================
          9. TOP BEZEL & INTEGRATED ASSET IDENTIFICATION NAMEPLATE
         ========================================================================= */}
      {/* Acrylic Asset Identification Bezel */}
      <mesh position={[0, 2.74, 0.624]}>
        <planeGeometry args={[0.88, 0.05]} />
        <meshStandardMaterial
          color={isSelected ? '#0e3d64' : '#1e293b'}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Top Status LED Indicator Bar */}
      <mesh position={[0, 2.76, 0.627]}>
        <planeGeometry args={[0.82, 0.008]} />
        <meshStandardMaterial
          color={isSelected ? '#38bdf8' : '#10b981'}
          emissive={isSelected ? '#38bdf8' : '#10b981'}
          emissiveIntensity={isSelected ? 1.6 : 1.1}
        />
      </mesh>

      {/* =========================================================================
          10. RESTRAINED SELECTION FEEDBACK (Architectural Halo, No Garish Neon)
         ========================================================================= */}
      {isSelected && (
        <group position={[0, 0.01, 0]}>
          {/* Subtle architectural floor halo ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 1.25, 32]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
          </mesh>
          {/* Inner focus pulse */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.25, 1.35, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
          </mesh>
        </group>
      )}

      {/* =========================================================================
          11. INTERACTIVE HOVER / SELECTION TOOLTIP
         ========================================================================= */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 3.08, 0.65]}
          center
          distanceFactor={13}
          zIndexRange={[80, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="px-2.5 py-1 rounded-md bg-slate-950/95 border border-cyan-500/80 shadow-2xl backdrop-blur-md font-mono text-[11px] text-cyan-300 flex items-center gap-1.5 animate-in fade-in duration-100 ring-1 ring-cyan-500/30">
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-700/60 font-semibold">
              RACK (42U)
            </span>
            <span className="font-semibold text-white">{node.name}</span>
            <span className="text-[10px] text-slate-400">({node.id})</span>
          </div>
        </Html>
      )}
    </group>
  );
};
