import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface NetworkCorePedestalProps {
  position: [number, number, number];
}

export const NetworkCorePedestal: React.FC<NetworkCorePedestalProps> = ({ position }) => {
  const switchLedRef = useRef<THREE.Mesh>(null);
  const routerBoxGeo = useMemo(() => new THREE.BoxGeometry(1.2, 0.4, 0.8), []);
  const switchBoxGeo = useMemo(() => new THREE.BoxGeometry(1.2, 0.35, 0.8), []);

  useFrame((state) => {
    if (switchLedRef.current) {
      const time = state.clock.getElapsedTime();
      const intensity = 0.6 + Math.sin(time * 8) * 0.4;
      if (!Array.isArray(switchLedRef.current.material) && switchLedRef.current.material) {
        (switchLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  });

  return (
    <group position={position}>
      {/* Base Pedestal */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.4, 0.8, 1.0]} />
        <meshStandardMaterial color="#090d16" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Edge Router Chassis */}
      <mesh position={[0, 1.0, 0]}>
        <primitive object={routerBoxGeo} attach="geometry" />
        <meshStandardMaterial color="#0e1726" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Router Status Light Bar */}
      <mesh position={[0, 1.0, 0.41]}>
        <planeGeometry args={[0.9, 0.08]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.9} />
      </mesh>

      {/* Core Switch Chassis */}
      <mesh position={[0, 1.45, 0]}>
        <primitive object={switchBoxGeo} attach="geometry" />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Switch Port Matrix */}
      <mesh position={[0, 1.45, 0.41]} ref={switchLedRef}>
        <planeGeometry args={[1.0, 0.12]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};
