// Hero backdrop: a slow tunnel of text. Each ring is a line from the sample documents, in the
// page's own language (whole lines are drawn with the browser's text shaping, so Persian
// letters stay joined). A few rings are "cited" and glow saffron. The rings drift toward the
// viewer, the tunnel turns slowly, and the camera leans with the pointer. The middle of the
// tunnel stays dark so the headline in front of it stays readable.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, CylinderGeometry, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, BackSide, FogExp2, Color, AdditiveBlending,
} from 'three';

const BG = new Color('#05070b');
const DEPTH = 64; // tunnel length
const ROW_H = 96; // atlas row height in pixels

function atlas(lines, { rtl, font }) {
  const c = document.createElement('canvas');
  c.width = 4096;
  c.height = ROW_H * lines.length;
  const ctx = c.getContext('2d');
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'middle';
  ctx.font = `500 54px ${font}`;
  lines.forEach((text, i) => {
    // Repeat the line around the ring, separated by a small mark.
    let s = '';
    while (ctx.measureText(s).width < c.width) s += `${text}   ·   `;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText(s, rtl ? c.width : 0, i * ROW_H + ROW_H / 2);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createTunnel(container, { lines, rtl, small }) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6));
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'hero__gl';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);

  const scene = new Scene();
  scene.fog = new FogExp2(BG, 0.045);
  const camera = new PerspectiveCamera(58, 1, 0.1, 120);
  camera.position.set(0, 0, 6);
  const tunnel = new Group();
  scene.add(tunnel);

  const font = 'Vazirmatn, system-ui, sans-serif';
  const tex = atlas(lines, { rtl, font });
  const rings = [];
  const count = small ? 18 : 30;
  for (let i = 0; i < count; i++) {
    const row = i % lines.length;
    const cited = i % 7 === 3;
    const map = tex.clone();
    map.needsUpdate = true;
    map.wrapS = RepeatWrapping;
    // Seen from inside the cylinder, text would read mirrored; flip it back.
    map.repeat.set(-1.6, 1 / lines.length);
    map.offset.set(0, 1 - (row + 1) / lines.length);
    const radius = (5.2 + (i % 3) * 0.35) * (small ? 0.6 : 1);
    const band = new Mesh(
      new CylinderGeometry(radius, radius, 0.42, 96, 1, true),
      new MeshBasicMaterial({
        map,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: cited ? new Color('#f6b94d') : new Color(i % 2 ? '#3a8f88' : '#9cf5ea'),
        opacity: cited ? 0.95 : 0.42,
      }),
    );
    band.rotation.x = Math.PI / 2; // the cylinder's axis runs along the view direction
    band.userData = { z: -(i / count) * DEPTH, spin: (i % 2 ? 1 : -1) * (0.012 + (i % 5) * 0.004), turn: Math.random() * Math.PI * 2 };
    tunnel.add(band);
    rings.push(band);
  }

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  let visible = true;
  let raf = 0;
  let last = performance.now();
  let speed = 1;
  let lastScroll = scrollY;
  const loop = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Scrolling quickens the drift for a moment.
    const v = Math.abs(scrollY - lastScroll);
    lastScroll = scrollY;
    speed += ((1 + Math.min(6, v * 0.08)) - speed) * 0.08;
    rings.forEach((r) => {
      const u = r.userData;
      u.z += dt * 1.6 * speed;
      if (u.z > 5) u.z -= DEPTH;
      u.turn += dt * u.spin * (1 + speed * 0.4);
      r.position.z = u.z;
      r.rotation.y = u.turn;
      // Fade in from the far end and out as a ring passes the camera.
      const near = Math.min(1, Math.max(0, (5 - u.z) / 5));
      r.material.opacity = near * r.material.userData.base;
    });
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.rotation.y = -pointer.x * 0.12;
    camera.rotation.x = -pointer.y * 0.08;
    tunnel.rotation.z += dt * 0.02;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  rings.forEach((r) => { r.material.userData.base = r.material.opacity; });
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(container);
  document.addEventListener('visibilitychange', start);
  start();
  return { canvas };
}
