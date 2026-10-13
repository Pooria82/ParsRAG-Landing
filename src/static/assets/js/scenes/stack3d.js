// "How it works" as an interactive 3D model. One page and everything ParsRAG builds from it,
// assembled on an engraved platform as the pinned scroll advances (time t from 0 to 6, one
// unit per step): a stack of sheets, a glass scanner that reads them, glass passage tiles,
// a cloud of vectors, the collection that holds them, and a question that pulls three of
// them into a cited answer, joined back to the cited passage by a glowing thread.
//
// Visitors can turn the model by dragging, and each part (or its numbered marker) opens a
// panel with that step's details. Glass, glow and environment lighting are used on capable
// devices; small screens get lighter materials and no glow pass.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry,
  SphereGeometry, TorusGeometry, CircleGeometry, TubeGeometry, IcosahedronGeometry, InstancedMesh,
  MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, LineBasicMaterial, PointsMaterial,
  BufferGeometry, Float32BufferAttribute, Points, LineSegments, EdgesGeometry, CanvasTexture,
  SRGBColorSpace, Vector2, Vector3, CatmullRomCurve3, Color, Object3D, AdditiveBlending, DoubleSide,
  ACESFilmicToneMapping, PMREMGenerator, Raycaster, Sprite, SpriteMaterial, DirectionalLight,
  PointLight, HemisphereLight, MathUtils,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BG = new Color('#080b11');
const TURQ = new Color('#3ee0cf');
const SAFFRON = new Color('#f6b94d');
const glow = (c, k = 2.2) => c.clone().multiplyScalar(k);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
const phase = (t, a, b) => easeOut((t - a) / (b - a));

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The page: a heading, paragraphs, a small table, a highlighted passage and a page number.
const MARK_ROWS = [9, 10];
function pageTexture({ rtl, file, pageNo, font }) {
  return canvasTexture(1024, 1340, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f1f4f7');
    g.addColorStop(1, '#dfe5ea');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const L = 96;
    const R = w - 96;
    const startX = (lw) => (rtl ? R - lw : L);
    // File tag and heading.
    ctx.fillStyle = '#d1503c';
    rr(ctx, rtl ? R - 92 : L, 80, 92, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 26px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('PDF', rtl ? R - 46 : L + 46, 112);
    ctx.fillStyle = '#4b5866';
    ctx.font = `600 30px ${font}`;
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText(file, rtl ? R - 112 : L + 112, 113);
    ctx.fillStyle = '#111a24';
    rr(ctx, startX(560), 186, 560, 30, 8);
    ctx.fill();
    // Paragraph lines; two of them are the cited passage.
    const widths = [1, 0.94, 0.98, 0.72, 1, 0.9, 0.96, 0.62, 0, 0.92, 0.86, 0.95, 0.7, 0, 1, 0.9, 0.97, 0.58];
    let y = 270;
    widths.forEach((f, i) => {
      if (!f) { y += 28; return; }
      const lw = (R - L) * f;
      if (MARK_ROWS.includes(i)) {
        ctx.fillStyle = 'rgba(246, 185, 77, 0.65)';
        rr(ctx, startX(lw) - 14, y - 12, lw + 28, 40, 8);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(17, 26, 36, 0.6)';
      rr(ctx, startX(lw), y, lw, 16, 8);
      ctx.fill();
      y += 44;
    });
    // A small table.
    const ty = y + 20;
    ctx.strokeStyle = 'rgba(17, 26, 36, 0.25)';
    ctx.lineWidth = 3;
    rr(ctx, L, ty, R - L, 200, 14);
    ctx.stroke();
    for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(L, ty + r * 50); ctx.lineTo(R, ty + r * 50); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(L + (R - L) * 0.4, ty); ctx.lineTo(L + (R - L) * 0.4, ty + 200); ctx.stroke();
    ctx.fillStyle = '#7d8896';
    ctx.font = `600 30px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(pageNo, w / 2, h - 60);
  });
}

// Persian girih: an eight-pointed star lattice engraved in the platform.
function girihTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cell = 128;
    ctx.strokeStyle = 'rgba(156, 245, 234, 0.9)';
    ctx.lineWidth = 2.2;
    const star = (cx, cy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 8;
        const rad = i % 2 ? r * 0.56 : r;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    };
    for (let y = 0; y <= h; y += cell) {
      for (let x = 0; x <= w; x += cell) {
        star(x, y, cell * 0.36);
        star(x + cell / 2, y + cell / 2, cell * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.36, y); ctx.lineTo(x + cell - cell * 0.36, y);
        ctx.moveTo(x, y + cell * 0.36); ctx.lineTo(x, y + cell - cell * 0.36);
        ctx.stroke();
      }
    }
    // Fade toward the rim.
    const fade = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w * 0.5);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  });
}

function labelSprite(text, { font, color = '#9cf5ea', bg = 'rgba(8, 11, 17, 0.85)' }) {
  const tex = canvasTexture(256, 96, (ctx, w, h) => {
    ctx.font = `700 40px ${font}`;
    const tw = Math.min(w - 8, ctx.measureText(text).width + 44);
    ctx.fillStyle = bg;
    rr(ctx, (w - tw) / 2, 14, tw, 64, 32);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 48);
  });
  const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.34, 1);
  return s;
}

export function createStack(container, opts) {
  const { rtl, lang, file, answer, cite, steps = [], hint = '', closeLabel = 'Close' } = opts;
  const font = 'Vazirmatn, system-ui, sans-serif';
  const local = (n) => (lang === 'fa' ? String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(n));
  const small = window.innerWidth < 900 || matchMedia('(pointer: coarse)').matches;
  const dir = rtl ? -1 : 1;

  // ----- Renderer, scene, light -----
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.3 : 1.6));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const canvas = renderer.domElement;
  canvas.className = 'jstage__gl';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);

  const scene = new Scene();
  scene.background = BG;
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  scene.add(new HemisphereLight('#9cf5ea', '#05070b', 0.35));
  const key = new DirectionalLight('#ffffff', 1.4);
  key.position.set(4, 9, 6);
  scene.add(key);
  const turqLight = new PointLight('#3ee0cf', 7, 9, 2);
  turqLight.position.set(0, 3.2, 0);
  scene.add(turqLight);
  const saffronLight = new PointLight('#f6b94d', 0, 8, 2);
  saffronLight.position.set(0, 5, 1);
  scene.add(saffronLight);

  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  const model = new Group();
  scene.add(model);

  let composer = null;
  let bloom = null;
  if (!small) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.45, 0.93);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const glass = (tint = '#bff7f1', opacity = 0.28) => (small
    ? new MeshStandardMaterial({ color: tint, transparent: true, opacity, roughness: 0.15, metalness: 0.1, depthWrite: false })
    : new MeshPhysicalMaterial({
      color: tint, transmission: 1, thickness: 0.35, roughness: 0.12, ior: 1.35, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.1, attenuationColor: new Color('#3ee0cf'), attenuationDistance: 3,
      transparent: true, opacity: 1,
    }));
  const emissive = (c, k) => new MeshBasicMaterial({ color: glow(c, k), toneMapped: false, transparent: true });
  const lineMat = (c, k = 1.6, o = 0.9) => new LineBasicMaterial({ color: glow(c, k), toneMapped: false, transparent: true, opacity: o });

  // Parts, one per step; each records its meshes for picking and its glowing materials.
  const parts = steps.map((s, i) => ({ i, group: new Group(), glows: [], anchor: new Vector3(), built: 0 }));
  if (!parts.length) for (let i = 0; i < 6; i++) parts.push({ i, group: new Group(), glows: [], anchor: new Vector3(), built: 0 });
  parts.forEach((p) => { p.group.userData.part = p.i; model.add(p.group); });
  const addGlow = (p, mat, base) => { p.glows.push({ mat, base: base ?? (mat.opacity ?? 1) }); return mat; };

  // ----- Platform with girih engraving and turning rings -----
  const platform = new Group();
  model.add(platform);
  const dais = new Mesh(new CylinderGeometry(4.3, 4.45, 0.22, 128), new MeshStandardMaterial({ color: '#0b1119', metalness: 0.75, roughness: 0.38 }));
  dais.position.y = -0.2;
  platform.add(dais);
  const engraving = new Mesh(new CircleGeometry(4.15, 128), new MeshBasicMaterial({
    map: girihTexture(), transparent: true, opacity: 0.38, color: glow(TURQ, 1.1), toneMapped: false, depthWrite: false,
  }));
  engraving.rotation.x = -Math.PI / 2;
  engraving.position.y = -0.085;
  platform.add(engraving);
  const ringA = new Mesh(new TorusGeometry(4.55, 0.018, 8, 200), emissive(TURQ, 1.8));
  ringA.rotation.x = Math.PI / 2;
  ringA.position.y = -0.1;
  const ringB = new Mesh(new TorusGeometry(4.95, 0.01, 8, 200), emissive(SAFFRON, 1.4));
  ringB.rotation.x = Math.PI / 2;
  ringB.position.y = -0.14;
  platform.add(ringA, ringB);
  // Tick marks around the rim, like a dial.
  const ticks = new InstancedMesh(new BoxGeometry(0.03, 0.02, 0.22), emissive(TURQ, 1.2), 96);
  const dummy = new Object3D();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 4.75, -0.12, Math.sin(a) * 4.75);
    dummy.rotation.set(0, -a, 0);
    dummy.scale.set(1, 1, i % 8 ? 1 : 2.2);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  platform.add(ticks);

  // ----- 1. Upload: a stack of sheets, the top one is the page -----
  const W = 2.7;
  const D = 3.5;
  const P0 = parts[0];
  const pageTex = pageTexture({ rtl, file, pageNo: local(3), font });
  const sheetGeo = new RoundedBoxGeometry(W, 0.03, D, 2, 0.04);
  const sheets = [];
  for (let k = 0; k < 4; k++) {
    const top = k === 3;
    // Paper is shown unlit at its own colours, below the glow threshold, so its text stays readable.
    const m = new Mesh(sheetGeo, new MeshStandardMaterial({ color: top ? '#b9c3cc' : k % 2 ? '#a9b4be' : '#b3bdc7', roughness: 0.95 }));
    m.userData.rest = new Vector3((k - 1.5) * 0.06 * dir, 0.05 + k * 0.045, (1.5 - k) * 0.05);
    m.userData.turn = (k - 1.5) * 0.05;
    sheets.push(m);
    P0.group.add(m);
  }
  const pageFace = new Mesh(new PlaneGeometry(W - 0.06, D - 0.06), new MeshBasicMaterial({ map: pageTex, color: '#d4dbe2' }));
  pageFace.rotation.x = -Math.PI / 2;
  pageFace.position.y = 0.018;
  sheets[3].add(pageFace);
  const pageEdge = new LineSegments(new EdgesGeometry(new BoxGeometry(W, 0.03, D)), lineMat(TURQ, 1.4, 0));
  sheets[3].add(pageEdge);
  P0.anchor.set(W / 2 * dir, 0.3, -D / 2);

  // ----- 2. Read and OCR: a glass scanner plate, a beam, and lines of extracted text -----
  const P1 = parts[1];
  const plate = new Mesh(new RoundedBoxGeometry(W + 0.3, 0.07, D + 0.3, 3, 0.05), glass('#c8fbf5'));
  P1.group.add(plate);
  const plateEdge = new LineSegments(new EdgesGeometry(new BoxGeometry(W + 0.3, 0.07, D + 0.3)), addGlow(P1, lineMat(TURQ, 1.6, 0.55), 0.55));
  P1.group.add(plateEdge);
  const beam = new Mesh(new BoxGeometry(W + 0.6, 0.025, 0.05), emissive(TURQ, 3.2));
  const beamHalo = new Mesh(new PlaneGeometry(W + 0.6, 0.6), new MeshBasicMaterial({ color: glow(TURQ, 1.2), transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }));
  beamHalo.rotation.x = -Math.PI / 2;
  beam.add(beamHalo);
  P1.group.add(beam);
  const textLines = [];
  const lineWidths = [1, 0.94, 0.98, 0.72, 1, 0.9, 0.96, 0.62, 0.92, 0.86, 0.95, 0.7, 1, 0.9];
  lineWidths.forEach((f, i) => {
    const lw = (W - 0.5) * f;
    const mark = i === 8 || i === 9;
    const m = new Mesh(new BoxGeometry(lw, 0.012, 0.055), emissive(mark ? SAFFRON : TURQ, mark ? 2.6 : 2));
    // Lines start at the reading edge: the left in English, the right in Persian.
    const x = rtl ? (W - 0.5) / 2 - lw / 2 : -(W - 0.5) / 2 + lw / 2;
    m.position.set(x, 0.05, -D / 2 + 0.45 + i * 0.205);
    m.userData.z = m.position.z;
    textLines.push(m);
    P1.group.add(m);
  });
  P1.anchor.set(-(W / 2 + 0.15) * dir, 0.1, -D / 2);

  // ----- 3. Passages: four glass tiles (one bridges two pages) with page tags -----
  const P2 = parts[2];
  const tileGeo = new RoundedBoxGeometry(1.22, 0.12, 1.62, 3, 0.05);
  const tileEdgeGeo = new EdgesGeometry(new BoxGeometry(1.22, 0.12, 1.62));
  const tiles = [];
  const tags = [local('p. 3'), local('p. 3'), local('p. 3–4'), local('p. 4')].map((t) => (lang === 'fa' ? t.replace('p. ', 'ص ') : t));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([cx, cz], k) => {
    const bridge = k === 2;
    const g = new Group();
    const tile = new Mesh(tileGeo, glass(bridge ? '#ffe2a8' : '#c8fbf5', 0.32));
    const edge = new LineSegments(tileEdgeGeo, addGlow(P2, lineMat(bridge ? SAFFRON : TURQ, 1.8, 0.95), 0.95));
    const tag = labelSprite(tags[k], { font, color: bridge ? '#ffd88f' : '#9cf5ea' });
    tag.position.set(0, 0.32, -0.55);
    g.add(tile, edge, tag);
    g.userData.rest = new Vector3(cx * 0.7 * dir, 0, cz * 0.92);
    tiles.push(g);
    P2.group.add(g);
  });
  P2.anchor.set(-1.35 * dir, 0.2, 1.75);

  // ----- 4. Vectors: a cloud of points, this page's four passages bright, with neighbours -----
  const P3 = parts[3];
  const rand = rng(11);
  const N = small ? 90 : 160;
  const cloud = new InstancedMesh(new IcosahedronGeometry(0.045, 1), new MeshStandardMaterial({ color: '#6fa3ad', emissive: '#1c4a52', roughness: 0.4, metalness: 0.2 }), N);
  const cloudPts = [];
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.35 + Math.sqrt(rand()) * 1.75;
    const p = new Vector3(Math.cos(a) * r, (rand() - 0.5) * 0.8, Math.sin(a) * r);
    cloudPts.push(p);
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.6 + rand() * 0.9);
    dummy.updateMatrix();
    cloud.setMatrixAt(i, dummy.matrix);
  }
  P3.group.add(cloud);
  const mine = [new Vector3(0.55 * dir, 0.12, -0.45), new Vector3(0.95 * dir, -0.1, -0.05), new Vector3(0.38 * dir, 0.2, 0.3), new Vector3(1.0 * dir, 0.05, 0.5)];
  const minePts = mine.map(() => {
    const m = new Mesh(new SphereGeometry(0.085, 20, 14), emissive(TURQ, 3));
    const halo = new Sprite(new SpriteMaterial({ color: glow(TURQ, 1.2), transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.setScalar(0.42);
    m.add(halo);
    P3.group.add(m);
    return m;
  });
  // Lines from each of this page's points to its nearest neighbours in the cloud.
  const nn = [];
  mine.forEach((m) => {
    cloudPts.map((p, j) => [p.distanceTo(m), j]).sort((a, b) => a[0] - b[0]).slice(0, 4)
      .forEach(([, j]) => nn.push(m.x, m.y, m.z, cloudPts[j].x, cloudPts[j].y, cloudPts[j].z));
  });
  const nnGeo = new BufferGeometry();
  nnGeo.setAttribute('position', new Float32BufferAttribute(nn, 3));
  const nnLines = new LineSegments(nnGeo, addGlow(P3, lineMat(TURQ, 1.2, 0.45), 0.45));
  P3.group.add(nnLines);
  P3.anchor.set(0.9 * dir, 0.35, 0.55);

  // ----- 5. The collection: a segmented glass cylinder around the cloud -----
  const P4 = parts[4];
  const cyl = new Mesh(new CylinderGeometry(2.25, 2.25, 1.35, 96, 1, true), glass('#bff7f1', 0.12));
  cyl.material.side = DoubleSide;
  P4.group.add(cyl);
  const ringTop = new Mesh(new TorusGeometry(2.25, 0.02, 8, 160), addGlow(P4, emissive(TURQ, 2), 1));
  ringTop.rotation.x = Math.PI / 2;
  ringTop.position.y = 0.675;
  const ringBot = ringTop.clone();
  ringBot.position.y = -0.675;
  P4.group.add(ringTop, ringBot);
  const seg = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    seg.push(Math.cos(a) * 2.25, -0.675, Math.sin(a) * 2.25, Math.cos(a) * 2.25, 0.675, Math.sin(a) * 2.25);
  }
  const segGeo = new BufferGeometry();
  segGeo.setAttribute('position', new Float32BufferAttribute(seg, 3));
  P4.group.add(new LineSegments(segGeo, addGlow(P4, lineMat(TURQ, 1.2, 0.35), 0.35)));
  P4.anchor.set(2.25 * dir, 0.6, 0);

  // ----- 6. Retrieve and cite: the question, three links, the answer card and the thread -----
  const P5 = parts[5];
  const query = new Mesh(new SphereGeometry(0.14, 32, 20), emissive(SAFFRON, 3));
  const qHalo = new Sprite(new SpriteMaterial({ color: glow(SAFFRON, 1.2), transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  qHalo.scale.setScalar(0.8);
  query.add(qHalo);
  P5.group.add(query);
  const linkGeo = new BufferGeometry();
  linkGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(18), 3));
  const links = new LineSegments(linkGeo, addGlow(P5, lineMat(SAFFRON, 2.2, 0.95), 0.95));
  P5.group.add(links);

  const ansTex = canvasTexture(1024, 640, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#121a28');
    g.addColorStop(1, '#0a0f17');
    ctx.fillStyle = g;
    rr(ctx, 0, 0, w, h, 48);
    ctx.fill();
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = '#3ee0cf';
    ctx.beginPath();
    ctx.arc(rtl ? w - 84 : 84, 96, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef2f6';
    ctx.font = `700 52px ${font}`;
    ctx.fillText(answer, rtl ? w - 120 : 120, 114);
    [0.9, 0.82, 0.88, 0.62].forEach((f, i) => {
      const lw = (w - 144) * f;
      ctx.fillStyle = 'rgba(238, 242, 246, 0.5)';
      rr(ctx, rtl ? w - 72 - lw : 72, 190 + i * 62, lw, 18, 9);
      ctx.fill();
    });
    ctx.font = `700 40px ${font}`;
    const tw = ctx.measureText(cite).width + 70;
    ctx.fillStyle = 'rgba(246, 185, 77, 0.22)';
    rr(ctx, rtl ? w - 72 - tw : 72, 482, tw, 76, 38);
    ctx.fill();
    ctx.fillStyle = '#ffd88f';
    ctx.fillText(cite, rtl ? w - 107 : 107, 532);
  });
  const card = new Group();
  const cardBody = new Mesh(new RoundedBoxGeometry(2.7, 1.72, 0.06, 4, 0.1), glass('#c8fbf5', 0.35));
  const cardFace = new Mesh(new PlaneGeometry(2.62, 1.64), new MeshBasicMaterial({ map: ansTex, transparent: true, toneMapped: false }));
  cardFace.position.z = 0.035;
  const cardEdge = new LineSegments(new EdgesGeometry(new BoxGeometry(2.7, 1.72, 0.06)), addGlow(P5, lineMat(TURQ, 1.8, 0.8), 0.8));
  card.add(cardBody, cardFace, cardEdge);
  P5.group.add(card);
  P5.anchor.set(0, 0, 0);

  // ----- Ambient dust -----
  const dust = [];
  for (let i = 0; i < (small ? 120 : 260); i++) dust.push((rand() - 0.5) * 12, rand() * 7.5, (rand() - 0.5) * 12);
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(dust, 3));
  const dustPts = new Points(dustGeo, new PointsMaterial({ color: glow(TURQ, 1.1), size: 0.025, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  model.add(dustPts);

  // ----- Layout over time -----
  const Y = { page: 0, plate: 1.05, tiles: 2.05, cloud: 3.25, answer: 5.3 };
  const thread = { mesh: null, count: 0 };

  function buildThread() {
    if (thread.mesh) return;
    const chip = new Vector3((rtl ? 0.62 : -0.62), -0.56, 0.05);
    card.updateMatrixWorld(true);
    const start = card.localToWorld(chip.clone());
    model.worldToLocal(start);
    const pageMark = new Vector3((rtl ? 0.35 : -0.35), 0.24, -D / 2 + (270 + 9.5 * 44) / 1340 * D);
    const curve = new CatmullRomCurve3([
      start,
      new Vector3(start.x * 0.4 - 1.9 * dir, start.y - 1.2, start.z + 1.2),
      new Vector3(-2.2 * dir, 1.6, pageMark.z + 1.4),
      new Vector3(pageMark.x - 0.6 * dir, 0.7, pageMark.z + 0.4),
      pageMark,
    ]);
    const geo = new TubeGeometry(curve, 160, 0.022, 8, false);
    thread.count = geo.index.count;
    thread.mesh = new Mesh(geo, addGlow(P5, emissive(SAFFRON, 3), 1));
    thread.mesh.userData.part = 5;
    model.add(thread.mesh);
  }

  let t = 0;
  let introStart = 0;
  function layout(time, now) {
    const spread = 0.6 + 0.4 * phase(time, 0.8, 4.4);

    // 1. Sheets fall in one after another when the model first appears.
    const intro = introStart ? (now - introStart) / 1000 : 0;
    sheets.forEach((s, k) => {
      const a = Math.max(phase(time, k * 0.15, 0.55 + k * 0.15), phase(intro, k * 0.18, 0.7 + k * 0.18));
      s.position.copy(s.userData.rest).setY(s.userData.rest.y + (1 - a) * 3.5);
      s.rotation.set((1 - a) * 0.5, s.userData.turn + (1 - a) * 0.8 * dir, 0);
      s.visible = a > 0.01;
    });
    parts[0].built = Math.max(phase(time, 0, 0.9), phase(intro, 0, 1.3));

    // 2. Scanner plate rises above the page; the beam passes and leaves lines of text.
    const p1 = phase(time, 1, 1.4);
    P1.group.position.y = Y.plate * spread;
    P1.group.visible = p1 > 0.01;
    P1.group.scale.setScalar(0.92 + 0.08 * p1);
    plate.material.opacity = (small ? 0.28 : 1) * p1;
    const scan = clamp01((time - 1.15) / 0.75);
    beam.visible = time > 1.1 && time < 2.1;
    beam.position.set(0, 0.07, -D / 2 - 0.1 + scan * (D + 0.2));
    textLines.forEach((m) => { m.visible = beam.position.z > m.userData.z || time >= 2; });
    parts[1].built = phase(time, 1, 1.9);

    // 3. Tiles separate out of the text plate.
    const p2 = phase(time, 2, 2.8);
    P2.group.position.y = Y.tiles * spread;
    P2.group.visible = p2 > 0.01;
    tiles.forEach((g, k) => {
      g.position.copy(g.userData.rest).multiplyScalar(0.4 + 0.6 * p2);
      g.position.y = Math.sin(now * 0.0012 + k) * 0.03;
      g.scale.setScalar(0.5 + 0.5 * p2);
    });
    parts[2].built = p2;

    // 4. The cloud gathers; this page's points rise from the tiles.
    const p3 = phase(time, 3, 3.8);
    P3.group.position.y = Y.cloud * spread;
    P3.group.visible = p3 > 0.01;
    cloud.scale.setScalar(0.2 + 0.8 * p3);
    cloud.rotation.y = now * 0.00008;
    minePts.forEach((m, k) => {
      const from = tiles[k].position.clone().setY(Y.tiles * spread - Y.cloud * spread);
      m.position.copy(from.lerp(mine[k], p3));
    });
    nnLines.visible = p3 > 0.95;
    parts[3].built = p3;

    // 5. The collection closes around the cloud.
    const p4 = phase(time, 4, 4.7);
    P4.group.position.y = Y.cloud * spread;
    P4.group.visible = p4 > 0.01;
    P4.group.scale.set(1, Math.max(0.01, p4), 1);
    P4.group.rotation.y = now * 0.00012;
    parts[4].built = p4;

    // 6. Question, links, answer card, thread.
    const ask = phase(time, 5, 5.35);
    P5.group.visible = ask > 0.01;
    query.position.set(0.7 * dir, Y.cloud * spread + 2.2 - ask * 1.9, 0);
    const lp = linkGeo.attributes.position;
    const lo = phase(time, 5.3, 5.55);
    [0, 1, 2].forEach((k) => {
      const m = minePts[k].position.clone().add(new Vector3(0, P3.group.position.y, 0));
      lp.setXYZ(k * 2, query.position.x, query.position.y, query.position.z);
      lp.setXYZ(k * 2 + 1, MathUtils.lerp(query.position.x, m.x, lo), MathUtils.lerp(query.position.y, m.y, lo), MathUtils.lerp(query.position.z, m.z, lo));
    });
    lp.needsUpdate = true;
    links.visible = lo > 0.01;
    const show = phase(time, 5.45, 5.85);
    card.visible = show > 0.01;
    card.position.set(-0.6 * dir, Y.answer * spread + (1 - show) * 0.6 + Math.sin(now * 0.001) * 0.05, 0.9);
    card.scale.setScalar(0.85 + 0.15 * show);
    saffronLight.intensity = 14 * show;
    const draw = phase(time, 5.7, 6);
    if (draw > 0) buildThread();
    if (thread.mesh) {
      thread.mesh.visible = draw > 0;
      thread.mesh.geometry.setDrawRange(0, Math.floor(thread.count * draw / 3) * 3);
    }
    parts[5].built = show;
    P5.anchor.copy(card.position).add(new Vector3(1.35 * dir, 0.86, 0));
  }

  // ----- Camera and interaction -----
  const view = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, dragging: false, idle: 0 };
  let active = -1;
  let hover = -1;

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloom?.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  // The camera starts close to the page and pulls back as the model grows, so the frame is
  // never mostly empty.
  function placeCamera() {
    const narrow = camera.aspect < 1;
    const grow = easeOut(t / 5.6);
    const far = narrow ? 21 + (1 - camera.aspect) * 10 : 18.5;
    const dist = MathUtils.lerp(far * 0.72, far, grow);
    const pitch = 0.5 - 0.08 * grow + view.pitch;
    const yaw = 0.62 * dir;
    camera.position.set(Math.sin(yaw) * dist * Math.cos(pitch), MathUtils.lerp(0.4, 2.6, grow) + Math.sin(pitch) * dist, Math.cos(yaw) * dist * Math.cos(pitch));
    camera.lookAt(0, MathUtils.lerp(0.5, narrow ? 2.9 : 2.7, grow), 0);
  }

  // Overlay: numbered markers on the parts, the detail panel, and a hint.
  const ui = document.createElement('div');
  ui.className = 'xp';
  ui.innerHTML = `<p class="xp__hint">${hint}</p><div class="xp__panel" role="region" aria-live="polite" hidden><button class="xp__close" type="button" aria-label="${closeLabel}">×</button><p class="xp__n"></p><h3 class="xp__title"></h3><div class="xp__body"></div></div>`;
  container.append(ui);
  const panel = ui.querySelector('.xp__panel');
  const spots = parts.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'xp__spot';
    b.innerHTML = `<span>${local(p.i + 1)}</span>`;
    b.setAttribute('aria-label', steps[p.i]?.title || String(p.i + 1));
    b.hidden = true;
    b.addEventListener('click', (e) => { e.stopPropagation(); select(p.i); });
    ui.append(b);
    return b;
  });
  const select = (i) => {
    active = i;
    spots.forEach((s, k) => s.classList.toggle('is-active', k === i));
    if (i < 0) { panel.hidden = true; opts.onSelect?.(-1); return; }
    const s = steps[i] || {};
    panel.querySelector('.xp__n').textContent = local(String(i + 1).padStart(2, '0'));
    panel.querySelector('.xp__title').textContent = s.title || '';
    panel.querySelector('.xp__body').innerHTML = s.html || '';
    panel.hidden = false;
    panel.classList.remove('is-in');
    requestAnimationFrame(() => panel.classList.add('is-in'));
    opts.onSelect?.(i);
  };
  panel.querySelector('.xp__close').addEventListener('click', () => select(-1));

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = parts.filter((p) => p.built > 0.5).map((p) => p.group);
    if (thread.mesh?.visible) targets.push(thread.mesh);
    const hit = raycaster.intersectObjects(targets, true)[0];
    let o = hit?.object;
    while (o && o.userData.part === undefined) o = o.parent;
    return o ? o.userData.part : -1;
  };

  let down = null;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    view.dragging = true;
  });
  addEventListener('pointermove', (e) => {
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 5) {
        down.moved = true;
        if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) { down = null; view.dragging = false; return; }
        canvas.setPointerCapture?.(e.pointerId);
      }
      if (down.moved) {
        view.vyaw = (e.clientX - (down.lx ?? down.x)) * 0.006;
        view.vpitch = e.pointerType === 'touch' ? 0 : (e.clientY - (down.ly ?? down.y)) * 0.003;
        down.lx = e.clientX;
        down.ly = e.clientY;
      }
      return;
    }
    if (e.target !== canvas || e.pointerType === 'touch') return;
    const p = pick(e);
    if (p !== hover) {
      hover = p;
      canvas.style.cursor = p >= 0 ? 'pointer' : 'grab';
    }
  });
  const up = (e) => {
    if (!down || down.id !== e.pointerId) return;
    if (!down.moved && e.target === canvas) {
      const p = pick(e);
      select(p === active ? -1 : p);
    }
    down = null;
    view.dragging = false;
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hover = -1; });

  // ----- Loop -----
  let visible = false;
  let raf = 0;
  let last = performance.now();
  const anchorWorld = new Vector3();
  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Drag with inertia; a slow turn when nobody is holding it and no panel is open.
    view.yaw += view.vyaw;
    view.pitch = MathUtils.clamp(view.pitch + view.vpitch, -0.25, 0.35);
    view.vyaw *= view.dragging ? 0.5 : 0.92;
    view.vpitch *= view.dragging ? 0.5 : 0.85;
    if (!view.dragging && active < 0 && Math.abs(view.vyaw) < 0.001) view.yaw += dt * 0.06 * dir;
    model.rotation.y = dir * (-0.4 + t * 0.05) + view.yaw;
    ringA.rotation.z = now * 0.00006;
    ringB.rotation.z = -now * 0.00004;
    dustPts.rotation.y = now * 0.00002;

    layout(t, now);
    // The answer card turns to face the viewer whatever the rotation.
    card.rotation.set(-0.18, -model.rotation.y + 0.35 * dir, 0);

    // Glow: the step in view, a hovered part and a selected part burn brighter.
    const focus = active >= 0 ? active : Math.min(5, Math.floor(t + 0.05));
    parts.forEach((p) => {
      const k = p.i === focus ? 1.25 : p.i === hover ? 1.15 : 0.7;
      p.glows.forEach((g) => { g.mat.opacity = Math.min(1, g.base * k + (p.i === focus ? 0.15 : 0)); });
    });
    pageEdge.material.opacity = focus === 0 ? 0.9 : 0;

    placeCamera();
    model.updateMatrixWorld(true);
    // Markers follow their parts on screen.
    const w = container.clientWidth;
    const h = container.clientHeight;
    parts.forEach((p, k) => {
      const s = spots[k];
      const show = p.built > 0.9;
      s.hidden = !show;
      if (!show) return;
      anchorWorld.copy(p.anchor);
      (p.i === 5 ? model : p.group).localToWorld(anchorWorld);
      anchorWorld.project(camera);
      s.style.transform = `translate(${((anchorWorld.x + 1) / 2) * w}px, ${((1 - anchorWorld.y) / 2) * h}px)`;
    });

    if (composer) composer.render();
    else renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (!raf && visible) {
      last = performance.now();
      if (!introStart) introStart = last;
      raf = requestAnimationFrame(frame);
    }
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }, { rootMargin: '120px' }).observe(container);
  document.addEventListener('visibilitychange', start);

  return {
    canvas,
    setTime(next) { t = MathUtils.clamp(next, 0, 6); start(); },
    select,
  };
}
