/* 디스코드에서 온 작업 요청을 받는 입구 — 2026-09-11 신설
   Vercel 환경변수: DISCORD_PUBLIC_KEY(필수) · GITHUB_DISPATCH_TOKEN(필수) · DISCORD_ALLOWED_USERS(필수)

   왜 여기인가:
     디스코드에서 명령하고 깃허브가 일하게 하려면 **둘 사이에 받아 줄 자리**가 하나 필요하다.
     디스코드는 슬래시 명령을 정해진 주소로 POST 하는데, 깃허브 액션은 그 POST 를 직접 못 받는다
     (액션은 깃허브 API 로 깨워야 한다). 그래서 중간에 서버가 필요한데 —
     **우리는 이미 Vercel 을 쓰고 있으니 컴퓨터를 새로 켜둘 필요가 없다.** 그게 이 파일의 존재 이유다.

   흐름:
     디스코드 슬래시 명령 → (여기) → 깃허브 액션 깨움 → 클로드가 일함 → 디스코드 웹훅으로 결과
     ⚠ 여기서 일을 하지 않는다. 여기는 문패만 확인하고 넘기는 자리다 —
       Vercel 함수는 오래 못 버티고, 코드를 고치는 건 깃허브 쪽이 할 일이다.

   ⚠ **서명 확인은 건너뛸 수 없다.** 디스코드는 주소를 등록할 때 **일부러 틀린 서명**을 보내서
     우리가 401 로 막는지 시험한다. 안 막으면 등록 자체가 안 된다. 그리고 막지 않으면
     주소를 아는 누구나 우리 저장소에서 코드를 돌릴 수 있다 — 이건 편의 문제가 아니라 문이 열린 것이다.

   ⚠ **서명은 「받은 그대로의 본문」으로 검사한다.** JSON 으로 파싱한 걸 다시 문자열로 만들면
     띄어쓰기·키 순서가 달라져 서명이 깨진다. 그래서 원문을 읽을 수 있는 **Web 표준 손잡이**가 필요하다.

   ⚠⚠ **2026-09-14 실사고 — 이 파일은 9/11 배포 이후 사흘간 죽어 있었다.**
     처음엔 런타임을 안 지정하고 Web 표준 꼴(`request.text()`)로만 썼는데, Vercel 은 그걸
     기본 Node 런타임의 `(req, res)` 로 돌렸다. 결과가 둘이었다:
       · `TypeError: request.headers.get is not a function` (4건)
       · **응답을 아무것도 안 보내서 300초 타임아웃** (6건) — 디스코드는 3초를 기다리므로
         주소 등록 자체가 실패한다. 그런데 **화면에는 아무 표시가 없어서** 아무도 몰랐다.
     → 그래서 **런타임을 엣지로 못박는다.** 엣지는 Web 표준 `Request`/`Response` 를 확실히 쓴다.
     → 대신 엣지에는 `node:crypto` 가 없다. 서명 확인을 **WebCrypto** 로 바꿨다.
     ⚠ **`node:crypto` 를 다시 들여오지 마라** — 로컬 검사는 통과하고 배포만 죽는다.
       그 조합을 `health-check` 5-t 가 문다.

   ⚠ **허용 목록이 비어 있으면 전부 거절한다(닫힘이 기본).** 깜빡 잊고 배포했을 때
     "아무나 된다"로 열려 있는 쪽이 아니라 "아무도 안 된다"로 닫혀 있는 쪽으로 떨어져야 한다. */

/* ⚠ 여기서 무엇도 import 하지 않는다. 엣지에는 node: 모듈이 없다.
   서명 확인은 어디서나 있는 WebCrypto(`globalThis.crypto.subtle`)로 한다. */
export const config = { runtime: "edge" };

const REPO = process.env.GITHUB_REPO || "rlflrrlflr/BINARI";
const MAX_BODY = 16 * 1024;          // 슬래시 명령 한 건이 이보다 클 이유가 없다
const MAX_TASK = 1500;               // 지시문 길이 상한 — 이보다 길면 디스코드가 아니라 문서로 줄 일이다

/* 디스코드 상호작용 종류 (디스코드가 정한 번호) */
const PING = 1;
const COMMAND = 2;

/* 우리가 돌려주는 응답 종류 */
const PONG = 1;
const REPLY = 4;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/* ── 서명 확인 (WebCrypto) ──────────────────────────────────────────────────
   디스코드는 Ed25519 로 서명한다. `crypto.subtle` 은 엣지에도 Node 에도 있으므로
   **로컬 검사와 배포가 같은 길을 탄다** — 그게 이 선택의 핵심이다.
   ⚠ `Buffer` 를 쓰지 않는다. 엣지에서 있을 수도 없을 수도 있는 값에 기대지 않는다. */
function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 || /[^0-9a-fA-F]/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function verifySignature(publicKeyHex, signatureHex, timestamp, rawBody) {
  try {
    const pub = hexToBytes(publicKeyHex);
    const sig = hexToBytes(signatureHex);
    if (!pub || pub.length !== 32 || !sig || sig.length !== 64) return false;
    const key = await crypto.subtle.importKey("raw", pub, { name: "Ed25519" }, false, ["verify"]);
    const msg = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, sig, msg);
  } catch (_) {
    return false;                    // 형태가 틀렸거나 Ed25519 를 못 쓰면 **막는 쪽으로** 떨어진다
  }
}

/* ── 누가 시킬 수 있나 ──────────────────────────────────────────────────────
   사람 아이디로 판정한다. 채널로만 막으면 그 채널에 초대된 누구나 코드를 돌릴 수 있고,
   이 저장소는 지금 공개 상태라 서버 링크가 퍼질 여지가 더 크다.
   채널 제한은 **덧문**으로만 둔다(설정하면 걸고, 안 하면 채널은 안 따진다). */
function isAllowed(userId, channelId) {
  const users = (process.env.DISCORD_ALLOWED_USERS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!users.length) return false;                       // 닫힘이 기본
  if (!users.includes(String(userId))) return false;
  const ch = (process.env.DISCORD_ALLOWED_CHANNEL || "").trim();
  if (ch && String(channelId) !== ch) return false;
  return true;
}

/* ── 깃허브 액션을 깨운다 ───────────────────────────────────────────────────
   repository_dispatch 로 부른다. 지시문은 client_payload 에 실어 보낸다.
   ⚠ 실패를 조용히 삼키지 않는다 — 삼키면 유저는 「시작했습니다」를 보고 기다리는데
     실제로는 아무것도 안 도는 상태가 된다. 그게 제일 나쁜 실패다. */
async function wakeGithub(task, requester, channelId) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) throw new Error("GITHUB_DISPATCH_TOKEN 없음");
  const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "binari-discord-bridge",
    },
    body: JSON.stringify({
      event_type: "discord-task",
      client_payload: { task, requester, channel_id: String(channelId || "") },
    }),
  });
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(`깃허브 ${r.status} ${detail}`);
  }
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "POST 만 받는다" }, 405);

  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  const pub = process.env.DISCORD_PUBLIC_KEY;
  if (!pub) return json({ error: "서버 설정 미완" }, 500);
  if (!sig || !ts) return json({ error: "서명 없음" }, 401);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return json({ error: "본문이 너무 크다" }, 413);
  if (!(await verifySignature(pub, sig, ts, rawBody))) return json({ error: "서명 불일치" }, 401);

  let body;
  try { body = JSON.parse(rawBody); } catch (_) { return json({ error: "본문 해석 불가" }, 400); }

  /* 디스코드가 주소를 확인하는 인사. 이 응답이 없으면 주소 등록이 안 된다. */
  if (body.type === PING) return json({ type: PONG });

  if (body.type !== COMMAND) return json({ type: PONG });

  const userId = body.member?.user?.id || body.user?.id || "";
  const userName = body.member?.user?.username || body.user?.username || "누군가";
  const channelId = body.channel_id || body.channel?.id || "";

  if (!isAllowed(userId, channelId)) {
    /* 왜 막혔는지는 말해 준다. 「그냥 안 됨」은 다음 행동을 못 정하게 만든다.
       단 허용 목록 자체는 말하지 않는다. */
    return json({
      type: REPLY,
      data: { flags: 64, content: "여기서는 작업을 시킬 수 없어요. 창업자에게 권한을 요청하세요." },
    });
  }

  /* 슬래시 명령의 첫 글자 옵션을 지시문으로 쓴다. 옵션 이름은 안 따진다 —
     명령 모양을 나중에 바꿔도 이 파일을 같이 고치지 않게 하려는 것이다. */
  const opts = body.data?.options || [];
  const task = String(opts.find((o) => typeof o.value === "string")?.value || "").trim();

  if (!task) {
    return json({ type: REPLY, data: { flags: 64, content: "무엇을 해야 하는지 적어 주세요." } });
  }
  if (task.length > MAX_TASK) {
    return json({
      type: REPLY,
      data: { flags: 64, content: `너무 길어요(${task.length}자). ${MAX_TASK}자 안으로 줄이거나 문서로 주세요.` },
    });
  }

  try {
    await wakeGithub(task, userName, channelId);
  } catch (e) {
    return json({
      type: REPLY,
      data: { content: `시작을 못 했어요 — ${String(e.message).slice(0, 140)}` },
    });
  }

  /* 디스코드는 3초 안에 답을 받아야 한다. 실제 작업은 몇 분 걸리므로
     여기서는 「시작했다」까지만 말하고, 결과는 깃허브가 웹훅으로 따로 올린다. */
  return json({
    type: REPLY,
    data: { content: `받았어요. 지금부터 해볼게요 — 몇 분 걸려요.\n> ${task.slice(0, 300)}` },
  });
}
