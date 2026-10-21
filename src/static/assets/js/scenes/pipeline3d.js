// "How it works" in 3D: an assembly line of six stations on one long platform. The camera
// travels along it as the pinned scroll advances (time t from 0 to 6, one unit per step):
//
//   1 Upload     a page passes through an intake gate; its type, size and structure are checked
//   2 Read       a scanner bar sweeps the page and lifts its recognized lines off it
//   3 Passages   the lines regroup into passage cards, each tagged with its page
//   4 Index      each card becomes a point in a vector space; its words join a keyword index
//   5 Keep       the points are filed in this conversation's drawer
//   6 Answer     a question pulls three points into a cited answer, and a citation arc runs
//                back to the highlighted passage on the page, seen in one long final shot
//
// Every label is real text in the page's language. The scene is built over several frames and
// its shaders compile asynchronously, so loading it never blocks scrolling. It renders only
// while on screen. Dragging turns the camera a little; selecting a station goes to its step.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, CylinderGeometry,
  SphereGeometry, TorusGeometry, TubeGeometry, InstancedMesh, BoxGeometry, EdgesGeometry,
  MeshBasicMaterial, MeshStandardMaterial, LineBasicMaterial, LineSegments, CanvasTexture,
  SRGBColorSpace, Vector2, Vector3, CatmullRomCurve3, Color, Object3D, AdditiveBlending,
  Sprite, SpriteMaterial, DirectionalLight, PointLight, HemisphereLight, Fog, Raycaster,
  RepeatWrapping, ACESFilmicToneMapping, Shape, ExtrudeGeometry, MathUtils, BufferGeometry,
  Float32BufferAttribute,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BG = '#06090e';
const TURQ = new Color('#3ee0cf');
const SAFFRON = new Color('#f6b94d');
const LAPIS = new Color('#8fa6ff');
const GAP = 7;
const FONT = 'Vazirmatn, system-ui, sans-serif';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
const phase = (t, a, b) => ease((t - a) / (b - a));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- Canvas text ----------

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function texture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Splits text into lines that fit `width` at the context's current font. */
function wrap(ctx, text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** A pill label: text on a dark or tinted rounded background. Returns { tex, aspect }. */
function pill(text, { rtl, color = '#e8eef4', bg = 'rgba(10,15,21,0.92)', ring = 'rgba(255,255,255,0.16)', size = 44, weight = 650, pad = 30, icon } = {}) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${weight} ${size}px ${FONT}`;
  const tw = Math.ceil(probe.measureText(text).width);
  const iw = icon ? size * 1.1 : 0;
  const w = tw + iw + pad * 2;
  const h = Math.round(size * 1.9);
  const tex = texture(w, h, (ctx) => {
    rr(ctx, 2, 2, w - 4, h - 4, (h - 4) / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    const x0 = rtl ? w - pad : pad;
    if (icon) icon(ctx, rtl ? w - pad - size * 0.8 : pad, h / 2, size * 0.8, color);
    ctx.fillText(text, rtl ? x0 - iw : x0 + iw, h / 2 + size * 0.06);
  });
  return { tex, aspect: w / h };
}

const check = (ctx, x, y, s, color) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, y);
  ctx.lineTo(x + s * 0.38, y + s * 0.28);
  ctx.lineTo(x + s * 0.9, y - s * 0.3);
  ctx.stroke();
  ctx.restore();
};

function sprite(label, height) {
  const m = new Sprite(new SpriteMaterial({ map: label.tex, transparent: true, depthWrite: false }));
  m.scale.set(height * label.aspect, height, 1);
  m.renderOrder = 5;
  return m;
}

function glowTexture() {
  return texture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// ---------- The scene ----------

export function createPipeline(container, opts) {
  const { rtl, lang, steps, onSelect, onReady } = opts;
  const dir = rtl ? -1 : 1;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const digits = (s) => (lang === 'fa' ? String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(s));
  const pageLabel = (a, b) => digits(b ? `${lang === 'fa' ? 'ص' : 'p.'} ${a}–${b}` : `${lang === 'fa' ? 'ص' : 'p.'} ${a}`);
  const sx = (i) => dir * i * GAP; // station x
  let time = 0;
  let disposed = false;
  let built = false;

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.6 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(BG);
  const canvas = renderer.domElement;
  canvas.className = 'jstage__gl';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  scene.fog = new Fog(BG, 16, 46);
  const camera = new PerspectiveCamera(36, 1, 0.1, 140);

  scene.add(new HemisphereLight('#cfeeff', '#06080c', 0.85));
  const sun = new DirectionalLight('#ffffff', 1.5);
  sun.position.set(6 * dir, 12, 9);
  scene.add(sun);
  const spot = new PointLight(TURQ, 16, 13, 1.6);
  scene.add(spot);

  const glowTex = glowTexture();
  const glowSprite = (color, size, opacity = 0.6) => {
    const s = new Sprite(new SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  };

  const pickables = [];
  const stations = [];
  const anim = []; // per-frame updaters: (t, now) => void

  // ---------- Platform and conveyor ----------
  function buildPlatform() {
    const len = 5 * GAP + 10;
    const mid = sx(2.5);
    const base = new Mesh(
      new RoundedBoxGeometry(len, 0.6, 7.4, 4, 0.25),
      new MeshStandardMaterial({ color: '#0b1118', metalness: 0.55, roughness: 0.5 }),
    );
    base.position.set(mid, -0.3, 0);
    scene.add(base);
    // A fine grid engraved on top.
    const gridTex = texture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0b1118';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(62,224,207,0.09)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
      }
    });
    gridTex.wrapS = gridTex.wrapT = RepeatWrapping;
    gridTex.repeat.set(len / 2, 7.4 / 2);
    const top = new Mesh(new PlaneGeometry(len - 0.4, 7), new MeshStandardMaterial({ map: gridTex, metalness: 0.4, roughness: 0.6 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(mid, 0.005, 0);
    scene.add(top);
    // The conveyor: chevrons that flow in reading direction.
    const chevTex = texture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(62,224,207,0.9)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const x = 26 + i * 64;
        ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 16, 32); ctx.lineTo(x, 50); ctx.stroke();
      }
    });
    chevTex.wrapS = RepeatWrapping;
    chevTex.repeat.set((len - 4) / 2.4 * dir, 1);
    const belt = new Mesh(new PlaneGeometry(len - 4, 0.42), new MeshBasicMaterial({ map: chevTex, transparent: true, opacity: 0.38, depthWrite: false }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(mid, 0.02, 2.55);
    scene.add(belt);
    anim.push((t, now) => { chevTex.offset.x = -now * 0.00035; });
  }

  // ---------- Stations: pedestal, ring and title ----------
  function buildStation(i) {
    const g = new Group();
    g.position.x = sx(i);
    g.userData.station = i;
    const ped = new Mesh(
      new CylinderGeometry(2.15, 2.3, 0.16, small ? 48 : 72),
      new MeshStandardMaterial({ color: '#111923', metalness: 0.7, roughness: 0.35 }),
    );
    ped.position.y = 0.08;
    g.add(ped);
    const ringMat = new MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0.35 });
    const ring = new Mesh(new TorusGeometry(2.2, 0.018, 8, small ? 64 : 96), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    g.add(ring);
    const title = sprite(pill(`${digits(String(i + 1).padStart(2, '0'))}   ${steps[i]?.title || ''}`, { rtl, size: 46, color: '#dffaf6', ring: 'rgba(62,224,207,0.55)' }), 0.36);
    title.position.set(0, 0.62, 2.35);
    g.add(title);
    scene.add(g);
    pickables.push(ped);
    stations.push({ group: g, ringMat, title });
    return g;
  }

  // ---------- 1 Upload: the page and the intake gate ----------
  let page;
  let highlight;
  const PAGE_W = 2.0;
  const PAGE_H = 2.6;
  function buildPage(doc) {
    const tex = texture(800, 1040, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#f4f6f8');
      bg.addColorStop(1, '#e3e8ed');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.textAlign = rtl ? 'right' : 'left';
      const L = 70;
      const R = w - 70;
      const x0 = rtl ? R : L;
      // File tag and title.
      ctx.fillStyle = '#d1503c';
      rr(ctx, rtl ? R - 84 : L, 58, 84, 40, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PDF', rtl ? R - 42 : L + 42, 86);
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillStyle = '#13202b';
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(doc.title, x0, 168);
      ctx.fillStyle = '#6b7884';
      ctx.font = `500 24px ${FONT}`;
      ctx.fillText(doc.name, x0, 208);
      // Body text, the cited passage highlighted.
      ctx.font = `500 27px ${FONT}`;
      let y = 278;
      const para = (text, mark) => {
        const lines = wrap(ctx, text, R - L);
        if (mark) {
          ctx.fillStyle = 'rgba(246,185,77,0.42)';
          rr(ctx, L - 14, y - 34, R - L + 28, lines.length * 44 + 18, 10);
          ctx.fill();
          highlight = { top: y - 34, height: lines.length * 44 + 18 };
        }
        ctx.fillStyle = '#22303c';
        for (const line of lines) { ctx.fillText(line, x0, y); y += 44; }
        y += 26;
      };
      para(doc.p1);
      para(doc.p2, true);
      // A small table.
      ctx.strokeStyle = '#9aa6b1';
      ctx.lineWidth = 2;
      const ty = y;
      for (let r = 0; r <= 3; r++) { ctx.beginPath(); ctx.moveTo(L, ty + r * 46); ctx.lineTo(R, ty + r * 46); ctx.stroke(); }
      for (const c of [0, 0.42, 0.72, 1]) { ctx.beginPath(); ctx.moveTo(L + (R - L) * c, ty); ctx.lineTo(L + (R - L) * c, ty + 138); ctx.stroke(); }
      ctx.fillStyle = '#b8c2cb';
      for (let r = 0; r < 3; r++) for (const [a, b] of [[0.04, 0.3], [0.46, 0.64], [0.76, 0.94]]) {
        const xa = L + (R - L) * (rtl ? 1 - b : a);
        ctx.fillRect(xa, ty + 18 + r * 46, (R - L) * (b - a), 10);
      }
      // Remaining lines as grey bars, and the page number.
      y = ty + 190;
      ctx.fillStyle = '#c3ccd4';
      for (let k = 0; k < 4 && y < h - 120; k++, y += 40) {
        const lw = (R - L) * (k === 3 ? 0.55 : 0.94);
        ctx.fillRect(rtl ? R - lw : L, y, lw, 12);
      }
      ctx.fillStyle = '#7b8792';
      ctx.font = `600 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(digits('3'), w / 2, h - 48);
      highlight.k = 2.6 / h; // world units per texture pixel (page height 2.6)
    });
    const paper = new MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0 });
    const side = new MeshStandardMaterial({ color: '#cfd6dc', roughness: 0.8 });
    page = new Mesh(new BoxGeometry(PAGE_W, PAGE_H, 0.035), [side, side, side, side, paper, side]);
    scene.add(page);
    // The cited passage's glow, used when the citation comes back.
    const hl = highlight;
    const hy = PAGE_H / 2 - (hl.top + hl.height / 2) * hl.k;
    const glowMat = new MeshBasicMaterial({ color: SAFFRON, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const hlMesh = new Mesh(new PlaneGeometry(PAGE_W * 0.96, hl.height * hl.k * 1.1), glowMat);
    hlMesh.position.set(0, hy, 0.022);
    page.add(hlMesh);
    page.userData.hl = { mesh: hlMesh, mat: glowMat, y: hy };
  }

  let gate;
  let checks = [];
  let gateScan;
  function buildGate() {
    gate = new Group();
    gate.position.set(sx(0), 0.16, 0);
    // A rounded frame with an open center.
    const W = 2.7;
    const H = 3.3;
    const t = 0.16;
    const outer = new Shape();
    const r = 0.38;
    outer.moveTo(-W / 2 + r, 0);
    outer.lineTo(W / 2 - r, 0); outer.quadraticCurveTo(W / 2, 0, W / 2, r);
    outer.lineTo(W / 2, H - r); outer.quadraticCurveTo(W / 2, H, W / 2 - r, H);
    outer.lineTo(-W / 2 + r, H); outer.quadraticCurveTo(-W / 2, H, -W / 2, H - r);
    outer.lineTo(-W / 2, r); outer.quadraticCurveTo(-W / 2, 0, -W / 2 + r, 0);
    const hole = new Shape();
    const iw = W - t * 2;
    const ih = H - t * 2;
    const ir = r - t * 0.6;
    hole.moveTo(-iw / 2 + ir, t);
    hole.lineTo(iw / 2 - ir, t); hole.quadraticCurveTo(iw / 2, t, iw / 2, t + ir);
    hole.lineTo(iw / 2, t + ih - ir); hole.quadraticCurveTo(iw / 2, t + ih, iw / 2 - ir, t + ih);
    hole.lineTo(-iw / 2 + ir, t + ih); hole.quadraticCurveTo(-iw / 2, t + ih, -iw / 2, t + ih - ir);
    hole.lineTo(-iw / 2, t + ir); hole.quadraticCurveTo(-iw / 2, t, -iw / 2 + ir, t);
    outer.holes.push(hole);
    const frame = new Mesh(
      new ExtrudeGeometry(outer, { depth: 0.32, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 }),
      new MeshStandardMaterial({ color: '#16212c', metalness: 0.8, roughness: 0.3, emissive: TURQ, emissiveIntensity: 0.08 }),
    );
    frame.position.z = -0.16;
    gate.add(frame);
    // Lit inner edge.
    const edge = new LineSegments(new EdgesGeometry(new PlaneGeometry(iw, ih)), new LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.9 }));
    edge.position.set(0, t + ih / 2, 0.18);
    gate.add(edge);
    // The checking light: a bright bar that sweeps down the opening.
    gateScan = new Mesh(new PlaneGeometry(iw, 0.05), new MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    gateScan.position.z = 0.2;
    gate.add(gateScan);
    const gl = glowSprite(TURQ, 5.5, 0.18);
    gl.position.set(0, H / 2, -0.4);
    gate.add(gl);
    scene.add(gate);
    pickables.push(frame);
    frame.userData.station = 0;
    // Three checks pop out beside the gate.
    checks = (opts.checks || ['Type', 'Size', 'Structure']).map((label, k) => {
      const s = sprite(pill(label, { rtl, size: 40, color: '#bff7ef', ring: 'rgba(62,224,207,0.6)', icon: check }), 0.3);
      s.position.set(sx(0) + dir * 2.0, 2.45 - k * 0.5, 0.6);
      s.material.opacity = 0;
      scene.add(s);
      return s;
    });
    const tag = sprite(pill(opts.file, { rtl, size: 38, color: '#ffd9cf', ring: 'rgba(209,80,60,0.7)', bg: 'rgba(40,14,10,0.92)' }), 0.3);
    tag.position.set(sx(0) - dir * 1.85, 3.25, 0.4);
    tag.material.opacity = 0;
    scene.add(tag);
    checks.tag = tag;
  }

  // ---------- 2 Read: lightbox, scanner and lifted lines ----------
  let scanner;
  let strips = [];
  let lightbox;
  let ocrTag;
  function buildReader(doc) {
    lightbox = new Mesh(
      new RoundedBoxGeometry(2.7, 0.14, 3.2, 3, 0.06),
      new MeshStandardMaterial({ color: '#0f1a22', emissive: TURQ, emissiveIntensity: 0.18, metalness: 0.5, roughness: 0.4 }),
    );
    lightbox.position.set(sx(1), 0.24, 0.2);
    scene.add(lightbox);
    pickables.push(lightbox);
    lightbox.userData.station = 1;
    scanner = new Group();
    const bar = new Mesh(new BoxGeometry(2.6, 0.06, 0.12), new MeshStandardMaterial({ color: '#1b2a35', emissive: TURQ, emissiveIntensity: 1.4 }));
    scanner.add(bar);
    const beam = new Mesh(new PlaneGeometry(2.5, 0.5), new MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, side: 2 }));
    beam.rotation.x = Math.PI / 2;
    beam.position.y = -0.08;
    scanner.add(beam);
    const bg = glowSprite(TURQ, 3.4, 0.35);
    scanner.add(bg);
    scanner.visible = false;
    scene.add(scanner);
    // Recognized lines: real text from the cited passage, white on dark glass.
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `600 40px ${FONT}`;
    const lines = wrap(probe, doc.p2, 980).slice(0, 4);
    const all = [...wrap(probe, doc.p1, 980).slice(0, 2), ...lines];
    strips = all.map((text, k) => {
      const tex = texture(1024, 88, (ctx, w, h) => {
        rr(ctx, 2, 2, w - 4, h - 4, 16);
        ctx.fillStyle = k >= 2 ? 'rgba(40,30,10,0.9)' : 'rgba(9,18,24,0.9)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = k >= 2 ? 'rgba(246,185,77,0.75)' : 'rgba(62,224,207,0.6)';
        ctx.stroke();
        ctx.font = `600 40px ${FONT}`;
        ctx.fillStyle = k >= 2 ? '#ffe6b8' : '#dffaf6';
        ctx.textBaseline = 'middle';
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.fillText(text, rtl ? w - 26 : 26, h / 2 + 2);
      });
      const m = new Mesh(new PlaneGeometry(2.5, 0.215), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      m.renderOrder = 4;
      scene.add(m);
      return m;
    });
    ocrTag = sprite(pill(opts.ocr || 'fas+eng', { rtl, size: 38, color: '#dffaf6', ring: 'rgba(62,224,207,0.6)' }), 0.32);
    ocrTag.position.set(sx(1) + dir * 1.7, 0.75, 1.5);
    ocrTag.material.opacity = 0;
    scene.add(ocrTag);
  }

  // ---------- 3 Passages: four cards ----------
  let cards = [];
  const CARD_POS = [[-1.0, 2.25], [1.0, 2.25], [-1.0, 1.0], [1.0, 1.0]];
  function buildCards(doc) {
    const sentences = (s) => s.split(/(?<=[.!؟?])\s+/).filter(Boolean);
    const b2 = sentences(doc.p1);
    const b3 = sentences(doc.p2);
    const defs = [
      { tag: pageLabel(2), text: b2.slice(0, 2).join(' ') },
      { tag: pageLabel(3), text: b3[0] || doc.p2, cited: true },
      { tag: pageLabel(2, 3), text: `${b2[b2.length - 1] || ''} ${b3[0] || ''}`, bridge: true },
      { tag: pageLabel(3), text: b3.slice(1).join(' ') || doc.p2 },
    ];
    cards = defs.map((d, k) => {
      const accent = d.bridge ? '#f6b94d' : '#3ee0cf';
      const tex = texture(640, 400, (ctx, w, h) => {
        rr(ctx, 3, 3, w - 6, h - 6, 30);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, d.bridge ? 'rgba(48,34,10,0.95)' : 'rgba(12,24,30,0.95)');
        g.addColorStop(1, d.bridge ? 'rgba(28,20,8,0.95)' : 'rgba(8,14,20,0.95)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.font = `700 34px ${FONT}`;
        const tw = ctx.measureText(d.tag).width + 36;
        ctx.fillStyle = d.bridge ? 'rgba(246,185,77,0.22)' : 'rgba(62,224,207,0.18)';
        rr(ctx, rtl ? w - 30 - tw : 30, 28, tw, 54, 27);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.textBaseline = 'middle';
        ctx.fillText(d.tag, rtl ? w - 48 : 48, 56);
        ctx.font = `500 30px ${FONT}`;
        ctx.fillStyle = '#d7e3ea';
        ctx.textBaseline = 'alphabetic';
        const lines = wrap(ctx, d.text, w - 70);
        lines.slice(0, 5).forEach((line, i) => {
          const last = i === 4 && lines.length > 5;
          ctx.fillText(last ? `${line} …` : line, rtl ? w - 35 : 35, 140 + i * 50);
        });
      });
      const m = new Mesh(new RoundedBoxGeometry(1.9, 1.19, 0.05, 2, 0.04), new MeshStandardMaterial({ color: '#0d161d', metalness: 0.3, roughness: 0.5 }));
      const face = new Mesh(new PlaneGeometry(1.9, 1.19), new MeshBasicMaterial({ map: tex, transparent: true }));
      face.position.z = 0.027;
      m.add(face);
      m.userData = { face, accent: d.bridge ? SAFFRON : TURQ, cited: d.cited };
      m.visible = false;
      scene.add(m);
      pickables.push(m);
      m.userData.station = 2;
      return m;
    });
  }

  // ---------- 4 Index: vector space and keyword column ----------
  let cube;
  let cloud;
  let dots = [];
  let links;
  let keywords = [];
  let vecLabel;
  let kwLabel;
  const DOT_POS = [[0.35, 0.55, 0.1], [0.62, 0.32, -0.2], [0.48, 0.12, 0.35], [-0.5, -0.35, 0.3]];
  function buildIndex(doc) {
    const c = new Vector3(sx(3) - dir * 0.75, 1.9, 0);
    cube = new Group();
    cube.position.copy(c);
    const box = new LineSegments(new EdgesGeometry(new BoxGeometry(2.4, 2.4, 2.4)), new LineBasicMaterial({ color: LAPIS, transparent: true, opacity: 0.45 }));
    cube.add(box);
    // Axes.
    const axes = new LineSegments(
      new EdgesGeometry(new BoxGeometry(2.4, 0.0001, 0.0001)),
      new LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.4 }),
    );
    cube.add(axes);
    scene.add(cube);
    const r = rng(7);
    const count = small ? 60 : 110;
    cloud = new InstancedMesh(new SphereGeometry(0.04, 8, 6), new MeshBasicMaterial({ color: '#6f7f99', transparent: true, opacity: 0.85 }), count);
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      // Two loose clusters plus scatter, like other documents' passages.
      const k = r();
      const cx = k < 0.4 ? -0.5 : k < 0.75 ? 0.4 : 0;
      const cy = k < 0.4 ? 0.4 : k < 0.75 ? -0.45 : 0;
      o.position.set(cx + (r() - 0.5) * (k < 0.75 ? 0.9 : 2.1), cy + (r() - 0.5) * (k < 0.75 ? 0.9 : 2.1), (r() - 0.5) * 2.1);
      o.updateMatrix();
      cloud.setMatrixAt(i, o.matrix);
    }
    cube.add(cloud);
    dots = DOT_POS.map(([x, y, z], k) => {
      const color = k === 2 ? SAFFRON : TURQ;
      const m = new Mesh(new SphereGeometry(0.1, 16, 12), new MeshBasicMaterial({ color }));
      m.position.set(x * dir, y, z);
      m.add(glowSprite(color, 0.7, 0.75));
      m.visible = false;
      cube.add(m);
      return m;
    });
    pickables.push(box);
    box.userData.station = 3;
    // Links between this page's passages: its nearest neighbours.
    const pts = [];
    for (let i = 0; i < 3; i++) pts.push(...dots[i].position.toArray(), ...dots[i + 1].position.toArray());
    const lg = new BufferGeometry();
    lg.setAttribute('position', new Float32BufferAttribute(pts, 3));
    links = new LineSegments(lg, new LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0 }));
    cube.add(links);
    // Keyword column: words from the passage.
    const stop = new Set((opts.stopwords || []).map((w) => w.toLowerCase()));
    const words = [...new Set(doc.p2.replace(/[.,،؛:!؟?()]/g, '').split(/\s+/).filter((w) => w.length > 3 && !stop.has(w.toLowerCase())))].slice(0, 5);
    keywords = words.map((w, k) => {
      const s = sprite(pill(w, { rtl, size: 38, color: k === 1 ? '#ffe6b8' : '#dfe6ff', ring: k === 1 ? 'rgba(246,185,77,0.7)' : 'rgba(143,166,255,0.6)' }), 0.3);
      s.position.set(sx(3) + dir * 1.75, 3.0 - k * 0.42, 0.4);
      s.material.opacity = 0;
      scene.add(s);
      return s;
    });
    vecLabel = sprite(pill(opts.vecLabel || 'Vectors', { rtl, size: 36, color: '#c9d4ff', bg: 'rgba(14,18,34,0.92)', ring: 'rgba(143,166,255,0.5)' }), 0.28);
    vecLabel.position.set(c.x, 3.35, 0);
    kwLabel = sprite(pill(opts.kwLabel || 'Keywords', { rtl, size: 36, color: '#c9d4ff', bg: 'rgba(14,18,34,0.92)', ring: 'rgba(143,166,255,0.5)' }), 0.28);
    kwLabel.position.set(sx(3) + dir * 1.75, 3.45, 0.4);
    for (const s of [vecLabel, kwLabel]) { s.material.opacity = 0; scene.add(s); }
  }

  // ---------- 5 Keep: the conversation drawers ----------
  let cabinet;
  let drawers = [];
  function buildCabinet() {
    cabinet = new Group();
    cabinet.position.set(sx(4), 0.17, -0.2);
    const body = new Mesh(
      new RoundedBoxGeometry(2.8, 3.1, 1.7, 3, 0.08),
      new MeshStandardMaterial({ color: '#0d151d', metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.94 }),
    );
    body.position.y = 1.55;
    cabinet.add(body);
    const edge = new LineSegments(new EdgesGeometry(new BoxGeometry(2.8, 3.1, 1.7)), new LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.35 }));
    edge.position.y = 1.55;
    cabinet.add(edge);
    const names = [opts.collection || 'This conversation', opts.other || 'Another conversation', opts.other || 'Another conversation'];
    drawers = names.map((name, k) => {
      const lit = k === 0;
      const d = new Group();
      const front = new Mesh(
        new RoundedBoxGeometry(2.5, 0.8, 1.55, 2, 0.05),
        new MeshStandardMaterial({ color: lit ? '#12242a' : '#111820', metalness: 0.5, roughness: 0.4, emissive: lit ? TURQ : '#000', emissiveIntensity: lit ? 0.12 : 0 }),
      );
      d.add(front);
      const label = pill(name, { rtl, size: 40, color: lit ? '#dffaf6' : '#7f8c99', ring: lit ? 'rgba(62,224,207,0.7)' : 'rgba(255,255,255,0.12)' });
      const plate = new Mesh(new PlaneGeometry(0.34 * label.aspect, 0.34), new MeshBasicMaterial({ map: label.tex, transparent: true }));
      plate.position.set(0, 0, 0.78);
      d.add(plate);
      d.position.set(0, 2.55 - k * 0.98, 0.1);
      cabinet.add(d);
      return { group: d, lit };
    });
    // The four points, filed in the lit drawer.
    drawers[0].slots = DOT_POS.map((_, k) => new Vector3((k - 1.5) * 0.42 * dir, 0.48, 0.25));
    scene.add(cabinet);
    pickables.push(body);
    body.userData.station = 4;
    cabinet.visible = false;
  }

  // ---------- 6 Answer: question, answer card and the citation arc ----------
  let question;
  let answer;
  let arc;
  let arcGlow;
  let arcCount = 0;
  let flyers = [];
  function buildAnswer() {
    const qTex = texture(1100, 170, (ctx, w, h) => {
      rr(ctx, 3, 3, w - 6, h - 6, 40);
      ctx.fillStyle = 'rgba(14,20,34,0.95)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(143,166,255,0.7)';
      ctx.stroke();
      ctx.font = `600 42px ${FONT}`;
      ctx.fillStyle = '#e6ebff';
      ctx.textBaseline = 'middle';
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.textAlign = rtl ? 'right' : 'left';
      const lines = wrap(ctx, opts.question, w - 90).slice(0, 2);
      lines.forEach((line, i) => ctx.fillText(line, rtl ? w - 45 : 45, h / 2 + (i - (lines.length - 1) / 2) * 52));
    });
    question = new Mesh(new PlaneGeometry(3.2, 3.2 * 170 / 1100), new MeshBasicMaterial({ map: qTex, transparent: true, opacity: 0, depthWrite: false }));
    question.position.set(sx(5), 3.75, 0.2);
    question.renderOrder = 6;
    scene.add(question);

    const aTex = texture(1000, 640, (ctx, w, h) => {
      rr(ctx, 3, 3, w - 6, h - 6, 40);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(14,26,32,0.97)');
      g.addColorStop(1, 'rgba(8,13,18,0.97)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(62,224,207,0.65)';
      ctx.stroke();
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.textAlign = rtl ? 'right' : 'left';
      const x0 = rtl ? w - 50 : 50;
      ctx.font = `700 34px ${FONT}`;
      ctx.fillStyle = '#3ee0cf';
      ctx.fillText(opts.answerTitle, x0, 76);
      ctx.font = `500 38px ${FONT}`;
      ctx.fillStyle = '#e6eef3';
      const lines = wrap(ctx, opts.answerText, w - 120);
      let y = 160;
      lines.slice(0, 4).forEach((line) => { ctx.fillText(line, x0, y); y += 58; });
      // Numbered citation chips.
      ctx.font = `700 30px ${FONT}`;
      ctx.textBaseline = 'middle';
      for (let k = 0; k < 3; k++) {
        const cx = rtl ? w - 50 - 22 - k * 62 : 50 + 22 + k * 62;
        ctx.beginPath();
        ctx.arc(cx, h - 150, 24, 0, Math.PI * 2);
        ctx.fillStyle = k === 0 ? 'rgba(246,185,77,0.25)' : 'rgba(62,224,207,0.18)';
        ctx.fill();
        ctx.fillStyle = k === 0 ? '#f6b94d' : '#3ee0cf';
        ctx.textAlign = 'center';
        ctx.fillText(digits(String(k + 1)), cx, h - 148);
      }
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.font = `600 30px ${FONT}`;
      ctx.fillStyle = '#9fb0bd';
      ctx.fillText(opts.cite, x0, h - 70);
    });
    answer = new Group();
    const back = new Mesh(new RoundedBoxGeometry(3.3, 2.1, 0.06, 2, 0.05), new MeshStandardMaterial({ color: '#0b141a', metalness: 0.4, roughness: 0.4 }));
    answer.add(back);
    const face = new Mesh(new PlaneGeometry(3.3, 2.1), new MeshBasicMaterial({ map: aTex, transparent: true }));
    face.position.z = 0.032;
    answer.add(face);
    const ag = glowSprite(TURQ, 6, 0.22);
    ag.position.z = -0.3;
    answer.add(ag);
    answer.position.set(sx(5), 2.0, 0.2);
    answer.visible = false;
    answer.userData.face = face;
    scene.add(answer);
    pickables.push(back);
    back.userData.station = 5;
    // Three points that fly from the drawer to the answer.
    flyers = [0, 1, 2].map((k) => {
      const color = k === 0 ? SAFFRON : TURQ;
      const m = new Mesh(new SphereGeometry(0.1, 16, 12), new MeshBasicMaterial({ color }));
      m.add(glowSprite(color, 0.8, 0.8));
      m.visible = false;
      scene.add(m);
      return m;
    });
  }

  function buildArc() {
    // From the first citation chip on the answer, high over the line, down to the passage.
    const hl = page.userData.hl;
    const start = new Vector3(sx(5) + dir * -1.41, 1.44, 0.26);
    // The page lies face up on the lightbox, its top edge away from the camera.
    const end = new Vector3(sx(1), 0.42, 0.2 - hl.y);
    const curve = new CatmullRomCurve3([
      start,
      new Vector3(sx(4.4), 5.4, 1.2),
      new Vector3(sx(2.6), 6.2, 1.2),
      new Vector3(sx(1.3), 3.0, 0.8),
      end,
    ]);
    const segs = small ? 120 : 220;
    const tube = new TubeGeometry(curve, segs, 0.035, 8, false);
    arc = new Mesh(tube, new MeshBasicMaterial({ color: SAFFRON }));
    arcGlow = new Mesh(new TubeGeometry(curve, segs, 0.13, 8, false), new MeshBasicMaterial({ color: SAFFRON, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }));
    arcCount = tube.index.count;
    arc.geometry.setDrawRange(0, 0);
    arcGlow.geometry.setDrawRange(0, 0);
    scene.add(arc, arcGlow);
    arc.userData.hl = hl;
  }

  // ---------- Camera ----------
  const look = new Vector3();
  const camPos = new Vector3();
  const tmpA = new Vector3();
  const tmpB = new Vector3();
  let portrait = false;
  const stationView = (i, pos, tgt) => {
    const x = sx(i);
    tgt.set(x + dir * (i === 3 ? 0.35 : 0), 1.75, 0);
    const d = portrait ? 14 : 10.6;
    pos.set(x - dir * 2.2, 3.6, d);
  };
  const finalView = (pos, tgt) => {
    // A three-quarter view down the line from in front of the answer: the answer close by,
    // the stations receding to the page, and the citation arc spanning them.
    tgt.set(sx(3.8), 1.4, 0);
    pos.set(sx(5) + dir * (portrait ? 9 : 8), portrait ? 8.5 : 7, portrait ? 8 : 6.5);
  };

  // User orbit offset (drag), with inertia.
  const user = { yaw: 0, pitch: 0, vy: 0, vp: 0 };

  function placeCamera() {
    const k = Math.min(5, Math.floor(time));
    const f = ease((time - k) / 0.42);
    stationView(Math.max(0, k - 1), tmpA, look);
    const fromPos = tmpA.clone();
    const fromLook = look.clone();
    stationView(k, tmpB, look);
    if (k === 0) {
      // The first view arrives from a little further out.
      fromPos.copy(tmpB).add(new Vector3(-dir * 1.5, 1.4, 3));
      fromLook.copy(look);
    }
    camPos.lerpVectors(fromPos, tmpB, f);
    look.lerpVectors(fromLook, look, f);
    const out = phase(time, 5.55, 6.0);
    if (out > 0) {
      finalView(tmpA, tmpB);
      camPos.lerp(tmpA, out);
      look.lerp(tmpB, out);
    }
    const fov = (portrait ? 42 : 36) + out * 10;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // Orbit around the look point by the user's offset.
    const off = camPos.clone().sub(look);
    off.applyAxisAngle(new Vector3(0, 1, 0), user.yaw);
    const right = new Vector3().crossVectors(off, new Vector3(0, 1, 0)).normalize();
    off.applyAxisAngle(right, user.pitch);
    camera.position.copy(look).add(off);
    camera.lookAt(look);
    // In the final shot the answer and the question turn toward the camera.
    if (answer) {
      const yaw = Math.atan2(camera.position.x - answer.position.x, camera.position.z - answer.position.z);
      answer.rotation.y = yaw * out;
      question.rotation.y = yaw * out;
    }
    spot.position.set(look.x + dir * 1.5, 4.2, 2.8);
  }

  // ---------- Timeline ----------
  function update(now) {
    const t = time;
    // 1 Upload: the page drops into the gate and is checked.
    const drop = phase(t, 0.05, 0.6);
    const toReader = phase(t, 1.0, 1.4);
    const pageAt0 = new Vector3(sx(0), 0.16 + 0.08 + PAGE_H / 2 + 0.18, 0.02);
    const pageStart = new Vector3(sx(0) - dir * 2.6, 5.2, 1.2);
    const readerPos = new Vector3(sx(1), 0.36, 0.2);
    page.visible = t > 0.02;
    if (toReader <= 0) {
      page.position.lerpVectors(pageStart, pageAt0, drop);
      page.rotation.set(0, (1 - drop) * dir * 0.6, (1 - drop) * dir * -0.25);
    } else {
      // Glide along the conveyor and lie down on the lightbox.
      const p = toReader;
      tmpA.lerpVectors(pageAt0, readerPos, p);
      tmpA.y += Math.sin(p * Math.PI) * 0.9;
      page.position.copy(tmpA);
      page.rotation.set(-Math.PI / 2 * p + 0.0, 0, 0);
    }
    const scan0 = phase(t, 0.42, 0.85);
    gateScan.material.opacity = scan0 > 0 && scan0 < 1 ? 0.9 : 0;
    gateScan.position.y = 3.1 - scan0 * 2.9;
    checks.forEach((c, k) => {
      const a = phase(t, 0.55 + k * 0.1, 0.75 + k * 0.1);
      c.material.opacity = a;
      c.position.x = sx(0) + dir * (2.0 + (1 - a) * -0.3);
    });
    checks.tag.material.opacity = phase(t, 0.2, 0.45) * (1 - phase(t, 1.0, 1.15));

    // 2 Read: the scanner sweeps; each line lifts as it passes.
    const sweep = phase(t, 1.38, 1.9);
    scanner.visible = t > 1.32 && t < 2.05;
    scanner.position.set(sx(1), 0.62, 0.2 - PAGE_H / 2 + sweep * PAGE_H);
    ocrTag.material.opacity = phase(t, 1.35, 1.6) * (1 - phase(t, 2.0, 2.2));
    const toCards = phase(t, 2.0, 2.45);
    strips.forEach((s, k) => {
      const lift = phase(t, 1.42 + k * 0.07, 1.62 + k * 0.07);
      const rowZ = 0.2 - PAGE_H / 2 + 0.55 + k * 0.32;
      tmpA.set(sx(1), 0.4 + lift * (1.0 + k * 0.32), rowZ + lift * (1.9 - rowZ));
      tmpB.set(sx(2), 1.6, 0.4);
      s.position.lerpVectors(tmpA, tmpB, toCards);
      s.rotation.set(-0.35 * (1 - lift) - (1 - lift) * 1.0, 0, 0);
      s.scale.setScalar(1 - toCards * 0.6);
      s.material.opacity = lift * (1 - phase(t, 2.25, 2.5));
      s.visible = s.material.opacity > 0.01;
    });

    // 3 Passages: four cards assemble.
    const toDots = phase(t, 3.1, 3.6);
    cards.forEach((c, k) => {
      const a = phase(t, 2.2 + k * 0.08, 2.6 + k * 0.08);
      const [cx, cy] = CARD_POS[k];
      tmpA.set(sx(2) + cx * dir, cy + 0.3, 0.2 + (k < 2 ? -0.15 : 0.15));
      // Then each card collapses into its point in the vector space.
      tmpB.copy(dots[k].position).applyMatrix4(cube.matrixWorld);
      c.position.lerpVectors(tmpA, tmpB, toDots);
      c.position.y += (1 - a) * -0.6;
      const s = (0.85 + a * 0.15) * (1 - toDots * 0.95);
      c.scale.setScalar(Math.max(0.001, s));
      c.rotation.set(-0.08, -dir * 0.12 * (k % 2 ? 1 : -1) * (1 - toDots), 0);
      c.visible = a > 0.01 && toDots < 0.98;
      c.userData.face.material.opacity = a;
    });

    // 4 Index: the space and its points, links and keywords.
    const space = phase(t, 2.95, 3.35);
    cube.visible = space > 0.01;
    cube.scale.setScalar(0.6 + space * 0.4);
    cube.children[0].material.opacity = 0.45 * space;
    cloud.material.opacity = 0.85 * space;
    cube.rotation.y = Math.sin(now * 0.00018) * 0.25 + t * 0.12 * dir;
    const filing = phase(t, 4.2, 4.7);
    dots.forEach((d, k) => { d.visible = toDots > 0.85 && (k > 2 || filing <= 0); });
    links.material.opacity = phase(t, 3.55, 3.8) * 0.8 * (1 - filing);
    keywords.forEach((kw, k) => {
      const a = phase(t, 3.35 + k * 0.07, 3.6 + k * 0.07);
      kw.material.opacity = a;
      kw.position.x = sx(3) + dir * (1.75 + (1 - a) * 0.4);
    });
    vecLabel.material.opacity = space;
    kwLabel.material.opacity = phase(t, 3.3, 3.55);

    // 5 Keep: the cabinet appears and the points are filed in this conversation's drawer.
    const cab = phase(t, 3.95, 4.3);
    cabinet.visible = cab > 0.01;
    cabinet.position.y = 0.17 - (1 - cab) * 0.8;
    cabinet.scale.setScalar(0.9 + cab * 0.1);
    const file = phase(t, 4.2, 4.7);
    const open = phase(t, 4.55, 4.85) * (1 - phase(t, 5.15, 5.4) * 0.6);
    drawers[0].group.position.z = 0.1 + open * 0.75;
    // While filing, the dots travel from the space to the drawer (as world-space flyers).
    flyers.forEach((m) => { m.visible = false; });

    // 6 Answer.
    question.material.opacity = phase(t, 5.0, 5.2);
    question.position.y = 3.75 + (1 - phase(t, 5.0, 5.25)) * 0.6;
    const rise = phase(t, 5.12, 5.5);
    const ans = phase(t, 5.32, 5.6);
    answer.visible = ans > 0.01;
    answer.scale.setScalar(0.85 + ans * 0.15);
    answer.userData.face.material.opacity = ans;
    answer.position.y = 2.0 + (1 - ans) * -0.4;

    const drawerWorld = (k) => tmpA.copy(drawers[0].slots[k]).applyMatrix4(drawers[0].group.matrixWorld);
    flyers.forEach((m, k) => {
      if (file > 0 && file < 1) {
        // Filing: from the vector space into the drawer.
        const from = dots[k].position.clone().applyMatrix4(cube.matrixWorld);
        const to = drawerWorld(k).clone();
        m.position.lerpVectors(from, to, file);
        m.position.y += Math.sin(file * Math.PI) * 1.4;
        m.visible = true;
      } else if (file >= 1 && rise <= 0) {
        m.position.copy(drawerWorld(k));
        m.visible = t < 5.1 || rise <= 0;
      } else if (rise > 0) {
        const from = drawerWorld(k).clone();
        const to = new Vector3(sx(5) + dir * (-1.41 + k * 0.205), 1.44, 0.3);
        m.position.lerpVectors(from, to, rise);
        m.position.y += Math.sin(rise * Math.PI) * 1.6;
        m.visible = rise < 0.98;
      }
    });

    // The citation arc returns to the page and lights the passage.
    const draw = phase(t, 5.62, 6.0);
    const n = Math.floor(arcCount * draw / 3) * 3;
    arc.geometry.setDrawRange(0, n);
    arcGlow.geometry.setDrawRange(0, n);
    const hl = page.userData.hl;
    hl.mat.opacity = phase(t, 5.9, 6.0) * (0.55 + Math.sin(now * 0.006) * 0.2);

    // Stations: the current one is lit.
    const k = Math.min(5, Math.floor(t + 0.02));
    stations.forEach((s, i) => {
      const on = i === k || hover === i;
      s.ringMat.opacity += ((on ? 0.95 : 0.25) - s.ringMat.opacity) * 0.15;
      s.title.material.opacity += ((i <= k + 1 ? 1 : 0.35) - s.title.material.opacity) * 0.15;
    });
  }

  // ---------- Interaction ----------
  const ray = new Raycaster();
  const ptr = new Vector2();
  let hover = -1;
  let drag = null;
  const stationOf = (obj) => {
    for (let o = obj; o; o = o.parent) {
      if (o.userData && o.userData.station !== undefined) return o.userData.station;
    }
    return -1;
  };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, true).find((h) => h.object.visible !== false);
    return hit ? stationOf(hit.object) : -1;
  };
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0, touch: e.pointerType === 'touch' };
  });
  addEventListener('pointerup', (e) => {
    if (drag && drag.moved < 6 && e.target === canvas) {
      const i = pick(e);
      if (i >= 0) onSelect?.(i);
    }
    drag = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      user.vy = -dx * 0.004;
      user.vp = drag.touch ? 0 : -dy * 0.003;
      user.yaw = MathUtils.clamp(user.yaw + user.vy, -0.7, 0.7);
      user.pitch = MathUtils.clamp(user.pitch + user.vp, -0.25, 0.3);
      return;
    }
    if (e.pointerType !== 'mouse') return;
    hover = pick(e);
    canvas.style.cursor = hover >= 0 ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; });

  // ---------- Size and loop ----------
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    portrait = w / h < 0.95;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = portrait ? 42 : 36;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);

  let visible = false;
  let raf = 0;
  const loop = (now) => {
    raf = 0;
    if (!visible || disposed) return;
    if (!drag) {
      user.yaw = MathUtils.clamp(user.yaw + user.vy, -0.7, 0.7);
      user.pitch = MathUtils.clamp(user.pitch + user.vp, -0.25, 0.3);
      user.vy *= 0.92;
      user.vp *= 0.9;
    }
    scene.updateMatrixWorld();
    update(now);
    anim.forEach((fn) => fn(time, now));
    placeCamera();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && built && !raf) raf = requestAnimationFrame(loop);
  });

  // ---------- Build over several frames ----------
  async function build() {
    await (document.fonts?.load(`600 40px ${FONT}`).catch(() => {}) ?? Promise.resolve());
    const doc = opts.doc;
    buildPlatform();
    await nextFrame();
    for (let i = 0; i < 6; i++) buildStation(i);
    await nextFrame();
    buildPage(doc);
    buildGate();
    await nextFrame();
    buildReader(doc);
    buildCards(doc);
    await nextFrame();
    buildIndex(doc);
    buildCabinet();
    await nextFrame();
    buildAnswer();
    buildArc();
    await nextFrame();
    container.append(canvas);
    resize();
    time = time || 0;
    scene.updateMatrixWorld();
    update(performance.now());
    placeCamera();
    // Compile every shader off the main thread where the browser supports it.
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    if (disposed) return;
    built = true;
    ro.observe(container);
    io.observe(container);
    renderer.render(scene, camera);
    onReady?.();
  }
  build().catch((err) => console.error('[ParsRAG] 3D pipeline', err));

  return {
    canvas,
    setTime(t) { time = Math.min(6, Math.max(0, t)); },
    dispose() { disposed = true; ro.disconnect(); io.disconnect(); renderer.dispose(); canvas.remove(); },
  };
}
