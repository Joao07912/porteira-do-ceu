import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender, interpolate, Easing, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BottleMesh } from "./Bottle3D";

/*
 * Peregrino 3D renderizado como silhueta contra o sol.
 * Corpo e movimento vêm de captura de movimento real (Mixamo: andar / parado);
 * o braço direito é controlado por IK pra pegar a garrafa e beber.
 */

const MODEL = "v3/models/Xbot.glb";
export const PX_PER_M = 480; // escala da câmera ortográfica
export const WALK_CYCLE_S = 0.9667; // duração do ciclo de andar do mocap
export const WALK_SPEED = 1.557; // m/s do pé de apoio (medido com measureWalk)

type Loaded = { scene: THREE.Object3D; walk: THREE.AnimationClip; idle: THREE.AnimationClip; nod: THREE.AnimationClip };
let cache: Promise<Loaded> | null = null;
const loadModel = () => {
  if (!cache) {
    cache = new GLTFLoader().loadAsync(staticFile(MODEL)).then((g) => {
      const find = (n: string) => g.animations.find((a) => a.name === n)!;
      // o mocap já anda no lugar (o quadril não avança); o chão é que se move
      // "agree" (aceno de cabeça) entra como camada aditiva por cima do parado
      const nod = find("agree").clone();
      THREE.AnimationUtils.makeClipAdditive(nod);
      return { scene: g.scene, walk: find("walk"), idle: find("idle"), nod };
    });
  }
  return cache;
};

// material de silhueta: quase preto, com contorno quente do lado do sol
const silhouette = (rim: string) => {
  const m = new THREE.MeshStandardMaterial({ color: "#16100d", roughness: 1, metalness: 0, envMapIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = { value: new THREE.Color(rim) };
    sh.fragmentShader =
      "uniform vec3 rimColor;\n" +
      sh.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        vec3 nn = normalize(normal);
        float fres = pow(1.0 - abs(dot(nn, normalize(vViewPosition))), 4.0);
        float side = smoothstep(-0.15, 0.75, nn.x) * smoothstep(-0.6, 0.2, nn.y);
        gl_FragColor.rgb = vec3(0.075, 0.052, 0.043) + rimColor * fres * side * 2.4;`,
      );
  };
  return m;
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wp = (o: THREE.Object3D) => o.getWorldPosition(V());

// gira o osso (no espaço do mundo) pra que o filho aponte para `target`
const aim = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) => {
  bone.updateWorldMatrix(true, true);
  const from = wp(child).sub(wp(bone)).normalize();
  const to = target.clone().sub(wp(bone)).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentQ.invert().multiply(delta.multiply(worldQ)));
  bone.updateWorldMatrix(false, true);
};

// gira o osso em torno de um eixo do mundo
const rotateWorld = (bone: THREE.Object3D, axis: THREE.Vector3, angle: number) => {
  bone.updateWorldMatrix(true, false);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.copy(parentQ.invert().multiply(r.multiply(worldQ)));
  bone.updateWorldMatrix(false, true);
};

// IK de 2 ossos no mundo: devolve a posição do cotovelo
const solveElbow = (s: THREE.Vector3, t: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) => {
  const d = Math.min(t.distanceTo(s), l1 + l2 - 1e-4);
  const dirST = t.clone().sub(s).normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole
    .clone()
    .sub(dirST.clone().multiplyScalar(pole.dot(dirST)))
    .normalize();
  return s.clone().add(dirST.multiplyScalar(a)).add(p.multiplyScalar(h));
};

const keys = (x: number, ks: number[], vs: number[]) =>
  interpolate(x, ks, vs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.22, 1),
  });

// momentos da ação de beber (0..1): pega, solta, leva, bebe, abaixa, admira, prende
export const DRINK_KEYS = [0, 0.1, 0.16, 0.27, 0.36, 0.56, 0.64, 0.7, 0.8, 0.87, 0.92, 1];
const HELD = [DRINK_KEYS[1], DRINK_KEYS[10]];

export type Pilgrim3DProps = {
  phase: number; // ciclo da caminhada (1 = ciclo inteiro do mocap)
  walk: number; // 0 parado … 1 andando
  drink: number; // 0..1
  time: number; // segundos (respiração / pêndulo)
  x: number; // posição do quadril no mundo (m)
  glow?: number;
};

const Rig: React.FC<Pilgrim3DProps & { rim: string }> = ({ phase, walk, drink, time, x, glow = 0, rim }) => {
  const [data, setData] = useState<Loaded | null>(null);
  const [handle] = useState(() => delayRender("modelo do peregrino"));
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    loadModel().then(setData);
  }, []);

  const rig = useMemo(() => {
    if (!data) return null;
    const model = SkeletonUtils.clone(data.scene);
    const mat = silhouette(rim);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.frustumCulled = false;
        if (o.name.includes("visor")) o.visible = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const walkA = mixer.clipAction(data.walk);
    const idleA = mixer.clipAction(data.idle);
    walkA.play();
    idleA.play();
    const b = (n: string) => model.getObjectByName(`mixamorig${n}`)!;
    const bones = {
      hips: b("Hips"),
      spine1: b("Spine1"),
      spine2: b("Spine2"),
      neck: b("Neck"),
      head: b("Head"),
      headTop: b("HeadTop_End"),
      rArm: b("RightArm"),
      rFore: b("RightForeArm"),
      rHand: b("RightHand"),
      rMid: b("RightHandMiddle1"),
      lHand: b("LeftHand"),
      lMid: b("LeftHandMiddle1"),
    };
    const fingers = (side: "Right" | "Left") =>
      ["Index", "Middle", "Ring", "Pinky"].flatMap((f) => [1, 2, 3].map((k) => b(`${side}Hand${f}${k}`)));
    // acessórios
    const lathe = (pts: [number, number][], seg = 40) =>
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)),
        seg,
      );
    // chapéu de aba larga levemente caída, copa arredondada e fita
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(
      lathe(
        [
          [0, 0.008],
          [0.1, 0.008],
          [0.19, -0.004],
          [0.218, -0.028],
          [0.212, -0.033],
          [0.186, -0.013],
          [0.1, -0.004],
          [0, -0.004],
        ],
        64,
      ),
      mat,
    );
    const crown = new THREE.Mesh(
      lathe(
        [
          [0, 0.1],
          [0.045, 0.104],
          [0.072, 0.09],
          [0.086, 0.04],
          [0.094, 0],
          [0, 0],
        ],
        48,
      ),
      mat,
    );
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.009, 8, 48), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.016;
    hat.add(brim, crown, band);
    // mochila com tampa, bolso lateral, alças e saco de dormir embaixo
    const pack = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.5, 0.32, 4, 0.07), mat);
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.09, 0.3, 3, 0.04), mat);
    lid.position.set(0.02, 0.27, 0);
    lid.rotation.z = -0.12;
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.2, 0.22, 3, 0.03), mat);
    pocket.position.set(-0.13, -0.06, 0);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.4, 32), mat);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(0.02, -0.3, 0);
    const strapArc = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 8, 32, Math.PI * 0.9), mat);
    strapArc.position.set(0.2, 0.06, 0.1);
    strapArc.rotation.z = -0.15;
    pack.add(body, lid, pocket, roll, strapArc);
    // cajado com nó no topo
    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1, 16), mat);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), mat);
    staff.add(pole, knob);
    const bottle = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 1, 8),
      new THREE.MeshStandardMaterial({ color: "#b9bec2", metalness: 1, roughness: 0.3 }),
    );
    // roupa modelada: perfis de raio ao longo de cada osso (t = 0 no osso, 1 no filho)
    const garments: [string, string, [number, number][]][] = [
      // jaqueta: barra abaixo da cintura, cinto, peito, ombro e gola
      [
        "Hips",
        "Neck",
        [
          [-0.2, 0.0],
          [-0.19, 0.142],
          [-0.1, 0.148],
          [0.04, 0.138],
          [0.08, 0.142],
          [0.3, 0.132],
          [0.6, 0.142],
          [0.8, 0.146],
          [0.92, 0.11],
          [0.98, 0.075],
          [1.02, 0.0],
        ],
      ],
      [
        "Neck",
        "Head",
        [
          [0, 0.056],
          [0.5, 0.052],
          [1, 0.05],
        ],
      ],
      // mangas com punho
      [
        "LeftArm",
        "LeftForeArm",
        [
          [-0.12, 0.0],
          [-0.08, 0.06],
          [0.5, 0.054],
          [1, 0.05],
        ],
      ],
      [
        "LeftForeArm",
        "LeftHand",
        [
          [0, 0.05],
          [0.75, 0.043],
          [0.86, 0.05],
          [0.95, 0.05],
          [0.97, 0.0],
        ],
      ],
      [
        "RightArm",
        "RightForeArm",
        [
          [-0.12, 0.0],
          [-0.08, 0.06],
          [0.5, 0.054],
          [1, 0.05],
        ],
      ],
      [
        "RightForeArm",
        "RightHand",
        [
          [0, 0.05],
          [0.75, 0.043],
          [0.86, 0.05],
          [0.95, 0.05],
          [0.97, 0.0],
        ],
      ],
      // calça folgada com barra sobre a bota
      [
        "LeftUpLeg",
        "LeftLeg",
        [
          [-0.08, 0.0],
          [-0.05, 0.088],
          [0.2, 0.09],
          [0.65, 0.075],
          [1.0, 0.066],
          [1.08, 0.064],
        ],
      ],
      [
        "LeftLeg",
        "LeftFoot",
        [
          [-0.04, 0.064],
          [0.3, 0.067],
          [0.72, 0.056],
          [0.88, 0.062],
          [0.95, 0.066],
          [0.96, 0.0],
        ],
      ],
      [
        "RightUpLeg",
        "RightLeg",
        [
          [-0.08, 0.0],
          [-0.05, 0.088],
          [0.2, 0.09],
          [0.65, 0.075],
          [1.0, 0.066],
          [1.08, 0.064],
        ],
      ],
      [
        "RightLeg",
        "RightFoot",
        [
          [-0.04, 0.064],
          [0.3, 0.067],
          [0.72, 0.056],
          [0.88, 0.062],
          [0.95, 0.066],
          [0.96, 0.0],
        ],
      ],
      // botas com cano, calcanhar e bico
      [
        "LeftFoot",
        "LeftToeBase",
        [
          [-0.62, 0.0],
          [-0.6, 0.042],
          [-0.4, 0.056],
          [0.2, 0.058],
          [0.8, 0.052],
          [1.05, 0.05],
        ],
      ],
      [
        "LeftToeBase",
        "LeftToe_End",
        [
          [0, 0.05],
          [0.6, 0.044],
          [1.05, 0.026],
          [1.12, 0.0],
        ],
      ],
      [
        "RightFoot",
        "RightToeBase",
        [
          [-0.62, 0.0],
          [-0.6, 0.042],
          [-0.4, 0.056],
          [0.2, 0.058],
          [0.8, 0.052],
          [1.05, 0.05],
        ],
      ],
      [
        "RightToeBase",
        "RightToe_End",
        [
          [0, 0.05],
          [0.6, 0.044],
          [1.05, 0.026],
          [1.12, 0.0],
        ],
      ],
    ];
    model.updateMatrixWorld(true);
    const shells = garments.map(([a, c, prof]) => {
      const A = b(a);
      const C = b(c);
      const L = wp(A).distanceTo(wp(C));
      const mesh = new THREE.Mesh(lathe(prof.map(([t, r]) => [r, t * L] as [number, number])), mat);
      return { A, C, mesh };
    });
    // cabeça de perfil: crânio, nariz e barba
    const headShell = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.098, 32, 20), mat);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 16), mat);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    beard.scale.set(0.068, 0.06, 0.075);
    headShell.add(skull, nose, beard);
    // lenço no pescoço, com as pontas balançando
    const scarf = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 10, 32), mat);
    knot.rotation.x = Math.PI / 2;
    const tail1 = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.16, 0.012, 2, 0.006), mat);
    const tail2 = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.13, 0.012, 2, 0.006), mat);
    scarf.add(knot, tail1, tail2);
    const scene = new THREE.Group();
    shells.forEach((s) => scene.add(s.mesh));
    scene.add(headShell, scarf);
    model.rotation.y = Math.PI / 2; // olha para +x
    scene.add(model, hat, pack, staff, bottle, strap);
    const nodA = mixer.clipAction(data.nod);
    nodA.play();
    return {
      scene,
      model,
      mixer,
      walkA,
      idleA,
      nodA,
      bones,
      fingers,
      hat,
      pack,
      staff,
      bottle,
      strap,
      shells,
      headShell,
      nose,
      beard,
      scarf,
      tail1,
      tail2,
      pole,
      knob,
    };
  }, [data, rim]);

  useEffect(() => {
    if (!rig) return;
    advance(performance.now());
    continueRender(handle);
  }, [rig, handle, advance]);

  if (rig) {
    const { model, mixer, walkA, idleA, bones: B } = rig;
    model.position.set(x, 0, 0);
    // aceno de cabeça satisfeito ao admirar a garrafa (camada aditiva do mocap "agree")
    const nodW = interpolate(drink, [0.66, 0.7, 0.82, 0.86], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    rig.nodA.setEffectiveWeight(nodW * 0.7);
    rig.nodA.time = interpolate(drink, [0.68, 0.84], [0, rig.nodA.getClip().duration * 0.55], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    walkA.setEffectiveWeight(walk);
    idleA.setEffectiveWeight(1 - walk);
    walkA.time = (((phase % 1) + 1) % 1) * rig.walkA.getClip().duration;
    idleA.time = time % rig.idleA.getClip().duration;
    mixer.update(0);
    model.updateMatrixWorld(true);

    const Z = V(0, 0, 1); // eixo lateral (o peregrino olha pra +x)
    const d = drink;
    // coluna e cabeça: inclina pra trás ao beber, olha pra garrafa ao pegar/admirar
    rotateWorld(
      B.spine1,
      Z,
      keys(d, DRINK_KEYS, [0, -0.05, -0.03, 0.02, 0.06, 0.08, 0.04, -0.02, -0.02, -0.05, -0.02, 0]),
    );
    const dHead = Math.min(1, d + 0.025 * (d > 0 ? 1 : 0)); // a cabeça antecipa o braço
    rotateWorld(
      B.neck,
      Z,
      keys(dHead, DRINK_KEYS, [0, -0.12, -0.08, 0, 0.12, 0.16, 0.05, -0.14, -0.15, -0.14, -0.06, 0]),
    );
    const gulps =
      Math.sin(((d - DRINK_KEYS[4]) / (DRINK_KEYS[5] - DRINK_KEYS[4])) * Math.PI * 6) *
      0.05 *
      (d > DRINK_KEYS[4] && d < DRINK_KEYS[5] ? 1 : 0);
    rotateWorld(
      B.head,
      Z,
      keys(dHead, DRINK_KEYS, [0, -0.08, -0.06, 0, 0.1, 0.14, 0.04, -0.1, -0.11, -0.08, -0.03, 0]) + gulps,
    );

    // pontos de referência no corpo
    const hipP = wp(B.hips);
    const headP = wp(B.head);
    const top = wp(B.headTop);
    const up = top.clone().sub(headP).normalize();
    const fwd = V(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
    const mouth = headP
      .clone()
      .add(fwd.clone().multiplyScalar(0.1))
      .add(V(0, 0, 0.11));

    // garrafa pendurada no cinto (lado direito, de frente pra câmera)
    const pend = Math.sin(phase * Math.PI * 4 - 0.8) * 0.16 * walk + Math.sin(time * 3.3) * 0.03;
    const belt = hipP.clone().add(V(0.07, 0.07, 0.15)); // cintura, lado direito
    const BOTTLE_H = 0.23;
    const GRIP = 0.06; // a mão segura no terço de baixo
    const hangCenter = belt.clone().add(V(Math.sin(pend) * 0.125, -Math.cos(pend) * 0.125, 0));
    const angleKeys = [-pend, -pend, 0, 0.7, 1.75, 1.98, 1.0, 0.12, 0.08, 0, -pend, -pend]; // rad em torno de Z (+ = gargalo pra trás)
    const inAction = d > 0 && d < 1;
    const dAngle = Math.max(0, d - 0.02); // a garrafa inclina logo depois do braço chegar
    const angle = inAction ? keys(dAngle, DRINK_KEYS, angleKeys) + gulps * 1.2 : -pend;
    const axis = (ang: number) => V(-Math.sin(ang), Math.cos(ang), 0);
    const bUp = axis(angle);
    const shoulder = wp(B.rArm);
    // trajetória do CENTRO da garrafa; a mão é calculada a partir dela
    const mouthCenter = (ang: number) => mouth.clone().sub(axis(ang).multiplyScalar(BOTTLE_H / 2 + 0.01));
    const front = (dx: number, dy: number) => shoulder.clone().add(V(dx, dy, 0.05));
    const centerKeys = [
      hangCenter,
      hangCenter,
      hangCenter.clone().add(V(0.01, 0.06, 0)), // puxão pra soltar do mosquetão
      front(0.22, -0.14),
      mouthCenter(1.75),
      mouthCenter(1.98),
      front(0.22, -0.12),
      front(0.21, -0.24), // admira a garrafa na frente do peito
      front(0.22, -0.22),
      hangCenter.clone().add(V(0.01, 0.05, 0)),
      hangCenter,
      hangCenter,
    ];
    const center = inAction
      ? V(
          keys(
            d,
            DRINK_KEYS,
            centerKeys.map((p) => p.x),
          ),
          keys(
            d,
            DRINK_KEYS,
            centerKeys.map((p) => p.y),
          ),
          keys(
            d,
            DRINK_KEYS,
            centerKeys.map((p) => p.z),
          ),
        )
      : hangCenter;
    // pegada: palma no terço de baixo da garrafa, antebraço perpendicular a ela, vindo do lado do ombro
    const gripP = center.clone().sub(bUp.clone().multiplyScalar(GRIP));
    // lado da pegada contínuo com o ângulo (atrás da garrafa em pé, embaixo dela ao beber) — não troca de lado no meio
    const n = V(-Math.cos(angle), -Math.sin(angle), 0);
    const wristOnBottle = gripP
      .clone()
      .add(n.multiplyScalar(0.075))
      .add(V(0, 0, 0.035));
    const walkHand = wp(B.rHand);
    const reachW = keys(d, [0, DRINK_KEYS[1], DRINK_KEYS[10], 1], [0, 1, 1, 0]);
    const held = d > DRINK_KEYS[1] - 0.005 && d < DRINK_KEYS[10] + 0.005;
    if (inAction) {
      const target = walkHand.clone().lerp(wristOnBottle, reachW);
      const l1 = wp(B.rFore).distanceTo(shoulder);
      const l2 = wp(B.rHand).distanceTo(wp(B.rFore));
      const elbow = solveElbow(shoulder, target, l1, l2, V(0.15, -1, 0.35));
      aim(B.rArm, B.rFore, elbow);
      aim(B.rFore, B.rHand, target);
      aim(B.rHand, B.rMid, gripP.clone().lerp(target.clone().add(target.clone().sub(wp(B.rFore))), 1 - reachW));
    }
    // dedos fechados segurando a garrafa (e a mão esquerda no cajado)
    const curl = (list: THREE.Object3D[], k: number) =>
      list.forEach((f) => {
        f.rotation.z = 0;
        f.rotation.x = 0;
        f.rotateZ(k);
      });
    curl(rig.fingers("Right"), 0.65 + 0.6 * reachW);
    curl(rig.fingers("Left"), 1.25);
    model.updateMatrixWorld(true);

    rig.bottle.position.copy(center);
    rig.bottle.rotation.set(0, 0, angle);
    const hookedW = 1 - keys(d, [0, DRINK_KEYS[2], DRINK_KEYS[9], 1], [0, 1, 1, 0]);
    rig.strap.visible = hookedW > 0.5;
    if (rig.strap.visible) {
      const topOfBottle = center.clone().add(bUp.clone().multiplyScalar(BOTTLE_H / 2));
      rig.strap.position.copy(belt.clone().add(topOfBottle).multiplyScalar(0.5));
      rig.strap.scale.set(1, Math.max(0.001, belt.distanceTo(topOfBottle)), 1);
      rig.strap.quaternion.setFromUnitVectors(V(0, 1, 0), topOfBottle.clone().sub(belt).normalize());
    }
    void held;
    // roupa acompanha os ossos
    model.updateMatrixWorld(true);
    for (const s of rig.shells) {
      const a = wp(s.A);
      const c = wp(s.C);
      s.mesh.position.copy(a);
      s.mesh.quaternion.setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
    }
    const basis = (o: THREE.Vector3, u: THREE.Vector3) => {
      const f = V(1, 0, 0).sub(u.clone().multiplyScalar(u.x)).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f, u, new THREE.Vector3().crossVectors(f, u)),
      );
    };
    const headNow = wp(B.head);
    const topNow = wp(B.headTop);
    const hUp = topNow.clone().sub(headNow).normalize();
    rig.headShell.position.copy(headNow.clone().lerp(topNow, 0.45));
    rig.headShell.quaternion.copy(basis(headNow, hUp));
    rig.nose.position.set(0.098, -0.01, 0);
    rig.nose.rotation.set(0, 0, -Math.PI / 2 - 0.25);
    rig.beard.position.set(0.05, -0.072, 0);

    // lenço: nó no pescoço e pontas balançando com o vento e a passada
    const neckNow = wp(B.neck);
    const nUp = headNow.clone().sub(neckNow).normalize();
    rig.scarf.position.copy(neckNow.clone().add(nUp.clone().multiplyScalar(0.03)));
    rig.scarf.quaternion.copy(basis(neckNow, nUp));
    const flap = Math.sin(time * 6.5) * (0.08 + 0.14 * walk);
    rig.tail1.position.set(-0.09, -0.05, 0.02);
    rig.tail1.rotation.set(0, 0, 0.75 + flap);
    rig.tail2.position.set(-0.085, -0.04, -0.02);
    rig.tail2.rotation.set(0, 0, 0.55 + Math.sin(time * 6.5 + 0.9) * (0.06 + 0.12 * walk));

    // chapéu
    rig.hat.position.copy(top.clone().sub(up.clone().multiplyScalar(0.06)));
    rig.hat.quaternion.setFromUnitVectors(V(0, 1, 0), up);

    // mochila nas costas (segue a coluna)
    const s2 = wp(B.spine2);
    const neckP = wp(B.neck);
    const sUp = neckP.clone().sub(s2).normalize();
    const sFwd = V(1, 0, 0).sub(sUp.clone().multiplyScalar(sUp.x)).normalize();
    const side = new THREE.Vector3().crossVectors(sFwd, sUp);
    rig.pack.position.copy(s2.clone().sub(sFwd.clone().multiplyScalar(0.25)).add(sUp.clone().multiplyScalar(-0.04)));
    rig.pack.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sFwd, sUp, side));

    // cajado na mão esquerda, ponta no chão à frente
    const lh = wp(B.lHand);
    const tipX = lh.x + 0.22 + Math.sin(phase * Math.PI * 2) * 0.08 * walk;
    const tip = V(tipX, 0, lh.z);
    const sDir = lh.clone().sub(tip).normalize();
    const staffLen = tip.distanceTo(lh) + 0.85;
    rig.staff.position.copy(tip);
    rig.staff.quaternion.setFromUnitVectors(V(0, 1, 0), sDir);
    rig.pole.position.y = staffLen / 2;
    rig.pole.scale.set(1, staffLen, 1);
    rig.knob.position.y = staffLen;
  }
  return rig ? (
    <>
      <primitive object={rig.scene} />
      <group position={rig.bottle.position.toArray()} rotation={[0, 0, rig.bottle.rotation.z]}>
        <group scale={0.037} position={[0, -0.113, 0]}>
          <BottleMesh rotation={2.55} tilt={0} centered={false} accessories={false} />
        </group>
        {glow > 0 && <pointLight intensity={glow * 0.6} distance={0.6} color="#ffe2a0" />}
      </group>
    </>
  ) : null;
};

export const Pilgrim3D: React.FC<Pilgrim3DProps & { width: number; height: number; cameraY: number; rim?: string }> = ({
  width,
  height,
  cameraY,
  rim = "#ffb36b",
  ...p
}) => (
  <ThreeCanvas
    width={width}
    height={height}
    orthographic
    camera={{ zoom: PX_PER_M, position: [0, cameraY, 10], rotation: [0, 0, 0], near: 0.1, far: 50 }}
    gl={{ antialias: true }}
  >
    <Env />
    <ambientLight intensity={0.25} />
    <directionalLight position={[3, 1, -3]} intensity={0.6} color="#ffc890" />
    <Rig {...p} rim={rim} />
  </ThreeCanvas>
);

const Env: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

// mede a velocidade do pé de apoio no mocap (m/s) — o chão precisa andar nessa velocidade
export const measureWalk = async () => {
  const data = await loadModel();
  const model = SkeletonUtils.clone(data.scene);
  model.rotation.y = Math.PI / 2;
  const mixer = new THREE.AnimationMixer(model);
  const a = mixer.clipAction(data.walk);
  a.play();
  const foot = model.getObjectByName("mixamorigLeftFoot")!;
  const dur = data.walk.duration;
  const N = 120;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    a.time = (dur * i) / N;
    mixer.update(0);
    model.updateMatrixWorld(true);
    const p = foot.getWorldPosition(new THREE.Vector3());
    xs.push(p.x);
    ys.push(p.y);
  }
  const yMin = Math.min(...ys);
  const speeds: number[] = [];
  for (let i = 1; i <= N; i++) {
    if (ys[i] < yMin + 0.015 && ys[i - 1] < yMin + 0.015) speeds.push(-(xs[i] - xs[i - 1]) / (dur / N));
  }
  speeds.sort((x, y) => x - y);
  const hips = model.getObjectByName("mixamorigHips")!;
  const hx: number[] = [];
  const toe = model.getObjectByName("mixamorigLeftToeBase")!;
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i <= 12; i++) {
    a.time = (dur * i) / 12;
    mixer.update(0);
    model.updateMatrixWorld(true);
    hx.push(+hips.getWorldPosition(new THREE.Vector3()).x.toFixed(3));
    const q = toe.getWorldPosition(new THREE.Vector3());
    tx.push(+q.x.toFixed(3));
    ty.push(+q.y.toFixed(3));
  }
  const track = data.walk.tracks.find((t) => t.name.endsWith("Hips.position"))!;
  const v = track.values;
  return {
    speed: speeds[Math.floor(speeds.length / 2)],
    samples: speeds.length,
    yMin,
    hx,
    tx,
    ty,
    fx: xs.filter((_, i) => i % 10 === 0).map((x) => +x.toFixed(3)),
    fy: ys.filter((_, i) => i % 10 === 0).map((x) => +x.toFixed(3)),
    track0: [v[0], v[1], v[2]].map((x) => +x.toFixed(2)),
    trackMid: [v[v.length / 2 - 1], v[v.length / 2], v[v.length / 2 + 1]].map((x) => +x.toFixed(2)),
  };
};
