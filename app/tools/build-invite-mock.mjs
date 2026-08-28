/* ─────────────────────────────────────────────────────────────────────
 * B 랜딩 시안 생성기 — 작업지시_초대와회신_2026-08-26 §4 (D-1)
 *
 * 이 화면이 **우리 제품의 첫인상**이 된다. 지금까지 공유로 들어온 사람은 판결 카드를 봤는데
 * 앞으로는 여기가 처음이다. 그리고 이 화면이 곧 **공유 유입 온보딩 축약**이다
 * (루프배관 §1-2 — 현행 완주율 40%, 합격선 50, 병목이 장면 10·탭 10).
 *
 * ⚠ 문구를 지어내지 않는다. ⑤의 아홉 축·머리글은 **build 시점에 match.js 를 실제로 돌려**
 *   나온 값을 그대로 박는다. 시안이 엔진보다 예쁘면 그건 시안이 거짓말을 한 것이다.
 * ⚠ 생년월일은 가상 값이다(CLAUDE.md §운영 규칙).
 *
 * 실행: cd app && node tools/build-invite-mock.mjs → app/public/invite-mock.html
 * ───────────────────────────────────────────────────────────────────── */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const APPDIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPSRC = readFileSync(join(APPDIR, "src/App.jsx"), "utf8");

/* calcSaju 는 App.jsx 안에 있다 — mansae-test.mjs 와 같은 방식으로 번들해서 꺼낸다.
   ⚠ 임시 번들은 반드시 src/ 안에 떨군다. App.jsx 가 `./lib/imprint.js` 를 상대경로로 임포트해서
     app 루트에 떨구면 그 경로가 깨진다(v124.1 에 실제로 겪은 사고). */
const TMP = join(APPDIR, "src/.invite-mock.tmp.mjs");
execSync(`npx esbuild src/App.jsx --format=esm --jsx=automatic --bundle --packages=external --define:import.meta.env={} --outfile=${TMP}`, { cwd: APPDIR });
const { calcSaju } = await import(TMP);
const { readMatch } = await import(join(APPDIR, "src/lib/match.js"));

/* 가상 명식 둘 — A(부른 사람) · B(받은 사람) */
const FIX_A = { y: 1990, m: 2, d: 25, h: 14 };
const FIX_B = { y: 1987, m: 9, d: 3, h: 21 };
const mk = (f) => calcSaju(f.y, f.m, f.d, f.h, 0, false, 126.978);
const sA = mk(FIX_A), sB = mk(FIX_B);
/* ⚠ B 화면이므로 **B가 a 자리**다 — 자기 쪽에서 본 사이를 읽는다(§4-⑤) */
const r = readMatch({ a: { saju: sB, birth: FIX_B, sex: null }, b: { saju: sA, birth: FIX_A, sex: null } });
rmSync(TMP, { force: true });
if (!r?.chorus) throw new Error("readMatch 가 chorus 를 안 줬다 — 엔진이 바뀌었다");

const EL_COLOR = new Function("return " + APPSRC.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();
/* 이름 뒤 조사 — A가 적어둔 이름이라 받침이 있을 수도 없을 수도 있다.
   ⚠ 이걸 안 하면 "연지이 궁금해했어" 가 나간다. **첫인상 화면**이라 조사 하나로 값이 깎인다.
      match.js 의 jong() 과 같은 규칙(종성 유무). */
const jong = (s) => { const c = (s || "").trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
const NAMES = ["연지", "정민", "주영", "재민"];   // 받침 있음/없음이 섞이게 — 조사 검사용
const DATA = { chorus: r.chorus, elc: EL_COLOR[sB.main] || EL_COLOR.토, el: sB.main,
  names: NAMES.map((n) => ({ n, ga: jong(n) ? "이" : "가", eun: jong(n) ? "은" : "는",
    ege: n + "에게" })) };
const A = DATA.names[0], from = A.n;
console.log("엔진 실측 — 머리글:", r.chorus.head.replace(/<[^>]+>/g, ""));
console.log("            칸:", r.chorus.cells.map((c) => `${c.civ}/${c.say}`).join(" · "));

const HTML = `<!doctype html><meta charset="utf-8">
<title>B 랜딩 시안 — 초대받은 사람이 처음 보는 화면</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#050408;--ink:#d8cfe6;--dim:#8a7f95;--gold:#f5d98b;--line:#2a2340}
  *{box-sizing:border-box}
  body{margin:0;background:#0b0a12;color:var(--ink);font-family:'Noto Serif KR',serif}
  .wrap{max-width:1180px;margin:0 auto;padding:22px 16px 70px}
  h1{font-size:19px;margin:0 0 4px;letter-spacing:-.02em;font-family:sans-serif}
  .lead{font-family:sans-serif;font-size:12px;color:var(--dim);margin:0 0 16px;line-height:1.7}
  .lead b{color:#cfc9ff}
  .rail{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px;align-items:flex-start}
  .phone{flex:0 0 340px;border:1px solid var(--line);border-radius:22px;
    padding:18px 18px 22px;min-height:600px;position:relative;
    background-image:radial-gradient(130% 90% at 50% 0%,#141021,#0a0812 55%,#050408)}
  .caphead{font-family:sans-serif;font-size:11px;color:var(--dim);margin:0 0 6px;display:flex;justify-content:space-between}
  .taps{color:var(--gold)}
  .who{font-size:15px;line-height:1.7;color:#efe6ff;margin:6px 0 4px;word-break:keep-all}
  .who b{color:var(--gold)}
  .whosub{font-family:sans-serif;font-size:11.5px;color:var(--dim);margin:0 0 18px;line-height:1.6}
  .lbl{font-family:sans-serif;font-size:11px;color:var(--dim);letter-spacing:.06em;margin:0 0 7px}
  .row{display:flex;gap:7px;align-items:center;margin-bottom:12px}
  .in{background:#100d1c;border:1px solid #3a3157;border-radius:9px;color:#efe6ff;
    padding:12px 8px;font-size:16px;text-align:center;width:100%;font-family:sans-serif}
  .in.y{flex:1.5} .in.s{flex:1}
  .unit{font-family:sans-serif;font-size:11px;color:var(--dim)}
  .opt{font-family:sans-serif;font-size:11.5px;color:#9b90b8;border:1px dashed #3a3157;
    border-radius:9px;padding:9px;text-align:center;margin-bottom:16px}
  .notice{border:1px solid rgba(245,217,139,.28);background:rgba(245,217,139,.055);
    border-radius:11px;padding:12px 13px;margin:2px 0 12px}
  .notice p{font-family:sans-serif;font-size:12.5px;line-height:1.72;color:#e4dcc4;margin:0}
  .notice b{color:var(--gold)}
  .notice .no{color:#9b90b8}
  .chk{display:flex;gap:9px;align-items:flex-start;font-family:sans-serif;font-size:12.5px;
    color:#cfc4e2;margin:0 0 18px;line-height:1.6}
  .chk i{flex:0 0 17px;height:17px;border:1px solid #6a5f92;border-radius:5px;margin-top:2px;
    display:grid;place-items:center;font-style:normal;font-size:11px;color:#2a1e05;background:transparent}
  .chk.on i{background:var(--gold);border-color:var(--gold)}
  .btn{width:100%;padding:14px;border-radius:999px;border:0;font-family:sans-serif;font-size:14px;letter-spacing:.04em}
  .btn.gold{background:linear-gradient(180deg,#f7e3a8,#cfa94e);color:#2a1e05;font-weight:600}
  .btn.ghost{background:transparent;color:#cfc4e2;border:1px solid #4a4173}
  .mt{margin-top:10px}
  .chorush{font-size:15.5px;line-height:1.72;color:#efe6ff;margin:0 0 10px;text-align:center;word-break:keep-all}
  .chorush b{color:var(--gold)}
  .cells{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .cells li{padding:8px 5px;border:1px solid rgba(159,143,196,.2);border-radius:9px;
    background:rgba(20,15,38,.5);text-align:center}
  .cells .civ{display:block;font-family:sans-serif;font-size:10px;color:#8a7f95;margin-bottom:3px}
  .cells .what{display:block;font-family:sans-serif;font-size:11px;color:#cfc4e2;word-break:keep-all}
  .cells .say{display:block;font-family:sans-serif;font-size:11px;margin-top:3px}
  .cells .up .say{color:#8fe0b0} .cells .dn .say{color:#e59aa6} .cells .mid .say{color:#9b90b8}
  .cnote{font-family:sans-serif;font-size:11.5px;color:var(--dim);line-height:1.7;margin:0 0 16px}
  .cnote b{color:#cfc4e2}
  .door{border-top:1px solid var(--line);padding-top:15px;margin-top:4px}
  .doorq{font-size:14.5px;color:#efe6ff;margin:0 0 11px;text-align:center}
  .note{font-family:sans-serif;font-size:12px;color:var(--dim);line-height:1.85;margin-top:26px;
    border-top:1px solid var(--line);padding-top:16px}
  .note h3{color:var(--ink);font-size:13px;margin:18px 0 7px}
  .note li{margin:5px 0}
  .note code{color:#cfc9ff;font-size:11px}
  table{border-collapse:collapse;font-family:sans-serif;font-size:12px;margin:8px 0}
  td,th{border:1px solid var(--line);padding:6px 9px;text-align:left}
  th{color:#cfc4e2}
</style>
<div class="wrap">
  <h1>B 랜딩 — 링크를 받은 사람이 처음 보는 화면</h1>
  <p class="lead">작업지시_초대와회신 §4 · <b>이 화면이 곧 공유 유입 온보딩 축약</b>이다(루프배관 §1-2).<br>
  ⑤의 머리글과 아홉 칸은 <b>지어낸 문구가 아니라 build 시점에 match.js 를 실제로 돌린 값</b>이다 — 가상 명식 두 개.</p>
  <div class="rail">

    <div class="phone">
      <p class="caphead"><span>화면 1 — 열자마자</span><span class="taps">여기까지 탭 0</span></p>
      <p class="who"><b>${from}</b>${A.ga} <b>너와의 사이</b>를 궁금해했어.</p>
      <p class="whosub">생일만 넣으면 둘 사이를 아홉 하늘이 뭐라고 하는지 보여줄게.</p>
      <p class="lbl">태어난 날</p>
      <div class="row">
        <input class="in y" value="1987" readonly><span class="unit">년</span>
        <input class="in s" value="9" readonly><span class="unit">월</span>
        <input class="in s" value="3" readonly><span class="unit">일</span>
      </div>
      <div class="opt">태어난 시는 몰라도 돼 — <b>이 결과는 시를 안 써</b></div>
      <div class="notice">
        <p><b>네 생일은 이 기기에만 남아.</b> 우리 서버에 안 올라가.<br>
        ${from}에게는 <b>‘답했다’는 사실만</b> 전해져 — <span class="no">생일도, 결과도 안 가.</span></p>
      </div>
      <div class="chk on"><i>✓</i><span>답했다는 걸 ${from}에게 알려도 될까? <span style="color:#8a7f95">(꺼도 결과는 그대로 봐)</span></span></div>
      <button class="btn gold">둘 사이를 볼게</button>
    </div>

    <div class="phone">
      <p class="caphead"><span>화면 2 — 결과</span><span class="taps">여기까지 탭 4</span></p>
      <p class="chorush">${DATA.chorus.head}</p>
      ${DATA.chorus.inner ? `<p class="cnote" style="text-align:center;margin-bottom:12px">${DATA.chorus.inner}</p>` : ""}
      <ul class="cells">
        ${DATA.chorus.cells.map((c) => `<li class="${c.v >= 1 ? "up" : c.v <= -1 ? "dn" : "mid"}">
          <span class="civ">${c.civ}</span><span class="what">${c.what}</span><span class="say">${c.say}</span></li>`).join("")}
      </ul>
      <p class="cnote">같은 두 사람인데 하늘마다 다르게 봐. 이건 흠이 아니라 <b>알맹이야</b> — 평균을 내면 이게 사라져.</p>
      <div class="door">
        <p class="doorq">네 수호신도 만들어볼래?</p>
        <button class="btn gold">응, 내 것도 볼래</button>
        <button class="btn ghost mt">다음에</button>
      </div>
    </div>

    <div class="phone">
      <p class="caphead"><span>화면 3 — 동의를 껐을 때</span><span class="taps">탭 1 더</span></p>
      <p class="who" style="font-size:13.5px;color:#cfc4e2">체크를 끄면 <b>${from}에게 아무것도 안 간다.</b></p>
      <div class="chk"><i></i><span>답했다는 걸 ${from}에게 알려도 될까?</span></div>
      <div class="notice">
        <p><b>지금은 아무것도 안 나가.</b><br><span class="no">${from}${A.eun} 네가 열어봤는지도 몰라.</span></p>
      </div>
      <p class="cnote">결과는 <b>그대로 다 보인다.</b> 동의는 결과의 대가가 아니다 —
      대가로 걸면 그건 동의가 아니라 <b>통행료</b>다.</p>
      <button class="btn gold">둘 사이를 볼게</button>
      <p class="cnote" style="margin-top:18px">여기서 화면 2로 그대로 이어진다.
      <b>갈라지는 건 A에게 가는 것뿐</b>이고 B가 보는 건 같다.</p>
    </div>

  </div>

  <div class="note">
    <h3>탭 수 — 이 화면이 대체하는 것</h3>
    <table>
      <tr><th></th><th>현행 공유 유입</th><th>이 화면</th></tr>
      <tr><td>장면</td><td>10</td><td><b>2</b></td></tr>
      <tr><td>탭</td><td>10</td><td><b>4</b></td></tr>
      <tr><td>완주율</td><td>40% (합격선 50)</td><td>—</td></tr>
    </table>
    <p><b>탭 4의 내역</b> — 년·월·일 세 칸(3) + 「둘 사이를 볼게」(1). 시는 선택이라 안 센다.
    동의 체크는 <b>켜진 채로 시작</b>하므로 탭이 아니고, 끄고 싶은 사람만 1탭을 더 쓴다.<br>
    ⑥은 결과 화면 안에 있어 <b>탭을 더 쓰지 않고 이어진다</b> — 이게 §4의 “여세를 끊지 않게”다.</p>

    <h3>이 시안이 지키는 것</h3>
    <ul>
      <li><b>고지(③)를 숨기지 않았다</b> — 회색 각주가 아니라 <b>금색 테두리 상자</b>로 입력 바로 아래 둔다.
        헌장 기준이 “유저가 무엇이 나가는지 보고 있는가”이고, 안 보이는 채로 나가면 그건 유출이다.
        나가는 것(‘답했다’)과 <b>안 나가는 것(생일·결과)</b>을 같이 적었다 — 안 나가는 쪽이 더 길다.</li>
      <li><b>동의를 결과의 대가로 안 걸었다</b>(화면 3). 꺼도 결과는 전부 보인다.
        대가로 걸면 그건 동의가 아니라 통행료이고, 그렇게 받은 동의는 근거가 못 된다.</li>
      <li><b>총점·게이지·퍼센트·하트 0개</b>(관계표현인계서 §3). 칸마다 「맞는다 / 갈린다 / 그 사이」 세 낱말뿐이고
        <b>갈린 칸을 죽이지 않았다</b> — 갈림이 알맹이다.</li>
      <li><b>시(時)를 안 묻는다</b> — 이 계산은 일간뿐이라 시와 무관하다(§C-2). 무거운 칸을 하나 지웠다.</li>
      <li><b>‘궁합’이라는 말을 안 썼다</b> — 곁탭IA §3에서 둘 사이는 <b>「사이」</b>다. 궁합은 유료 문서 이름이라
        무료 화면에 쓰면 값을 치른 것과 헷갈린다.</li>
      <li><b>B에게 이름을 안 묻는다</b> — 화면에 뜨는 이름은 A가 적어둔 것이다(인계서 §6).</li>
    </ul>

    <h3>⚠ 이름 뒤 조사 — 첫인상 화면이라 이게 값을 깎는다</h3>
    <p>이름은 A가 적어둔 임의 문자열이라 <b>받침이 있을 수도 없을 수도 있다.</b>
    처음 그렸을 땐 <b>“연지이 궁금해했어”</b>가 나갔다. <code>match.js</code>의 <code>jong()</code>과 같은 규칙을 쓴다.</p>
    <table>
      <tr><th>이름</th><th>①줄</th><th>③고지</th><th>④동의</th></tr>
      ${DATA.names.map((x) => `<tr><td>${x.n}</td><td>${x.n}${x.ga} 너와의 사이를 궁금해했어</td>
        <td>${x.ege}는 ‘답했다’만</td><td>${x.ege} 알려도 될까?</td></tr>`).join("")}
    </table>
    <p>「에게」는 받침과 무관해 안 갈린다 — 갈리는 건 <b>①줄의 주격</b>과 <b>화면 3의 보조사</b>뿐이다.</p>

    <h3>로직 세션(L-3)이 가져갈 것</h3>
    <ul>
      <li>화면은 <b>둘</b>이다(입력 → 결과). 결과 안에 ⑥이 들어간다 — 세 번째 화면을 만들지 마라.</li>
      <li>동의 체크 기본값 <b>켜짐</b>. 끈 경우 A에게 가는 호출을 <b>안 한다</b>(<code>notify:false</code>를 보내는 게 아니라 아예 안 보낸다).</li>
      <li>⑤는 <code>readMatch({a: B, b: A})</code> — <b>B가 a 자리</b>다. 자기 쪽에서 본 사이를 읽는다.</li>
      <li><b>이름 뒤 조사를 계산해라</b> — <code>jong()</code>. 하드코딩된 “이/가” 하나가 첫인상을 깎는다.</li>
      <li>머리글·칸 문구는 <b>엔진이 만든 것을 그대로</b> 쓴다. 화면에서 다시 쓰지 마라 — 두 벌이 되면 갈린다.</li>
    </ul>
  </div>

  <h1 style="margin-top:38px">D-2 · 곁 승격의 시각 — 「부른 곁」이 「곁」이 되는 순간</h1>
  <p class="lead">A가 앱을 열었을 때 답이 와 있으면 <code>GY_CALLED</code>(0.45) → <code>GY_STANDING</code>(1.0)으로 올라간다.<br>
  <b>아래는 타이밍·거동 시안</b>이다(Canvas2D 데모 — 실물은 기존 곁 셰이더의 <code>col</code> 을 프레임마다 보간하면 된다. 셰이더 무변경).</p>
  <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:0 0 360px;border:1px solid var(--line);border-radius:16px;padding:14px;
      background-image:radial-gradient(120% 90% at 50% 40%,#141021,#07060e 70%)">
      <canvas id="pro" width="664" height="440" style="width:332px;height:220px;display:block"></canvas>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn gold" id="go" style="padding:10px">답이 왔다 — 승격</button>
        <button class="btn ghost" id="rs" style="padding:10px;flex:0 0 90px">되돌리기</button>
      </div>
      <p class="cnote" style="margin:10px 0 0" id="stat">부른 곁 둘 · 대답 없음</p>
    </div>
    <div style="flex:1 1 380px" class="note">
      <h3 style="margin-top:0">움직이는 축 셋 — 밝기만으로는 안 보인다</h3>
      <table>
        <tr><th>축</th><th>부른 곁</th><th>곁</th><th>왜</th></tr>
        <tr><td>밝기</td><td>0.45</td><td>1.0</td><td>이미 코드에 있는 값</td></tr>
        <tr><td>궤도</td><td>바깥(1.18)</td><td>앞줄(1.0)</td><td>「앞줄」을 <b>문자 그대로</b> 만든다</td></tr>
        <tr><td>꼬리</td><td>길고 흐림</td><td>짧고 또렷</td><td>기척 → 사람</td></tr>
      </table>
      <p>가산 블렌딩에서 0.45→1.0은 생각보다 안 띈다. <b>셋이 같이 움직여야</b> 「밝아졌다」가 아니라
      <b>「가까이 왔다」</b>로 읽힌다.</p>

      <h3>시간 — 2.2초, 그리고 한 번에 하나씩</h3>
      <ul>
        <li><b>2.2초 ease-out.</b> v133 응축이 1.25초였는데 그건 <b>내가 탭을 눌러 보는</b> 전환이다.
          승격은 <b>앱을 열었더니 이미 벌어지고 있는 일</b>이라 더 느려도 된다 —
          느려야 “언제 바뀌었지”가 아니라 <b>“바뀌는 걸 봤다”</b>가 된다.</li>
        <li><b>둘 이상이면 0.5초씩 어긋나게.</b> 동시에 밝아지면 그게 <b>“2명”이라는 숫자</b>가 된다.
          어긋나면 사건이 둘이다 — 숫자를 안 쓰고 수를 느끼게 하는 유일한 길이다(곁탭IA §5).</li>
        <li><b>끊기면 교체, 이어지면 자세</b>(v133 선례). 상태를 갈아끼우지 말고 값을 흘려보낸다.</li>
      </ul>

      <h3>안 하는 것</h3>
      <ul>
        <li><b>숫자·배지·“N명이 답했어”</b> — 붙는 순간 명부가 카운터가 된다(§5·지시서 §5).</li>
        <li><b>알림·진동·소리</b> — 승격은 <b>앱을 열었을 때</b> 곁 탭에서 보인다. push 가 아니다(§7 모를 권리).</li>
        <li><b>놓친 것 만들기</b> — 전이가 끝나면 그냥 밝은 상태다. “못 본 승격”이 쌓이면 그게 배지다.</li>
        <li><b>승격 순간에 이름을 띄우기</b> — 이름은 목록에서 본다. 화면 가운데 뜨면 그건 알림이다.</li>
      </ul>
      <p><b>로직 세션에게</b>: <code>gyeotView()</code> 가 지금 <code>dim</code> 을 즉시 계산한다
      (<code>tier === GY_STANDING ? 1 : 0.45</code>). 승격은 <b>tier 를 바꾸는 게 아니라
      tier 로 가는 목표값을 바꾸고 프레임마다 따라가게</b> 해야 한다 — 그렇지 않으면 한 프레임 만에 튄다.</p>
    </div>
  </div>

  <div class="note">
    <p style="margin-top:18px">생성: <code>cd app &amp;&amp; node tools/build-invite-mock.mjs</code> ·
    ⑤는 <code>app/src/lib/match.js</code> 실행 결과(가상 명식 ${FIX_B.y}·${FIX_A.y})</p>
  </div>
</div>
<script>
/* 승격 데모 — 타이밍과 거동만 본다. 실물은 곁 셰이더의 col 을 같은 곡선으로 보간하면 된다. */
(function(){
  var cv=document.getElementById("pro"), g=cv.getContext("2d");
  var W=664,H=440,CX=W/2,CY=H/2;
  var COL=[[0.65,0.88,0.75],[0.95,0.80,0.45]];           /* 상대 오행 색(생·동) */
  var G=[{a:0.6,t:0},{a:3.4,t:0}];                        /* t: 0=부른 곁 → 1=곁 */
  var want=[0,0], t0=null, SEQ=[0,500];                   /* 0.5초씩 어긋나게 */
  function ease(x){ return 1-Math.pow(1-x,3); }
  function draw(now){
    requestAnimationFrame(draw);
    if(t0!==null) G.forEach(function(o,i){
      var e=(now-t0-SEQ[i])/2200;                          /* 2.2초 */
      o.t = want[i] ? Math.max(0,Math.min(1,ease(Math.max(0,e))))
                    : Math.max(0,o.t-0.03);
    });
    g.clearRect(0,0,W,H);
    /* 본체 — 자리만 잡는 흐린 덩어리(이 데모의 주인공이 아니다) */
    var bg=g.createRadialGradient(CX,CY,4,CX,CY,86);
    bg.addColorStop(0,"rgba(198,180,255,.5)"); bg.addColorStop(1,"rgba(120,100,190,0)");
    g.fillStyle=bg; g.beginPath(); g.arc(CX,CY,86,0,6.2832); g.fill();
    G.forEach(function(o,i){
      var dim=0.45+0.55*o.t;                               /* 밝기 */
      var rad=(1.18-0.18*o.t)*128;                         /* 궤도 — 바깥에서 앞줄로 */
      var tail=(1-0.55*o.t);                               /* 꼬리 — 길고 흐림 → 짧고 또렷 */
      var ang=o.a+now/2600;
      var c=COL[i];
      for(var k=0;k<26;k++){
        var f=k/26, aa=ang-f*0.9*tail;
        var x=CX+Math.cos(aa)*rad, y=CY+Math.sin(aa)*rad*0.6;
        var al=dim*(1-f)*(1-f)*(0.55+0.45*o.t);
        g.fillStyle="rgba("+(c[0]*255|0)+","+(c[1]*255|0)+","+(c[2]*255|0)+","+al.toFixed(3)+")";
        g.beginPath(); g.arc(x,y,(1.6+3.4*(1-f))*(0.8+0.4*o.t),0,6.2832); g.fill();
      }
    });
  }
  requestAnimationFrame(draw);
  document.getElementById("go").onclick=function(){ want=[1,1]; t0=performance.now();
    document.getElementById("stat").textContent="답이 왔다 — 0.5초 어긋나게 하나씩 올라온다"; };
  document.getElementById("rs").onclick=function(){ want=[0,0]; t0=null;
    document.getElementById("stat").textContent="부른 곁 둘 · 대답 없음"; };
})();
</script>
`;
const OUT = resolve(APPDIR, "public/invite-mock.html");
writeFileSync(OUT, HTML);
console.log("생성:", OUT);
