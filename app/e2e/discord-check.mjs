/* 디스코드 작업 요청 입구 회귀 — 실행: node app/e2e/discord-check.mjs (서버·브라우저 불필요)
 *
 * 왜 이 검사가 있는가:
 *   이 입구는 **디스코드 한 줄로 우리 저장소에서 코드를 돌리는 문**이다. 열려 있으면
 *   주소를 아는 누구나 같은 일을 할 수 있다. 그런데 문이 열렸는지는 **화면에 안 보인다** —
 *   서명 확인을 지워도, 허용 목록 판정을 뒤집어도 평소 동작은 똑같아 보인다.
 *   그래서 사람 기억이 아니라 검사로 못 박는다.
 *
 * 여기서 묻는 것은 구현이 아니라 성질이다:
 *   ① 서명이 없거나 틀리면 막는가 (디스코드는 등록할 때 일부러 틀린 서명을 보내 시험한다)
 *   ② 본문이 한 글자라도 바뀌면 막는가 (원문으로 검사한다는 증거)
 *   ③ 허용 목록을 안 채웠으면 **아무도** 못 시키는가 (닫힘이 기본)
 *   ④ 허용된 사람은 실제로 깃허브를 깨우는 자리까지 가는가
 *   ⑤ 거절할 때 허용 목록 내용을 흘리지 않는가
 *   ⑥ 너무 긴 지시문을 잘라 내는가 (구독 한도를 한 번에 태우지 않게)
 */
import { generateKeyPairSync, sign } from "node:crypto";
import handler from "../api/discord.js";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* 진짜 열쇠 한 쌍을 만들어 디스코드 흉내를 낸다 — 서명을 흉내로 때우면 검사가 뜻이 없다 */
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB_HEX = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");

const TS = "1788600000";
const req = (bodyObj, { sigHex, ts = TS, raw } = {}) => {
  const body = raw !== undefined ? raw : JSON.stringify(bodyObj);
  const headers = { "content-type": "application/json" };
  if (sigHex !== null) {
    headers["x-signature-ed25519"] = sigHex || sign(null, Buffer.from(ts + body, "utf8"), privateKey).toString("hex");
    headers["x-signature-timestamp"] = ts;
  }
  return new Request("https://binari-sepia.vercel.app/api/discord", { method: "POST", headers, body });
};
const call = async (...a) => {
  const res = await handler(req(...a));
  let j = null; try { j = JSON.parse(await res.text()); } catch (_) {}
  return { status: res.status, body: j };
};

const cmd = (task, userId = "9001") => ({
  type: 2,
  channel_id: "chan-1",
  member: { user: { id: userId, username: "석우" } },
  data: { name: "시켜", options: [{ name: "일", type: 3, value: task }] },
});

/* 환경을 검사가 직접 세운다 — 실제 비밀값에 손대지 않는다 */
const env0 = { ...process.env };
const setEnv = (o) => {
  for (const k of ["DISCORD_PUBLIC_KEY", "DISCORD_ALLOWED_USERS", "DISCORD_ALLOWED_CHANNEL", "GITHUB_DISPATCH_TOKEN"]) delete process.env[k];
  Object.assign(process.env, o);
};

/* ── ① 서명 ────────────────────────────────────────────────────────────── */
setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX });
{
  const noSig = await call({ type: 1 }, { sigHex: null });
  ck("서명이 아예 없으면 막는다", noSig.status === 401, `${noSig.status}`);

  const bad = await call({ type: 1 }, { sigHex: "00".repeat(64) });
  ck("서명이 틀리면 막는다(디스코드가 등록 때 시험하는 것)", bad.status === 401, `${bad.status}`);

  const ping = await call({ type: 1 });
  ck("바른 서명의 인사에는 답한다(이게 없으면 주소 등록 자체가 안 된다)",
     ping.status === 200 && ping.body?.type === 1, `type=${ping.body?.type}`);

  /* ② 서명은 받은 원문으로 검사해야 한다 — 파싱했다 되돌린 문자열로는 안 맞는다 */
  const obj = { type: 1 };
  const raw = JSON.stringify(obj);
  const sigForRaw = sign(null, Buffer.from(TS + raw, "utf8"), privateKey).toString("hex");
  const reshaped = await call(null, { sigHex: sigForRaw, raw: JSON.stringify(obj, null, 2) });
  ck("본문 모양이 바뀌면 막는다(원문으로 검사한다는 증거)", reshaped.status === 401, `${reshaped.status}`);
}

/* ── ③ 허용 목록을 안 채웠으면 아무도 못 시킨다 ──────────────────────────── */
{
  setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX });                      // 목록 없음
  const r = await call(cmd("main 을 지워줘"));
  const txt = r.body?.data?.content || "";
  ck("허용 목록이 비면 아무도 못 시킨다(닫힘이 기본)", /권한/.test(txt), txt.slice(0, 40));
  ck("⑤ 거절할 때 목록 내용을 흘리지 않는다",
     !/\d{4,}/.test(txt) && !txt.includes("DISCORD_ALLOWED"), txt.slice(0, 40));

  setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX, DISCORD_ALLOWED_USERS: "9001" });
  const other = await call(cmd("배포해줘", "8888"));
  ck("목록에 없는 사람은 막는다", /권한/.test(other.body?.data?.content || ""));
}

/* ── ④ 허용된 사람은 깃허브를 깨우는 자리까지 간다 ───────────────────────
   ⚠ 진짜로 깨우면 검사가 실제 작업을 돌려 버린다. 그래서 열쇠를 일부러 비워 두고,
     「시작을 못 했다」는 답이 오는 것으로 **그 자리까지 갔다**는 것만 확인한다. */
{
  setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX, DISCORD_ALLOWED_USERS: "9001" });   // 깃허브 열쇠 없음
  const r = await call(cmd("곁 지우기 확인창 넣어줘"));
  const txt = r.body?.data?.content || "";
  ck("허용된 사람은 깃허브를 깨우는 자리까지 간다", /시작을 못 했/.test(txt), txt.slice(0, 50));
  ck("막힌 이유를 말해 준다(그냥 안 됨으로 끝내지 않는다)", /GITHUB_DISPATCH_TOKEN|없음/.test(txt));
}

/* ── ⑥ 길이·빈 값 ──────────────────────────────────────────────────────── */
{
  setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX, DISCORD_ALLOWED_USERS: "9001" });
  const empty = await call(cmd("   "));
  ck("빈 지시문은 되묻는다", /무엇을/.test(empty.body?.data?.content || ""));

  const long = await call(cmd("가".repeat(1600)));
  ck("너무 긴 지시문은 자른다(구독 한도를 한 번에 안 태우게)",
     /너무 길/.test(long.body?.data?.content || ""));
}

/* ── 설정 미비·잘못된 요청 ─────────────────────────────────────────────── */
{
  setEnv({});                                                    // 공개키조차 없음
  const r = await call({ type: 1 });
  ck("서버 설정이 안 됐으면 통과시키지 않는다", r.status === 500, `${r.status}`);

  setEnv({ DISCORD_PUBLIC_KEY: PUB_HEX });
  const res = await handler(new Request("https://x/api/discord", { method: "GET" }));
  ck("GET 으로는 아무것도 못 한다", res.status === 405, `${res.status}`);
}

process.env = env0;
const bad = R.filter((x) => !x).length;
console.log(`\n${R.length - bad}/${R.length} PASS`);
process.exit(bad ? 1 : 0);
