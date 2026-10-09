import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, Html, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import { Download } from "lucide-react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { MachineId, MachineState, ProductState } from "../types";

const stateColor = {
  normal: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  stopped: "#64748b",
};

export function FactoryScene({
  machines,
  products,
  selectedId,
  viewMode,
  running,
  onSelect,
}: {
  machines: MachineState[];
  products: ProductState[];
  selectedId: MachineId;
  viewMode: "solid" | "wireframe" | "pointcloud";
  running: boolean;
  onSelect: (id: MachineId) => void;
}) {
  return (
    <div className="relative h-[560px] flex-none">
      <Canvas className="h-full w-full" shadows gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ position: [4, 5.5, 9], fov: 48 }}>
        <color attach="background" args={["#071019"]} />
        <PerspectiveCamera makeDefault position={[5.8, 5, 8.2]} fov={48} />
        <ambientLight intensity={0.45} />
        <directionalLight castShadow position={[2, 8, 5]} intensity={1.7} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <pointLight position={[-6, 4, -3]} intensity={1.2} color="#39c6d6" />
        <Grid args={[16, 16]} cellSize={0.5} cellThickness={0.5} cellColor="#243244" sectionSize={2} sectionThickness={1.2} sectionColor="#334155" position={[0, -0.02, 0]} />
        <Conveyor running={running} wireframe={viewMode === "wireframe"} />
        {machines.map((machine) =>
          viewMode === "pointcloud" && machine.id === selectedId ? (
            <SyntheticPointCloud key={machine.id} machine={machine} onSelect={() => onSelect(machine.id)} />
          ) : (
            <MachineMesh key={machine.id} machine={machine} selected={machine.id === selectedId} wireframe={viewMode === "wireframe"} onSelect={() => onSelect(machine.id)} />
          ),
        )}
        {products.map((product) => (
          <ProductBox key={product.id} product={product} running={running} />
        ))}
        <ContactShadows position={[0, -0.01, 0]} scale={14} blur={1.8} opacity={0.35} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.1} />
        <ScreenshotButton />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.16em] text-cyanline">
        {viewMode === "pointcloud" ? "Synthetic point cloud view" : "Actual Three.js meshes"}
      </div>
    </div>
  );
}

function ScreenshotButton() {
  const { gl } = useThree();
  function save() {
    const link = document.createElement("a");
    link.href = gl.domElement.toDataURL("image/png");
    link.download = "factorytwin-3d-scene.png";
    link.click();
  }

  return (
    <Html position={[6.2, 3.6, -4.5]} transform={false}>
      <button className="command whitespace-nowrap bg-slate-950/90" onClick={save} title="Export PNG screenshot">
        <Download size={15} /> PNG
      </button>
    </Html>
  );
}

function Conveyor({ running, wireframe }: { running: boolean; wireframe: boolean }) {
  const beltRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!running || !beltRef.current) return;
    beltRef.current.position.x = Math.sin(Date.now() * 0.002) * 0.03 * delta;
  });

  return (
    <group>
      <mesh ref={beltRef} position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[10.3, 0.28, 1.05]} />
        <meshStandardMaterial color="#1e293b" metalness={0.45} roughness={0.38} wireframe={wireframe} />
      </mesh>
      {[-4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6, 4.8].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 18]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.28} wireframe={wireframe} />
        </mesh>
      ))}
    </group>
  );
}

function MachineMesh({ machine, selected, wireframe, onSelect }: { machine: MachineState; selected: boolean; wireframe: boolean; onSelect: () => void }) {
  const pulse = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.intensity = machine.state === "critical" ? 1.6 + Math.sin(clock.elapsedTime * 7) * 0.6 : 1.1;
  });

  return (
    <group position={machine.position} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.45, 1.45]} />
        <meshStandardMaterial color={selected ? "#164e63" : "#111827"} metalness={0.35} roughness={0.42} wireframe={wireframe} />
      </mesh>
      {machine.kind === "cnc" && <CncBody color={stateColor[machine.state]} wireframe={wireframe} rpm={machine.rpm} />}
      {machine.kind === "robot" && <RobotBody color={stateColor[machine.state]} wireframe={wireframe} workload={machine.workload} />}
      {machine.kind === "inspection" && <InspectionBody color={stateColor[machine.state]} wireframe={wireframe} />}
      <mesh position={[0.72, 1.55, 0.73]} castShadow>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={stateColor[machine.state]} emissive={stateColor[machine.state]} emissiveIntensity={1.3} />
      </mesh>
      <pointLight ref={pulse} color={stateColor[machine.state]} position={[0.72, 1.55, 0.73]} distance={2.8} />
      <Text position={[0, 2.25, 0]} rotation={[-0.25, 0, 0]} fontSize={0.22} color="#d8e2ef" anchorX="center">
        {machine.name}
      </Text>
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.15, 1.28, 48]} />
          <meshBasicMaterial color="#39c6d6" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function CncBody({ color, wireframe, rpm }: { color: string; wireframe: boolean; rpm: number }) {
  const spindle = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (spindle.current) spindle.current.rotation.y += delta * (rpm / 150);
  });
  return (
    <group>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[1.35, 1.35, 1.1]} />
        <meshStandardMaterial color="#243244" metalness={0.45} roughness={0.35} wireframe={wireframe} />
      </mesh>
      <mesh ref={spindle} position={[0, 1.15, 0.62]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 0.65, 24]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.25} wireframe={wireframe} />
      </mesh>
    </group>
  );
}

function RobotBody({ color, wireframe, workload }: { color: string; wireframe: boolean; workload: number }) {
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = Math.sin(clock.elapsedTime * (0.8 + workload / 80)) * 0.45;
  });
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.46, 0.65, 28]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.3} wireframe={wireframe} />
      </mesh>
      <group ref={arm} position={[0, 1.25, 0]}>
        <mesh position={[0.35, 0.24, 0]} rotation={[0, 0, -0.65]} castShadow>
          <boxGeometry args={[0.85, 0.2, 0.25]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.3} wireframe={wireframe} />
        </mesh>
        <mesh position={[0.85, -0.12, 0]} rotation={[0, 0, 0.7]} castShadow>
          <boxGeometry args={[0.7, 0.18, 0.22]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.32} wireframe={wireframe} />
        </mesh>
        <mesh position={[1.18, -0.34, 0]} castShadow>
          <boxGeometry args={[0.26, 0.2, 0.42]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.25} wireframe={wireframe} />
        </mesh>
      </group>
    </group>
  );
}

function InspectionBody({ color, wireframe }: { color: string; wireframe: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[1.3, 1.0, 1.1]} />
        <meshStandardMaterial color="#1f2937" metalness={0.35} roughness={0.4} wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 1.1, 0.62]} castShadow>
        <boxGeometry args={[0.82, 0.42, 0.08]} />
        <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={0.55} wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 1.7, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.22, 0.5, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} wireframe={wireframe} />
      </mesh>
    </group>
  );
}

function ProductBox({ product, running }: { product: ProductState; running: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const x = -5 + product.progress * 10;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = running ? Math.sin(clock.elapsedTime * 3 + product.id) * 0.1 : 0;
  });
  return (
    <mesh ref={ref} position={[x, 0.72, 0]} castShadow>
      <boxGeometry args={[0.42, 0.42, 0.42]} />
      <meshStandardMaterial color="#d6a039" roughness={0.65} />
    </mesh>
  );
}

function SyntheticPointCloud({ machine, onSelect }: { machine: MachineState; onSelect: () => void }) {
  const points = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < 900; i += 1) {
      const side = i % 6;
      const x = side === 0 ? -0.9 : side === 1 ? 0.9 : Math.random() * 1.8 - 0.9;
      const y = side === 2 ? 0.3 : side === 3 ? 1.9 : Math.random() * 1.6 + 0.3;
      const z = side === 4 ? -0.72 : side === 5 ? 0.72 : Math.random() * 1.44 - 0.72;
      positions.push(x, y, z);
    }
    return new Float32Array(positions);
  }, []);

  return (
    <points position={machine.position} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length / 3} array={points} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={stateColor[machine.state]} sizeAttenuation />
    </points>
  );
}
