import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Garrafa 600 ml em 3D. Unidade: raio do corpo = 1.
const ART_RATIO = 1600 / 689;
const LABEL_H = ((2 * Math.PI) / ART_RATIO) * 1.18; // a arte dá a volta inteira (levemente esticada, como na sublimação)
const LABEL_Y = 0.78;

const useArtTexture = () => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender("textura da arte"));
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    new THREE.TextureLoader().load(staticFile("Arte.jpg"), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setTex(t);
    });
  }, []);
  useEffect(() => {
    // libera o frame só depois que a textura já está no material
    if (!tex) return;
    advance(performance.now());
    continueRender(handle);
  }, [tex, handle, advance]);
  return tex;
};

const Studio: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

const bodyProfile = () => {
  const pts: [number, number][] = [
    [0, 0],
    [0.88, 0],
    [0.97, 0.03],
    [1, 0.12],
    [1, 4.6],
  ];
  // ombro arredondado até o gargalo
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    const a = (t * Math.PI) / 2;
    pts.push([0.62 + 0.38 * Math.cos(a), 4.6 + 0.72 * Math.sin(a)]);
  }
  pts.push([0.6, 5.43]);
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
};

const ribbedCap = () => {
  const g = new THREE.CylinderGeometry(0.68, 0.68, 0.62, 160, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.6) continue; // tampas superior/inferior
    const ang = Math.atan2(z, x);
    const k = 1 + 0.025 * Math.sign(Math.sin(ang * 36));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
};

const BottleMesh: React.FC<{ rotation: number; tilt: number }> = ({ rotation, tilt }) => {
  const art = useArtTexture();
  const body = useMemo(() => new THREE.LatheGeometry(bodyProfile(), 128), []);
  const cap = useMemo(ribbedCap, []);
  const label = useMemo(
    () => new THREE.CylinderGeometry(1.004, 1.004, LABEL_H, 192, 1, true, Math.PI / 2, Math.PI * 2),
    [],
  );
  return (
    <group rotation={[tilt, 0, 0]} position={[0, -3.3, 0]}>
      <group rotation={[0, rotation, 0]}>
        <mesh geometry={body}>
          <meshStandardMaterial color="#f4f1ea" metalness={0.55} roughness={0.22} />
        </mesh>
        {art && (
          <mesh geometry={label} position={[0, LABEL_Y + LABEL_H / 2, 0]}>
            <meshStandardMaterial map={art} metalness={0.05} roughness={0.3} />
          </mesh>
        )}
        {/* tampa */}
        <mesh geometry={cap} position={[0, 5.71, 0]}>
          <meshStandardMaterial color="#141414" metalness={0.1} roughness={0.45} />
        </mesh>
        <mesh position={[0, 6.07, 0]}>
          <cylinderGeometry args={[0.4, 0.5, 0.14, 64]} />
          <meshStandardMaterial color="#141414" roughness={0.4} />
        </mesh>
        {/* bico esportivo */}
        <mesh position={[0, 6.35, 0]}>
          <cylinderGeometry args={[0.27, 0.3, 0.46, 64]} />
          <meshStandardMaterial color="#1b1b1b" roughness={0.35} />
        </mesh>
        <mesh position={[0, 6.58, 0]}>
          <sphereGeometry args={[0.27, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#1b1b1b" roughness={0.35} />
        </mesh>
        {/* mosquetão preso na alça da tampa */}
        <group position={[-0.95, 5.35, 0.15]} rotation={[0, 0.5, 0.22]}>
          <mesh scale={[0.55, 1, 1]}>
            <torusGeometry args={[0.55, 0.06, 20, 80]} />
            <meshStandardMaterial color="#d8dcdf" metalness={1} roughness={0.18} />
          </mesh>
        </group>
        <mesh position={[-0.62, 5.73, 0.1]} rotation={[0, 0, 0.6]}>
          <torusGeometry args={[0.16, 0.05, 16, 40]} />
          <meshStandardMaterial color="#141414" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

export const Bottle3D: React.FC<{
  width: number;
  height: number;
  rotation: number; // radianos
  tilt?: number;
  zoom?: number;
}> = ({ width, height, rotation, tilt = 0.08, zoom = 1 }) => (
  <ThreeCanvas width={width} height={height} camera={{ fov: 28, position: [0, 0.4, 17 / zoom] }} gl={{ antialias: true }}>
    <Studio />
    <ambientLight intensity={0.25} />
    <directionalLight position={[5, 6, 6]} intensity={1.6} color="#fff1dc" />
    <directionalLight position={[-6, 2, -3]} intensity={1.2} color="#ffb070" />
    <BottleMesh rotation={rotation} tilt={tilt} />
  </ThreeCanvas>
);
