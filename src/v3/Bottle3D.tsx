import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Garrafa 600 ml em 3D. Unidade: raio do corpo = 1.
// Garrafa de alumínio 600 ml, medida a partir das fotos. Unidade: raio do corpo = 1.
// Arte: volta inteira e cobre o corpo todo, da base até a curva do ombro (como na sublimação real).
const LABEL_TOP_R = 0.84; // a estampa sobe pelo ombro até este raio
const LABEL_Y = 0.13;
const SHOULDER_Y = 4.1;
const NECK_R = 0.74;
const useArtTexture = () => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender("textura da arte"));
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    new THREE.TextureLoader().load(staticFile("Arte.jpg"), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      // corta o excesso de branco da arte (mantém as folhinhas e a onda azul)
      t.repeat.set(1, (689 - 58) / 689);
      t.offset.set(0, 34 / 689);
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


// superfície da estampa: segue o perfil do corpo (reto + ombro), reamostrada por comprimento de arco
// pra arte não esticar no ombro
const labelGeometry = () => {
  const raw: [number, number][] = [];
  for (let i = 0; i <= 40; i++) raw.push([1, LABEL_Y + ((SHOULDER_Y - LABEL_Y) * i) / 40]);
  const aMax = Math.acos((LABEL_TOP_R - NECK_R) / (1 - NECK_R));
  for (let i = 1; i <= 30; i++) {
    const a = (aMax * i) / 30;
    raw.push([NECK_R + (1 - NECK_R) * Math.cos(a), SHOULDER_Y + 0.68 * Math.sin(a)]);
  }
  const cum = [0];
  for (let i = 1; i < raw.length; i++)
    cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const total = cum[cum.length - 1];
  const pts: THREE.Vector2[] = [];
  const N = 140;
  for (let k = 0; k <= N; k++) {
    const target = (total * k) / N;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const x = raw[i - 1][0] + (raw[i][0] - raw[i - 1][0]) * f;
    const y = raw[i - 1][1] + (raw[i][1] - raw[i - 1][1]) * f;
    pts.push(new THREE.Vector2(x * 1.004, y));
  }
  return new THREE.LatheGeometry(pts, 256, Math.PI / 2, Math.PI * 2);
};
const lathe = (pts: [number, number][], seg = 160) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

const bodyProfile = (): [number, number][] => {
  const pts: [number, number][] = [
    [0, 0],
    [0.9, 0],
    [0.975, 0.025],
    [1, 0.1],
    [1, SHOULDER_Y],
  ];
  // ombro: quarto de elipse até o gargalo largo
  for (let i = 1; i <= 18; i++) {
    const a = ((i / 18) * Math.PI) / 2;
    pts.push([NECK_R + (1 - NECK_R) * Math.cos(a), SHOULDER_Y + 0.68 * Math.sin(a)]);
  }
  pts.push([0.72, 4.8], [0.72, 4.9], [0, 4.9]);
  return pts;
};

// colar da tampa com ranhuras verticais largas (24 frisos)
const capCollar = () => {
  const g = new THREE.CylinderGeometry(0.76, 0.76, 0.46, 288, 4, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.75) continue;
    const ang = Math.atan2(z, x);
    const groove = Math.pow(Math.max(0, Math.cos(ang * 24)), 10);
    const k = (0.76 - 0.033 * groove) / r;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
};

// mosquetão em "D" com trava
const carabinerCurve = () =>
  new THREE.CatmullRomCurve3(
    [
      [0, 0],
      [0.16, 0.08],
      [0.3, -0.05],
      [0.36, -0.4],
      [0.32, -0.95],
      [0.18, -1.18],
      [0, -1.2],
      [-0.12, -1.08],
      [-0.14, -0.7],
      [-0.12, -0.25],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    "catmullrom",
    0.5,
  );

const plastic = { color: "#121212", roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3 } as const;
const steel = { color: "#e2e6e9", metalness: 1, roughness: 0.16 } as const;

export const BottleMesh: React.FC<{ rotation: number; tilt: number; centered?: boolean }> = ({
  rotation,
  tilt,
  centered = true,
}) => {
  const art = useArtTexture();
  const body = useMemo(() => lathe(bodyProfile()), []);
  const collar = useMemo(capCollar, []);
  const capTop = useMemo(
    () => lathe([[0, 5.3], [0.76, 5.3], [0.8, 5.31], [0.81, 5.46], [0.78, 5.55], [0.56, 5.58], [0, 5.58]]),
    [],
  );
  const nozzle = useMemo(
    () => lathe([[0, 5.57], [0.4, 5.57], [0.4, 5.62], [0.33, 5.63], [0.33, 6.06], [0.31, 6.11], [0.27, 6.13], [0, 6.13]]),
    [],
  );
  const label = useMemo(labelGeometry, []);
  const carabiner = useMemo(() => new THREE.TubeGeometry(carabinerCurve(), 160, 0.045, 14, true), []);
  return (
    <group rotation={[tilt, 0, 0]} position={[0, centered ? -3.0 : 0, 0]}>
      <group rotation={[0, rotation, 0]}>
        <mesh geometry={body}>
          <meshPhysicalMaterial color="#f4f3ef" metalness={0.35} roughness={0.12} clearcoat={1} clearcoatRoughness={0.04} />
        </mesh>
        {art && (
          <mesh geometry={label}>
            <meshPhysicalMaterial map={art} metalness={0.05} roughness={0.2} clearcoat={1} clearcoatRoughness={0.06} />
          </mesh>
        )}

        {/* tampa: colar frisado + disco chanfrado + bico */}
        <mesh geometry={collar} position={[0, 5.07, 0]}>
          <meshPhysicalMaterial {...plastic} />
        </mesh>
        <mesh geometry={capTop}>
          <meshPhysicalMaterial {...plastic} />
        </mesh>
        <mesh geometry={nozzle}>
          <meshPhysicalMaterial {...plastic} roughness={0.28} />
        </mesh>

        {/* alça preta na lateral da tampa */}
        <mesh position={[-0.88, 5.2, 0]} rotation={[0, 0, 0.15]} scale={[1, 1, 0.45]}>
          <torusGeometry args={[0.2, 0.065, 16, 48]} />
          <meshPhysicalMaterial {...plastic} />
        </mesh>

        {/* mosquetão, argola e tampa reserva pendurados */}
        <group position={[-0.96, 5.12, 0.05]} rotation={[0.25, 0.35, -0.42]} scale={1.15}>
          <mesh geometry={carabiner}>
            <meshStandardMaterial {...steel} />
          </mesh>
          <mesh position={[0.22, -0.55, 0]} rotation={[0, 0, 0.12]}>
            <cylinderGeometry args={[0.035, 0.035, 0.75, 12]} />
            <meshStandardMaterial {...steel} roughness={0.25} />
          </mesh>
          <group position={[0.02, -1.42, 0.02]} rotation={[0.6, 0.2, 0]}>
            <mesh>
              <torusGeometry args={[0.26, 0.022, 10, 64]} />
              <meshStandardMaterial {...steel} />
            </mesh>
            <group position={[0, -0.56, 0.05]} rotation={[1.25, 0.3, 0.2]}>
              <mesh>
                <cylinderGeometry args={[0.5, 0.5, 0.3, 64]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
              <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.4, 0.06, 12, 64]} />
                <meshStandardMaterial color="#efefec" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.17, 0]}>
                <cylinderGeometry args={[0.36, 0.36, 0.02, 48]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
            </group>
          </group>
        </group>
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