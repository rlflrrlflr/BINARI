/* 곁 — 3D 공간 층 (three.js). `?r=3d` 판에서만 동적으로 불러온다 — 기본 앱 번들엔 0바이트.
 *
 * 창업자(2026-10-01): "곁 탭을 3D 가상공간으로 만들고, 친구를 초대할 때마다 오브젝트가 추가되는 느낌".
 * ⚠ 몸은 여기서 안 그린다 — 몸은 앱의 색장 그대로다(창업자: "기존 느낌은 살려야지").
 *    여기 사는 건 곁의 사람(반딧불)과 카메라뿐이다.
 * 층이 둘이다 — **몸 뒤**(색장 아래 캔버스)와 **몸 앞**(색장 위 캔버스). 한 장면을 깊이로 갈라
 * 두 번 그린다. 그래야 궤도 뒤쪽 반딧불이 진짜로 몸 뒤로 지나가 가려진다.
 * 반딧불 재질은 2D 판(drawSats)과 같다 — 오행색 후광 + 흰 심(창업자 2026-08-31 "곰팡이" 지적 이후 규칙).
 */
import * as THREE from "three";

function fireflyTex(col) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${col},.85)`); g.addColorStop(0.4, `rgba(${col},.40)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const w = x.createRadialGradient(64, 64, 0, 64, 64, 22);
  w.addColorStop(0, "rgba(255,253,246,.95)"); w.addColorStop(0.55, "rgba(255,252,240,.43)"); w.addColorStop(1, "rgba(255,252,240,0)");
  x.fillStyle = w; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const satCol = (c) => { const mx = Math.max(c[0], c[1], c[2]) || 1;
  return c.map((v) => Math.round(255 * Math.max(0, Math.min(1, 0.18 + 0.82 * (v / mx) * 0.92)))).join(","); };

export function makeGyeot3D(backCv, frontCv, S) {
  const mk = (cv) => { const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
    r.setPixelRatio(1); r.setSize(S, S, false); r.setClearColor(0x000000, 0); return r; };
  const back = mk(backCv), front = mk(frontCv);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const ents = new Map();                                  // 곁 한 사람 = 반딧불 + 꼬리 둘
  const tmp = new THREE.Vector3(), eul = new THREE.Euler();
  let idle = false;

  function ensure(g, i) {
    const key = g.id || g.key || g.name || i;
    let e = ents.get(key);
    if (!e) {
      const tex = fireflyTex(satCol(g.col || [0.8, 0.78, 0.86]));
      const spr = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex,
        transparent: true, depthWrite: false, depthTest: false })); scene.add(s); return s; });
      /* 궤도면 기울기 — 자리(ang)에서 정한다. 같은 사람은 늘 같은 궤도에 있다 */
      const seed = (g.ang || i * 1.7);
      /* 궤도선 — 아주 옅게. 「어디를 도는가」가 보여야 빈 곳이 공간으로 읽힌다 */
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos(k / 96 * 6.2832), 0, Math.sin(k / 96 * 6.2832)))),
        new THREE.LineBasicMaterial({ color: 0x3a3020, transparent: true, opacity: 0, depthTest: false }));
      scene.add(ring);
      e = { spr, ring, inc: Math.sin(seed * 3.1) * 0.42, node: seed * 0.9, t0: performance.now() };
      ents.set(key, e);
    }
    e.seen = true; return e;
  }

  return {
    /* 매 프레임 색장이 부른다. cx·cy 는 코어 자리(캔버스 0~1), R1 은 코어 반경(px) */
    frame({ ob, cx, cy, R1, gy, tS }) {
      /* 판결 탭(응축 전)에선 그릴 게 없다 — 한 번 비우고 쉰다. 매 프레임 두 층을 그리면 판결 화면까지 느려진다 */
      if (ob < 0.02) { if (!idle) { back.clear(); front.clear(); idle = true; } return; }
      idle = false;
      ents.forEach((e) => { e.seen = false; });
      /* 1 단위 = 코어 반경. 카메라 거리를 그에 맞춰 원점이 R1 픽셀 크기로 보이게 한다 */
      const D = S / (2 * Math.tan((15 * Math.PI) / 180) * Math.max(R1, 1));
      const el = 0.12 + 0.46 * ob;                         // 곁일수록 위에서 내려다본다 — 궤도가 타원으로 읽혀야 공간이다
      const az = Math.sin(tS * 0.05) * 0.5;                // 공간이 천천히 돈다 — 「가상공간」의 단서
      camera.position.set(Math.sin(az) * Math.cos(el) * D, Math.sin(el) * D, Math.cos(az) * Math.cos(el) * D);
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(S, S, S / 2 - cx * S, S / 2 - cy * S, S, S);
      camera.updateMatrixWorld();
      const list = (gy || []).slice(0, 12);
      list.forEach((g, i) => {
        const e = ensure(g, i);
        const opp = g.rel < -0.5, dir = opp ? -1 : 1;
        /* 사람이 늘수록 바깥 궤도로 — 2D 판(1.58/1.88)은 몸에 붙어 있어 「공간」이 안 읽혔다(첫 실측: 다섯 중 둘만 보임) */
        const rad = Math.min(4.4, (g.tier ? 1.9 : 2.3) + i * 0.42);
        const base = (g.tier ? 1.0 : 0.82) * ob;
        /* 새로 온 사람은 위에서 날아와 자리에 앉는다(1.4초) */
        const age = Math.min(1, (performance.now() - e.t0) / 1400), ease = 1 - Math.pow(1 - age, 3);
        e.ring.scale.setScalar(rad); e.ring.rotation.set(e.inc + (opp ? 1.1 : 0), e.node, 0, "XYZ");
        e.ring.material.opacity = 0.10 * ob * ease;
        e.spr.forEach((s, k) => {
          const a = (g.ang || 0) + dir * tS * 0.23 - dir * k * (g.tier ? 0.06 : 0.09);
          tmp.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
          eul.set(e.inc + (opp ? 1.1 : 0), e.node, 0); tmp.applyEuler(eul);
          if (age < 1) { tmp.x *= 1 + 1.6 * (1 - ease); tmp.z *= 1 + 1.6 * (1 - ease); tmp.y += 5 * (1 - ease); }
          s.position.copy(tmp);
          const sz = (g.tier ? 1.15 : 0.98) * (1 - k * 0.24) * (0.4 + 0.6 * ease + Math.sin(age * Math.PI) * 0.35);
          s.scale.setScalar(sz);
          s.material.opacity = base * (k === 0 ? 1 : 0.32 - k * 0.08);
        });
      });
      ents.forEach((e, key) => { if (!e.seen) { e.spr.forEach((s) => scene.remove(s)); scene.remove(e.ring); ents.delete(key); } });
      /* 깊이로 갈라 두 번 그린다 — 원점보다 카메라에서 먼 것은 몸 뒤 층 */
      const camD = camera.position.length();
      const split = (behind) => ents.forEach((e) => e.spr.forEach((s) => {
        const d = s.position.distanceTo(camera.position); s.visible = ob > 0.02 && (behind ? d > camD : d <= camD);
      }));
      /* 궤도선은 몸 뒤 층에만 — 앞에 그으면 얼굴을 가로지른다 */
      ents.forEach((e) => { e.ring.visible = ob > 0.02; });
      split(true); back.render(scene, camera);
      ents.forEach((e) => { e.ring.visible = false; });
      split(false); front.render(scene, camera);
    },
    dispose() { back.dispose(); front.dispose(); ents.clear(); },
  };
}
