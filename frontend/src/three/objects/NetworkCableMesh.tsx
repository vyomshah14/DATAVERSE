import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TopologyLink } from '../../engine/topology/types';

interface NetworkCableMeshProps {
  link: TopologyLink;
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  isHighlighted?: boolean;
  onSelect?: (id: string) => void;
}

export const NetworkCableMesh: React.FC<NetworkCableMeshProps> = ({
  link,
  sourcePos,
  targetPos,
  isHighlighted = false,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);

  // Compute exact physical port attachment points and pathways
  const { startPt, endPt, curve } = useMemo(() => {
    let p0 = new THREE.Vector3(...sourcePos);
    let p3 = new THREE.Vector3(...targetPos);

    // 1. Router ↔ Core Switch Link (50 Mbps)
    if (link.id.includes('router-core')) {
      p0 = new THREE.Vector3(0, 2.83, -5.41); // Router WAN output port
      p3 = new THREE.Vector3(0, 2.15, -4.085); // Core Switch rear uplink port
      const p1 = new THREE.Vector3(0, 3.42, -5.05);
      const p2 = new THREE.Vector3(0, 2.95, -4.45);
      return {
        startPt: p0,
        endPt: p3,
        curve: new THREE.CubicBezierCurve3(p0, p1, p2, p3),
      };
    }

    // 2. Core Switch ↔ Access Switch 01 (25 Mbps)
    if (link.id.includes('core-access-01')) {
      p0 = new THREE.Vector3(-0.65, 1.9, -2.912); // Core left port
      p3 = new THREE.Vector3(-3.0, 1.55, -1.955); // Access 01 rear port
      const p1 = new THREE.Vector3(-1.25, 2.65, -2.75);
      const p2 = new THREE.Vector3(-2.45, 2.35, -2.25);
      return {
        startPt: p0,
        endPt: p3,
        curve: new THREE.CubicBezierCurve3(p0, p1, p2, p3),
      };
    }

    // 3. Core Switch ↔ Access Switch 02 (25 Mbps)
    if (link.id.includes('core-access-02')) {
      p0 = new THREE.Vector3(0.65, 1.9, -2.912); // Core right port
      p3 = new THREE.Vector3(3.0, 1.55, -1.955); // Access 02 rear port
      const p1 = new THREE.Vector3(1.25, 2.65, -2.75);
      const p2 = new THREE.Vector3(2.45, 2.35, -2.25);
      return {
        startPt: p0,
        endPt: p3,
        curve: new THREE.CubicBezierCurve3(p0, p1, p2, p3),
      };
    }

    // 4. Access Switch ↔ Server Links (Links 4 through 15)
    const serverMatch = (link.target_id || link.targetId || '').match(/(\d+)/);
    const serverIdx = serverMatch ? parseInt(serverMatch[1] ?? '1', 10) : 1;

    // Distribute port index on switch faceplate (0 to 5)
    const portSlot = (serverIdx - 1) % 6;
    const xOffsets = [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45];
    const switchX = sourcePos[0];
    const portX = switchX + (xOffsets[portSlot] ?? 0);

    // Switch front downlink port
    p0 = new THREE.Vector3(portX, 1.42, sourcePos[2] + 0.46);

    // Server front SFP+ port: targetPos[0] + 0.28, targetPos[1] - 0.06, 1.5 + 0.538
    p3 = new THREE.Vector3(targetPos[0] + 0.28, targetPos[1] - 0.06, 2.038);

    // Cable path: Exits switch, ascends to overhead cable ladder at y = 3.45, traverses forward, drops in front of rack
    const p1 = new THREE.Vector3(switchX * 0.6 + targetPos[0] * 0.4, 3.45, -0.2);
    const p2 = new THREE.Vector3(targetPos[0] + 0.26, targetPos[1] + 0.35, 2.06);

    return {
      startPt: p0,
      endPt: p3,
      curve: new THREE.CubicBezierCurve3(p0, p1, p2, p3),
    };
  }, [link.id, link.target_id, link.targetId, sourcePos, targetPos]);

  // Cable thickness based on bandwidth tier and highlight state
  const radius = useMemo(() => {
    let r = 0.02;
    if (link.bandwidth_mbps >= 50) r = 0.034;
    else if (link.bandwidth_mbps >= 25) r = 0.026;
    if (isHighlighted || hovered) r *= 1.35;
    return r;
  }, [link.bandwidth_mbps, isHighlighted, hovered]);

  const tubeGeo = useMemo(() => {
    return new THREE.TubeGeometry(curve, 28, radius, 8, false);
  }, [curve, radius]);

  // Hierarchical bandwidth tier color palette
  const cableColor = useMemo(() => {
    if (link.bandwidth_mbps >= 50) {
      return isHighlighted || hovered ? '#22d3ee' : '#06b6d4'; // 50 Mbps Router-Core (Cyan)
    }
    if (link.bandwidth_mbps >= 25) {
      return isHighlighted || hovered ? '#c084fc' : '#a855f7'; // 25 Mbps Core-Access (Purple)
    }
    return isHighlighted || hovered ? '#60a5fa' : '#38bdf8'; // 10 Mbps Access-Server (Sky Blue)
  }, [link.bandwidth_mbps, isHighlighted, hovered]);

  const emissiveColor = useMemo(() => {
    if (link.bandwidth_mbps >= 50) return '#06b6d4';
    if (link.bandwidth_mbps >= 25) return '#a855f7';
    return '#38bdf8';
  }, [link.bandwidth_mbps]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(link.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 3D Geometric Curved Network Cable */}
      <mesh castShadow={false} receiveShadow={false}>
        <primitive object={tubeGeo} attach="geometry" />
        <meshStandardMaterial
          color={cableColor}
          emissive={emissiveColor}
          emissiveIntensity={isHighlighted || hovered ? 0.95 : 0.28}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>

      {/* Endpoint Connector Strain-Relief Boots */}
      <mesh position={startPt.toArray()}>
        <sphereGeometry args={[radius * 1.5, 12, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={endPt.toArray()}>
        <sphereGeometry args={[radius * 1.5, 12, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Floating Highlight Glow Envelope on Hover/Selection */}
      {(isHighlighted || hovered) && (
        <mesh>
          <primitive
            object={new THREE.TubeGeometry(curve, 28, radius * 1.7, 6, false)}
            attach="geometry"
          />
          <meshBasicMaterial color={emissiveColor} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};
