/* 원본(App.jsx·구버전 jsx)에서 렌더 코드를 그대로 뽑아내는 도구.
   손으로 베끼지 않는 것이 핵심 — 보드가 앱과 어긋나 거짓말하는 일을 막는다. */
import { execSync } from "node:child_process";

export function sliceConst(src, name) {
  const head = "const " + name + " = `";
  const i = src.indexOf(head);
  if (i < 0) throw new Error(`${name} 를 못 찾음`);
  const s = i + head.length;
  const e = src.indexOf("`;", s);
  if (e < 0) throw new Error(`${name} 의 끝을 못 찾음`);
  const body = src.slice(s, e);
  if (body.includes("${")) throw new Error(`${name} 에 템플릿 보간이 있다 — 그대로 옮길 수 없음`);
  return body;
}

export function slicePlace(src) {
  const i = src.indexOf("const place = (p) => {");
  if (i < 0) throw new Error("place() 를 못 찾음");
  const e = src.indexOf("\n    };", i);
  if (e < 0) throw new Error("place() 의 끝을 못 찾음");
  return src.slice(i, e).replace(/^\s*const place = \(p\) => \{/, "");
}

/* sim(상태보존 FBO) 엔진은 셰이더가 여러 상수의 문자열 결합이라 통째로 떼어
   그 자리에서 평가한다 — SHAPE_UNI ~ RND_FRAG 사이는 순수 문자열 상수뿐이다. */
export function sliceSimShaders(src) {
  const i = src.indexOf("const SHAPE_UNI");
  const j = src.indexOf("function GuardianCanvasSim");
  if (i < 0 || j < 0 || j < i) return null;
  const chunk = src.slice(i, j);
  if (!/RND_FRAG/.test(chunk)) return null;
  try {
    return new Function(chunk + "\nreturn { SIM_VERT, SIM_FRAG, RND_VERT, RND_FRAG };")();
  } catch { return null; }
}

export function gitLines(cmd, cwd) {
  return execSync(cmd, { cwd, maxBuffer: 1 << 28 }).toString().trim().split("\n").filter(Boolean);
}
export function gitShow(sha, path, cwd) {
  try { return execSync(`git show ${sha}:${path}`, { cwd, maxBuffer: 1 << 28 }).toString(); }
  catch { return null; }
}
export function gitMeta(sha, cwd) {
  const out = execSync(`git log -1 --format=%ad%x09%s --date=short ${sha}`, { cwd }).toString().trim();
  const [date, ...rest] = out.split("\t");
  return { date, subject: rest.join("\t") };
}
