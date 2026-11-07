import React, { useMemo } from 'react';

export const DataCenterEnvironment: React.FC = () => {
  // 600mm x 600mm Raised Access Floor Tile Grid
  const tileGrid = useMemo(() => {
    const xLines: number[] = [];
    const zLines: number[] = [];
    // Floor spans x in [-8.4, 8.4] and z in [-8.4, 6.0]
    for (let x = -8.4; x <= 8.4; x += 0.6) {
      xLines.push(parseFloat(x.toFixed(2)));
    }
    for (let z = -8.4; z <= 6.0; z += 0.6) {
      zLines.push(parseFloat(z.toFixed(2)));
    }
    return { xLines, zLines };
  }, []);

  // Structural ceiling I-beams across z positions
  const ceilingBeamsZ = useMemo(() => [-7.2, -4.2, -1.2, 1.5, 4.2], []);

  // Perforated airflow floor tiles in the cold aisle
  const perforatedTilePositions = useMemo(() => {
    const pos: [number, number][] = [];
    for (let x = -5.4; x <= 5.4; x += 0.6) {
      pos.push([parseFloat(x.toFixed(2)), 2.1]);
      pos.push([parseFloat(x.toFixed(2)), 2.7]);
    }
    return pos;
  }, []);

  // Overhead cable ladder cross-rungs
  const rungs = useMemo(() => {
    const list: number[] = [];
    for (let x = -6.0; x <= 6.0; x += 0.3) {
      list.push(parseFloat(x.toFixed(2)));
    }
    return list;
  }, []);

  return (
    <group>
      {/* =========================================================================
          1. ARCHITECTURAL WALLS: Heavy Acoustic Data Center Paneling
         ========================================================================= */}
      {/* Rear Boundary Facility Wall (z = -8.5) */}
      <group position={[0, 2.4, -8.5]}>
        {/* Main acoustic insulated drywall */}
        <mesh receiveShadow>
          <planeGeometry args={[18.0, 4.8]} />
          <meshStandardMaterial color="#161e2e" roughness={0.65} metalness={0.4} />
        </mesh>
        {/* Horizontal architectural joint grooves */}
        {[-1.6, -0.8, 0, 0.8, 1.6].map((yOff, idx) => (
          <mesh key={`rw-groove-${idx}`} position={[0, yOff, 0.005]}>
            <planeGeometry args={[18.0, 0.02]} />
            <meshStandardMaterial color="#0b111c" roughness={0.9} />
          </mesh>
        ))}
        {/* Wall-mounted CRAC (Computer Room Air Conditioning) Return Grilles */}
        {[-5.0, 0, 5.0].map((wx, idx) => (
          <group key={`crac-grille-${idx}`} position={[wx, 0.2, 0.02]}>
            {/* Grille frame */}
            <mesh>
              <planeGeometry args={[2.2, 1.4]} />
              <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
            </mesh>
            {/* Horizontal louver slits */}
            {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((ly, lIdx) => (
              <mesh key={`crac-l-${lIdx}`} position={[0, ly, 0.005]}>
                <planeGeometry args={[2.0, 0.06]} />
                <meshStandardMaterial color="#020617" roughness={0.9} />
              </mesh>
            ))}
            {/* Industrial Equipment Label */}
            <mesh position={[0, 0.62, 0.008]}>
              <planeGeometry args={[0.9, 0.08]} />
              <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
        ))}
        {/* High-Voltage Conduit Pipe along Rear Wall */}
        <mesh position={[0, -1.8, 0.04]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 18.0, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.92} />
        </mesh>
      </group>

      {/* Left Facility Wall (x = -9.0) */}
      <group position={[-9.0, 2.4, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh receiveShadow>
          <planeGeometry args={[15.0, 4.8]} />
          <meshStandardMaterial color="#161e2e" roughness={0.65} metalness={0.4} />
        </mesh>
        {/* Left Wall Emergency Power Off (EPO) Panel & Industrial Junction Boxes */}
        <group position={[1.5, 0, 0.05]}>
          <mesh>
            <boxGeometry args={[0.35, 0.45, 0.1]} />
            <meshStandardMaterial color="#991b1b" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.055]}>
            <circleGeometry args={[0.08, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.2} metalness={0.5} />
          </mesh>
        </group>
        {/* Wall Electrical Conduit */}
        <mesh position={[1.5, -1.2, 0.04]}>
          <cylinderGeometry args={[0.02, 0.02, 2.4, 12]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
        </mesh>
        {/* Facility Sign: "ROW 01 - HIGH DENSITY COMPUTE" */}
        <group position={[2.7, 1.2, 0.03]}>
          <mesh>
            <planeGeometry args={[1.8, 0.35]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.1, 0.005]}>
            <planeGeometry args={[1.65, 0.03]} />
            <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.8} />
          </mesh>
        </group>
      </group>

      {/* Right Facility Wall (x = 9.0) */}
      <group position={[9.0, 2.4, -1.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh receiveShadow>
          <planeGeometry args={[15.0, 4.8]} />
          <meshStandardMaterial color="#161e2e" roughness={0.65} metalness={0.4} />
        </mesh>
        {/* Right Wall Electrical Distribution Switchboard Panel */}
        <group position={[-1.5, 0, 0.05]}>
          <mesh>
            <boxGeometry args={[1.2, 1.8, 0.14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.75} />
          </mesh>
          {/* Status Beacons */}
          {[-0.3, 0, 0.3].map((bx, idx) => (
            <mesh key={`panel-led-${idx}`} position={[bx, 0.75, 0.075]}>
              <circleGeometry args={[0.025, 12]} />
              <meshStandardMaterial
                color={idx === 2 ? '#f59e0b' : '#10b981'}
                emissive={idx === 2 ? '#f59e0b' : '#10b981'}
                emissiveIntensity={1.2}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* =========================================================================
          2. STRUCTURAL CEILING DECK & STEEL I-BEAMS
         ========================================================================= */}
      {/* Ceiling Slab Deck (y = 4.8) */}
      <mesh position={[0, 4.8, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18.0, 15.0]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Heavy Structural Steel I-Beams running transverse across the ceiling */}
      {ceilingBeamsZ.map((bz, idx) => (
        <group key={`i-beam-${idx}`} position={[0, 4.65, bz]}>
          {/* Top flange */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[18.0, 0.03, 0.22]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.85} />
          </mesh>
          {/* Web */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[18.0, 0.18, 0.025]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.85} />
          </mesh>
          {/* Bottom flange */}
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[18.0, 0.03, 0.22]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Red Fire Suppression Main Pipe across ceiling */}
      <group position={[0, 4.45, -2.5]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 18.0, 16]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Brass Sprinkler Nozzle Heads */}
        {[-6.0, -3.0, 0, 3.0, 6.0].map((sx, idx) => (
          <mesh key={`sprinkler-${idx}`} position={[sx, -0.06, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.08, 10]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* =========================================================================
          3. LINEAR ARCHITECTURAL CEILING LED LUMINAIRES (Aisle Troffers)
         ========================================================================= */}
      {/* Cold Aisle Linear Troffer (Directly over server aisle z = 1.5) */}
      <group position={[0, 4.48, 1.5]}>
        {/* Troffer housing */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[12.0, 0.05, 0.32]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Frosted LED diffuser strip */}
        <mesh position={[0, -0.01, 0]}>
          <planeGeometry args={[11.8, 0.26]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#f8fafc"
            emissiveIntensity={1.8}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* Distribution Tier Linear Troffer (Over switches z = -2.5) */}
      <group position={[0, 4.48, -2.5]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[10.0, 0.05, 0.32]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <planeGeometry args={[9.8, 0.26]} />
          <meshStandardMaterial
            color="#f1f5f9"
            emissive="#f1f5f9"
            emissiveIntensity={1.5}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* Gateway Tier Linear Troffer (Over router z = -5.8) */}
      <group position={[0, 4.48, -5.8]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[8.0, 0.05, 0.32]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <planeGeometry args={[7.8, 0.26]} />
          <meshStandardMaterial
            color="#f1f5f9"
            emissive="#f1f5f9"
            emissiveIntensity={1.4}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* =========================================================================
          4. OVERHEAD CABLE LADDER RACEWAY SYSTEM
         ========================================================================= */}
      {/* Transverse Cable Ladder running overhead at y = 3.45 across the server row */}
      <group position={[0, 3.45, 1.5]}>
        {/* Side stringer rails */}
        {[-0.24, 0.24].map((rz, idx) => (
          <mesh key={`c-side-${idx}`} position={[0, 0, rz]}>
            <boxGeometry args={[12.4, 0.04, 0.025]} />
            <meshStandardMaterial color="#475569" roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
        {/* Steel cross rungs */}
        {rungs.map((rx, idx) => (
          <mesh key={`c-rung-${idx}`} position={[rx, 0, 0]}>
            <boxGeometry args={[0.02, 0.015, 0.46]} />
            <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.88} />
          </mesh>
        ))}
        {/* Ceiling suspension threaded drop rods */}
        {[-5.0, -2.5, 0, 2.5, 5.0].map((dx, idx) => (
          <mesh key={`c-drop-${idx}`} position={[dx, 0.6, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.2, 8]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Feeder Cable Ladder connecting rear network tier to front server row */}
      {[-3.0, 0, 3.0].map((fx, idx) => (
        <group key={`feeder-ladder-${idx}`} position={[fx, 3.45, -1.8]}>
          {/* Rails */}
          {[-0.18, 0.18].map((rx, rIdx) => (
            <mesh key={`f-rail-${rIdx}`} position={[rx, 0, 0]}>
              <boxGeometry args={[0.025, 0.04, 3.4]} />
              <meshStandardMaterial color="#475569" roughness={0.25} metalness={0.9} />
            </mesh>
          ))}
          {/* Rungs */}
          {[-1.2, -0.6, 0, 0.6, 1.2].map((rz, zIdx) => (
            <mesh key={`f-bar-${zIdx}`} position={[0, 0, rz]}>
              <boxGeometry args={[0.34, 0.015, 0.02]} />
              <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.88} />
            </mesh>
          ))}
        </group>
      ))}

      {/* =========================================================================
          5. AUTHENTIC RAISED ACCESS FLOORING & COLD AISLE AIRFLOW TILES
         ========================================================================= */}
      {/* Base Raised Access Floor Slab */}
      <mesh receiveShadow position={[0, -0.05, -1.2]}>
        <boxGeometry args={[17.4, 0.1, 14.8]} />
        <meshStandardMaterial color="#0f1624" roughness={0.52} metalness={0.62} />
      </mesh>

      {/* 600mm x 600mm Floor Tile Joint Grid */}
      <group position={[0, 0.002, -1.2]}>
        {tileGrid.xLines.map((x, idx) => (
          <mesh key={`fx-${idx}`} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.007, 14.8]} />
            <meshBasicMaterial color="#192335" transparent opacity={0.65} />
          </mesh>
        ))}
        {tileGrid.zLines.map((z, idx) => (
          <mesh key={`fz-${idx}`} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[17.4, 0.007]} />
            <meshBasicMaterial color="#192335" transparent opacity={0.65} />
          </mesh>
        ))}
      </group>

      {/* Perforated Airflow Grille Floor Tiles in the Cold Aisle */}
      {perforatedTilePositions.map(([tx, tz], idx) => (
        <group key={`perf-tile-${idx}`} position={[tx, 0.004, tz]}>
          {/* Perforated tile face */}
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.56, 0.56]} />
            <meshStandardMaterial color="#1a2638" roughness={0.4} metalness={0.75} />
          </mesh>
          {/* Hexagonal airflow mesh inset */}
          {[-0.18, -0.06, 0.06, 0.18].map((ox, oIdx) => (
            <mesh
              key={`perf-slit-${oIdx}`}
              position={[ox, 0.001, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.04, 0.44]} />
              <meshStandardMaterial color="#050912" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Cold Aisle Runway Equipment Plinth (Directly under 4 racks) */}
      <mesh receiveShadow position={[0, 0.006, 1.5]}>
        <boxGeometry args={[11.8, 0.015, 2.2]} />
        <meshStandardMaterial color="#151e2c" roughness={0.38} metalness={0.7} />
      </mesh>

      {/* Brushed Aluminum Cold Aisle Boundary Demarcation Strips */}
      <mesh position={[0, 0.016, 2.6]}>
        <boxGeometry args={[11.8, 0.004, 0.035]} />
        <meshStandardMaterial color="#475569" roughness={0.25} metalness={0.92} />
      </mesh>
      <mesh position={[0, 0.016, 0.4]}>
        <boxGeometry args={[11.8, 0.004, 0.035]} />
        <meshStandardMaterial color="#475569" roughness={0.25} metalness={0.92} />
      </mesh>

      {/* Subdued Bay Alignment Lines on floor */}
      {[-4.5, -1.5, 1.5, 4.5].map((rackX, idx) => (
        <mesh
          key={`bay-line-${idx}`}
          position={[rackX, 0.017, 2.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.8, 0.018]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Ground Contact Shadow Plane */}
      <mesh receiveShadow position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[17.0, 14.0]} />
        <shadowMaterial opacity={0.42} />
      </mesh>
    </group>
  );
};
