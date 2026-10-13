// "How it works" in 3D: one page and everything ParsRAG builds from it, as a stack of layers
// in space. The pinned scroll drives a time t from 0 to 6 (one unit per step): the page lands,
// a scan beam reads it into a text layer, the text splits into passages, the passages become
// vectors in a collection, and a question pulls three of them into a cited answer. A saffron
// line then runs from the answer back down to the cited passage on the page.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry,
  MeshBasicMaterial, LineBasicMaterial, PointsMaterial, BufferGeometry, Float32BufferAttribute, Points,
  Line, LineLoop, LineSegments, EdgesGeometry, CanvasTexture, SRGBColorSpace, Vector3, CatmullRomCurve3,
  SphereGeometry, AdditiveBlending, Color, DoubleSide, MathUtils,
} from 'three';

const TURQ = new Color('#3ee0cf');
const SAFFRON = new Color('#f6b94d');
const W = 4.2; // layer width (x)
const D = 5.4; // layer depth (z): a portrait page lying flat
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => 1 - Math.pow(1 - clamp01(v), 3);
const phase = (t, a, b) => ease((t - a) / (b - a));

// Deterministic random numbers, so the point cloud is the same on every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function texture(draw, w = 512, h = 660) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Text lines on a page; the lines at `mark` get a saffron highlight.
const LINES = [0.92, 0.84, 0.96, 0.7, 0.9, 0.88, 0.95, 0.62, 0.9, 0.82, 0.94, 0.55, 0.86, 0.9, 0.74];
const MARK = [5, 6];
function drawLines(ctx, w, h, { rtl, color, glow, highlight }) {
  const left = 56;
  const usable = w - left * 2;
  LINES.forEach((f, i) => {
    const y = 120 + i * 34;
    const lw = usable * f;
    const x = rtl ? w - left - lw : left;
    if (highlight && MARK.includes(i)) {
      ctx.fillStyle = 'rgba(246, 185, 77, 0.6)';
      ctx.fillRect(x - 8, y - 9, lw + 16, 26);
    }
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
    ctx.fillStyle = color;
    roundRectPath(ctx, x, y, lw, 9, 4.5);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

export function createStack(container, { rtl, lang, file, answer, cite }) {
  const fontFamily = 'Vazirmatn, system-ui, sans-serif';
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'jstage__gl';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  const stack = new Group();
  scene.add(stack);
  const dir = rtl ? -1 : 1;

  // ----- Layer 0: the page -----
  const pageTex = texture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#eef2f5');
    g.addColorStop(1, '#dde3e9');
    ctx.fillStyle = g;
    roundRectPath(ctx, 0, 0, w, h, 18);
    ctx.fill();
    // File chip in the corner of the page.
    ctx.font = `600 24px ${fontFamily}`;
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = '#d1503c';
    roundRectPath(ctx, rtl ? w - 56 - 64 : 56, 44, 64, 34, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 18px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('PDF', rtl ? w - 56 - 32 : 88, 67);
    ctx.fillStyle = '#4b5866';
    ctx.font = `600 22px ${fontFamily}`;
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText(file, rtl ? w - 56 - 80 : 136, 68);
    drawLines(ctx, w, h, { rtl, color: 'rgba(17, 26, 36, 0.62)', highlight: true });
  });
  const page = new Mesh(new PlaneGeometry(W, D), new MeshBasicMaterial({ map: pageTex, transparent: true, side: DoubleSide }));
  page.rotation.x = -Math.PI / 2;

  const outline = (color, opacity) => {
    const l = new LineSegments(new EdgesGeometry(new PlaneGeometry(W, D)), new LineBasicMaterial({ color, transparent: true, opacity }));
    l.rotation.x = -Math.PI / 2;
    return l;
  };

  const pageLayer = new Group();
  pageLayer.add(page);
  stack.add(pageLayer);

  // ----- Layer 1: the text read from the page (scan beam passes over it) -----
  const textTex = texture((ctx, w, h) => drawLines(ctx, w, h, { rtl, color: 'rgba(156, 245, 234, 0.95)', glow: '#3ee0cf' }));
  const textLayer = new Group();
  const textPlane = new Mesh(new PlaneGeometry(W, D), new MeshBasicMaterial({ map: textTex, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
  textPlane.rotation.x = -Math.PI / 2;
  const textEdge = outline(TURQ, 0.35);
  textLayer.add(textPlane, textEdge);
  stack.add(textLayer);
  const beam = new Mesh(new BoxGeometry(W * 1.08, 0.02, 0.06), new MeshBasicMaterial({ color: TURQ, transparent: true, blending: AdditiveBlending }));
  const beamGlow = new Mesh(new PlaneGeometry(W * 1.08, 0.5), new MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  beamGlow.rotation.x = -Math.PI / 2;
  beam.add(beamGlow);
  stack.add(beam);

  // ----- Layer 2: passages (four regions of the page; one bridges two pages) -----
  const chunkLayer = new Group();
  const chunkCells = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const chunkCentres = [];
  chunkCells.forEach(([cx, cz], k) => {
    const w = W / 2 - 0.3;
    const d = D / 2 - 0.36;
    const geo = new PlaneGeometry(w, d);
    const color = k === 2 ? SAFFRON : TURQ;
    const fill = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity: 0.09, depthWrite: false, side: DoubleSide }));
    const edge = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    fill.rotation.x = edge.rotation.x = -Math.PI / 2;
    const cell = new Group();
    cell.add(fill, edge);
    cell.position.set(cx * (W / 4 + 0.02) * dir, 0, cz * (D / 4 + 0.02));
    chunkLayer.add(cell);
    chunkCentres.push(cell.position.clone());
  });
  stack.add(chunkLayer);

  // ----- Layer 3: vectors (a point cloud; four points are this page's passages) -----
  const rand = rng(7);
  const N = 90;
  const cloud = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.4 + Math.sqrt(rand()) * 2.1;
    cloud[i * 3] = Math.cos(a) * r;
    cloud[i * 3 + 1] = (rand() - 0.5) * 0.9;
    cloud[i * 3 + 2] = Math.sin(a) * r * 1.15;
  }
  const cloudGeo = new BufferGeometry();
  cloudGeo.setAttribute('position', new Float32BufferAttribute(cloud, 3));
  const cloudMat = new PointsMaterial({ color: new Color('#7fa8b4'), size: 0.07, transparent: true, opacity: 0.8, depthWrite: false });
  const points = new Points(cloudGeo, cloudMat);
  const mine = [new Vector3(0.55 * dir, 0.1, -0.5), new Vector3(0.95 * dir, -0.15, -0.1), new Vector3(0.4 * dir, 0.2, 0.25), new Vector3(1.05 * dir, 0.05, 0.45)];
  const mineGeo = new BufferGeometry();
  mineGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
  const minePts = new Points(mineGeo, new PointsMaterial({ color: TURQ, size: 0.2, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  const vecLayer = new Group();
  vecLayer.add(points, minePts);
  stack.add(vecLayer);

  // ----- Layer 4: the collection that holds them (a translucent cylinder) -----
  const store = new Group();
  const cylGeo = new CylinderGeometry(2.6, 2.6, 1.3, 64, 1, true);
  const cyl = new Mesh(cylGeo, new MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0.06, side: DoubleSide, depthWrite: false }));
  const ringGeo = (y) => {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(Math.cos(a) * 2.6, y, Math.sin(a) * 2.6);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  };
  const ringMat = new LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.7 });
  store.add(cyl, new Line(ringGeo(0.65), ringMat), new Line(ringGeo(-0.65), ringMat));
  vecLayer.add(store);

  // ----- Layer 5: the question and the cited answer -----
  const query = new Mesh(new SphereGeometry(0.13, 24, 16), new MeshBasicMaterial({ color: SAFFRON }));
  const queryHalo = new Mesh(new SphereGeometry(0.32, 24, 16), new MeshBasicMaterial({ color: SAFFRON, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false }));
  query.add(queryHalo);
  stack.add(query);
  const linkGeo = new BufferGeometry();
  linkGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(18), 3));
  const links = new LineSegments(linkGeo, new LineBasicMaterial({ color: SAFFRON, transparent: true, opacity: 0.9 }));
  stack.add(links);

  const ansTex = texture((ctx, w, h) => {
    ctx.fillStyle = '#0d1320';
    roundRectPath(ctx, 2, 2, w - 4, h - 4, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(62, 224, 207, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    const x0 = rtl ? w - 40 : 40;
    ctx.fillStyle = '#eef2f6';
    ctx.font = `700 30px ${fontFamily}`;
    ctx.fillText(answer, x0, 76);
    [0.9, 0.78, 0.86, 0.6].forEach((f, i) => {
      const lw = (w - 80) * f;
      ctx.fillStyle = 'rgba(238, 242, 246, 0.55)';
      roundRectPath(ctx, rtl ? w - 40 - lw : 40, 116 + i * 34, lw, 10, 5);
      ctx.fill();
    });
    ctx.font = `650 22px ${fontFamily}`;
    const tw = ctx.measureText(cite).width + 36;
    ctx.fillStyle = 'rgba(246, 185, 77, 0.22)';
    roundRectPath(ctx, rtl ? w - 40 - tw : 40, 272, tw, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#ffd88f';
    ctx.fillText(cite, rtl ? w - 58 : 58, 299);
  }, 512, 340);
  const ansW = 3.4;
  const answerCard = new Mesh(new PlaneGeometry(ansW, ansW * (340 / 512)), new MeshBasicMaterial({ map: ansTex, transparent: true, side: DoubleSide }));
  stack.add(answerCard);

  // The citation: from the answer's chip down through the layers to the highlighted passage.
  const markZ = -D / 2 + ((120 + 5.5 * 34) / 660) * D;
  const markX = rtl ? W * 0.18 : -W * 0.18;
  const threadGeo = new BufferGeometry();
  const threadMat = new LineBasicMaterial({ color: SAFFRON, transparent: true, opacity: 1 });
  const thread = new Line(threadGeo, threadMat);
  stack.add(thread);
  const THREAD_PTS = 120;
  let threadCurve = null;

  // ----- Layout over time -----
  const Y = { page: 0, text: 1.15, chunks: 2.3, vectors: 3.6, answer: 5.4 };
  const tmp = new Vector3();

  function update(t) {
    // The stack opens up as the story goes on, and turns slowly toward the viewer.
    const spread = 0.55 + 0.45 * phase(t, 0.8, 4.2);
    stack.rotation.y = dir * (-0.55 + t * 0.06);

    // Page lands.
    const land = phase(t, 0, 0.8);
    pageLayer.position.y = (1 - land) * 2.4;
    pageLayer.rotation.z = (1 - land) * 0.4 * dir;
    page.material.opacity = land;

    // Scan beam and text layer.
    const scan = clamp01((t - 1) / 0.85);
    beam.visible = t > 1 && t < 2.05;
    beam.position.set(0, Y.text * spread * 0.5, -D / 2 + scan * D);
    textLayer.position.y = Y.text * spread;
    textPlane.material.opacity = phase(t, 1.1, 1.9);
    textEdge.material.opacity = 0.35 * phase(t, 1.1, 1.9);

    // Passages.
    const split = phase(t, 2, 2.8);
    chunkLayer.position.y = Y.chunks * spread;
    chunkLayer.children.forEach((cell, k) => {
      cell.scale.setScalar(0.6 + 0.4 * split);
      cell.children.forEach((m) => { m.material.opacity = (m.type === 'Mesh' ? 0.09 : 0.9) * split; });
      cell.visible = split > 0.01;
      cell.position.y = Math.sin(k + t * 2) * 0.03 * split;
    });

    // Vectors: this page's four passages rise out of the passage layer into the cloud.
    const lift = phase(t, 3, 3.8);
    vecLayer.position.y = Y.vectors * spread;
    cloudMat.opacity = 0.75 * phase(t, 3.1, 3.9);
    const mp = mineGeo.attributes.position;
    mine.forEach((target, k) => {
      const from = tmp.copy(chunkCentres[k]).setY(Y.chunks * spread - Y.vectors * spread);
      from.lerp(target, lift);
      mp.setXYZ(k, from.x, from.y, from.z);
    });
    mp.needsUpdate = true;
    minePts.material.opacity = phase(t, 3, 3.3);
    points.rotation.y = t * 0.08;

    // Collection.
    const keep = phase(t, 4, 4.7);
    store.visible = keep > 0.01;
    store.scale.set(1, keep, 1);
    cyl.material.opacity = 0.07 * keep;
    ringMat.opacity = 0.7 * keep;

    // Question, links and the cited answer.
    const ask = phase(t, 5, 5.35);
    query.visible = ask > 0.01;
    query.position.set(0.7 * dir, Y.vectors * spread + 2.6 - ask * 2.05, -0.05);
    const lp = linkGeo.attributes.position;
    const linkOn = phase(t, 5.3, 5.5);
    [0, 1, 2].forEach((k) => {
      lp.setXYZ(k * 2, query.position.x, query.position.y, query.position.z);
      const m = mine[k];
      const tx = query.position.x + (m.x - query.position.x) * linkOn;
      const ty = query.position.y + (m.y + vecLayer.position.y - query.position.y) * linkOn;
      const tz = query.position.z + (m.z - query.position.z) * linkOn;
      lp.setXYZ(k * 2 + 1, tx, ty, tz);
    });
    lp.needsUpdate = true;
    links.visible = linkOn > 0.01;

    const show = phase(t, 5.45, 5.85);
    answerCard.visible = show > 0.01;
    answerCard.material.opacity = show;
    answerCard.position.set(-0.4 * dir, Y.answer * spread + 0.6 + (1 - show) * 0.6, 0.6);
    answerCard.rotation.set(-0.42, dir * 0.55, 0);

    // Citation line, drawn progressively.
    const draw = phase(t, 5.7, 6);
    if (draw > 0) {
      const chip = answerCard.localToWorld(new Vector3((rtl ? 1 : -1) * ansW * 0.33, -0.62, 0.02));
      stack.worldToLocal(chip);
      const pageMark = new Vector3(markX, pageLayer.position.y + 0.02, markZ);
      threadCurve = new CatmullRomCurve3([
        chip,
        new Vector3(chip.x * 0.7, (chip.y + pageMark.y) * 0.6, chip.z + 0.9),
        new Vector3(pageMark.x * 0.6 + 0.3 * dir, pageMark.y + 0.9, pageMark.z + 0.6),
        pageMark,
      ]);
      threadGeo.setFromPoints(threadCurve.getPoints(THREAD_PTS));
      threadGeo.setDrawRange(0, Math.max(2, Math.round(THREAD_PTS * draw)));
    }
    thread.visible = draw > 0;
  }

  // ----- Camera, size, render loop -----
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const placeCamera = () => {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    // Narrow frames (phones) step the camera back so the whole stack stays in view.
    const back = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.9 : 1;
    camera.position.set((dir * 8.2 + pointer.x * 0.9) * back, (9.6 + pointer.y * 0.6) * back + 1.2, 12 * back);
    camera.lookAt(0, 2.7, 0);
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let t = 0;
  let visible = false;
  let raf = 0;
  let clock = 0;
  const loop = (now) => {
    raf = 0;
    if (!visible) return;
    // A little life in the stack even when the scroll is still.
    const idle = (now - clock) / 1000;
    update(t + Math.sin(idle * 0.8) * 0.002);
    placeCamera();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (!raf && visible) { clock = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }, { rootMargin: '100px' }).observe(container);
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * -2;
  });
  container.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });

  update(0);
  placeCamera();
  renderer.render(scene, camera);
  return {
    setTime(next) { t = MathUtils.clamp(next, 0, 6); start(); },
    canvas,
  };
}
