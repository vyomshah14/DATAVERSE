import React, { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ServerRackMeshProps {
  position: [number, number, number];
  rackId: string;
  name: string;
  isSelected?: boolean;
  onSelect?: (rackId: string) => void;
}

export const ServerRackMesh: React.FC<ServerRackMeshProps> = ({
  position,
  rackId,
  name: _name,
  isSelected = false,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const ledRef = useRef<THREE.Mesh>(null);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1.0, 3.6, 1.2), []);

  // Subtle pulsing LED status
  useFrame((state) => {
    if (ledRef.current) {
      const time = state.clock.getElapsedTime();
      const intensity = 0.5 + Math.sin(time * 3 + position[0]) * 0.4;
      if (Array.isArray(ledRef.current.material)) {
        // Not array in our mesh
      } else if (ledRef.current.material) {
        (ledRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(rackId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 42U Rack Outer Frame */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 3.6, 1.2]} />
        <meshStandardMaterial
          color={isSelected ? '#083344' : hovered ? '#0f172a' : '#030712'}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* Frame Accent Edges */}
      <lineSegments position={[0, 1.8, 0]}>
        <edgesGeometry args={[boxGeo]} />
        <lineBasicMaterial
          color={isSelected ? '#06b6d4' : hovered ? '#38bdf8' : '#1e293b'}
          linewidth={isSelected ? 2 : 1}
        />
      </lineSegments>

      {/* Rack Front Glass / Perforated Door */}
      <mesh position={[0, 1.8, 0.61]}>
        <planeGeometry args={[0.9, 3.4]} />
        <meshStandardMaterial
          color="#020617"
          roughness={0.2}
          metalness={0.9}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Server Blades Activity LEDs */}
      {[-1.2, -0.6, 0.0, 0.6, 1.2].map((yOffset, idx) => (
        <group key={idx} position={[0, 1.8 + yOffset, 0.62]}>
          {/* Blade Front Face */}
          <mesh>
            <planeGeometry args={[0.82, 0.45]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Cyan Activity Indicator */}
          <mesh position={[-0.32, 0, 0.01]} ref={idx === 2 ? ledRef : undefined}>
            <circleGeometry args={[0.025, 12]} />
            <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.8} />
          </mesh>
          {/* Violet Status Indicator */}
          <mesh position={[-0.24, 0, 0.01]}>
            <circleGeometry args={[0.02, 12]} />
            <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Floor Base Glow on selection */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1.1, 32]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
};
