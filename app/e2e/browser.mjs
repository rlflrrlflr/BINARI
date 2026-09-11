/* 검사용 브라우저를 찾아 띄운다 — 2026-09-11 신설
 *
 * 왜 한 곳으로 모으나:
 *   2026-08-31 라이브 사고(첫 방문자가 빈 화면) 때 **그 사고를 잡는 검사 자체가 브라우저를 못 찾아
 *   죽어 있었다.** 그래서 `webgl-check` 에 후보를 차례로 시도하는 사다리를 넣었는데,
 *   9/11 에 `crash-net-check` 이 **같은 이유로 또 죽었다** — 사다리가 한 파일에만 있었기 때문이다.
 *   같은 교훈을 두 번 배우지 않으려면 수단이 한 곳에 있어야 한다.
 *
 * ⚠ **전부 실패하면 조용히 통과하지 말고 그 사실을 말하고 죽는다.**
 *   「브라우저를 못 찾았다」와 「앱이 깨졌다」가 구분이 안 되면, 검사가 죽은 동안 결함이 그대로 배포된다.
 *   실제로 그렇게 나갔다.
 *
 * ⚠ 아직 `webgl-check.mjs` 는 자기 사다리를 따로 들고 있다(소프트웨어 GPU 인자가 필요해 조건이 다르다).
 *   옮길 때는 그 인자를 여기 `args` 로 넘기면 된다.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export function loadPlaywright() {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
}

/* 후보를 차례로 시도한다.
   ① 사람이 지정한 것(CHROME_PATH·PW_CHROMIUM) ② 이 컨테이너에 박혀 있는 것 ③ playwright 기본값
   ⚠ `executablePath: undefined` 를 **키로 넘기면** 기본 해석이 안 된다(8/31 에 이걸로 죽었다).
     그래서 값이 없을 땐 키 자체를 빼고 넘긴다. */
export async function launch({ args = [] } = {}) {
  const pw = loadPlaywright();
  const tries = [
    process.env.CHROME_PATH || process.env.PW_CHROMIUM || null,
    "/opt/pw-browsers/chromium",
    null,                                   // playwright 가 알아서 찾게
  ];
  let last;
  for (const ep of tries) {
    try {
      return await pw.chromium.launch({ ...(ep ? { executablePath: ep } : {}), ...(args.length ? { args } : {}) });
    } catch (e) { last = e; }
  }
  console.log("FAIL — 브라우저를 못 찾아 이 검사가 아예 못 돌았다(통과가 아니다). CHROME_PATH 를 주거나 'npx playwright install chromium' 을 하라.");
  console.log(String(last && last.message).split("\n")[0]);
  process.exit(1);
}

/* 검진(health-check)용 — **죽지 않고 결과를 돌려준다.**
   검진이 여기서 죽으면 나머지 120여 칸 결과까지 같이 사라진다. 그래서 사다리는 같이 쓰되
   실패는 값으로 돌려주고, 부르는 쪽이 「못 봤다」로 보고하게 한다(통과로 세지 않는다). */
export async function tryLaunch({ args = [] } = {}) {
  let pw;
  try { pw = loadPlaywright(); } catch (e) { return { err: "playwright 를 못 불렀다" }; }
  const tries = [
    process.env.CHROME_PATH || process.env.PW_CHROMIUM || null,
    "/opt/pw-browsers/chromium",
    null,
  ];
  let last;
  for (const ep of tries) {
    try {
      const b = await pw.chromium.launch({ ...(ep ? { executablePath: ep } : {}), ...(args.length ? { args } : {}) });
      return { browser: b, pw };
    } catch (e) { last = e; }
  }
  return { err: String(last && last.message).split("\n")[0].slice(0, 120) };
}

