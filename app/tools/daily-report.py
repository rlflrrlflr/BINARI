#!/usr/bin/env python3
"""비나리 데일리 리포트 — PostHog에서 전일 지표를 뽑아 텔레그램으로 보낸다.

로컬(맥)에서 실행하는 스크립트다. Zapier 없이 텔레그램 봇 API를 직접 호출하므로
중계 서비스도, 유료 플랜도 필요 없다. 표준 라이브러리만 쓴다(pip 설치 불필요).

설정: ~/.binari-report.env 에 아래 4개를 넣는다(이 파일은 절대 git에 올리지 않는다).
    POSTHOG_API_KEY=phx_...      # PostHog > Settings > Personal API keys (query:read 권한)
    POSTHOG_PROJECT_ID=526669
    TELEGRAM_BOT_TOKEN=123456:AA...   # @BotFather 에서 발급
    TELEGRAM_CHAT_ID=123456789        # 봇에게 말 건 뒤 아래 --whoami 로 확인

사용:
    python3 daily-report.py            # 전일 리포트 생성 후 텔레그램 발송
    python3 daily-report.py --dry      # 발송 없이 화면에만 출력
    python3 daily-report.py --whoami   # 내 chat_id 확인(봇에게 아무 메시지나 보낸 뒤 실행)
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ENV_PATH = Path.home() / ".binari-report.env"
PH_HOST = "https://us.posthog.com"


def load_env():
    """~/.binari-report.env 를 읽어 환경변수처럼 쓴다(이미 설정된 환경변수가 우선)."""
    cfg = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("POSTHOG_API_KEY", "POSTHOG_PROJECT_ID", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def post_json(url, payload, headers, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def hogql(cfg, query):
    """PostHog Query API로 HogQL 실행 → 행 리스트 반환."""
    url = f"{PH_HOST}/api/projects/{cfg['POSTHOG_PROJECT_ID']}/query/"
    body = {"query": {"kind": "HogQLQuery", "query": query}}
    out = post_json(url, body, {"Authorization": f"Bearer {cfg['POSTHOG_API_KEY']}"})
    return out.get("results", [])


# ── 지표 수집 ────────────────────────────────────────────────────────────────
Q_DAILY = """
SELECT
    toDate(timestamp) AS d,
    uniq(person_id) AS people,
    uniq(properties.$session_id) AS sessions,
    countIf(event = 'app_open') AS opens,
    countIf(event = 'birth_submitted') AS onboarded,
    countIf(event = 'question_asked') AS asked,
    countIf(event = 'verdict_shown') AS verdicts,
    countIf(event = 'why_opened') AS why,
    countIf(event = 'another_question') AS again,
    countIf(event = 'verdict_shared') AS shared,
    countIf(event = 'verdict_rated') AS rated
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND event NOT LIKE '$%'
GROUP BY d ORDER BY d DESC LIMIT 3
"""

Q_DIR = """
SELECT properties.dir AS dir, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 1 DAY AND event = 'verdict_shown'
GROUP BY dir ORDER BY n DESC
"""

Q_RATE = """
SELECT properties.score AS score, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 1 DAY AND event = 'verdict_rated'
GROUP BY score ORDER BY score
"""


def pct(a, b):
    return f"{round(a / b * 100)}%" if b else "—"


def delta(now, prev):
    """전일 대비 증감 표기."""
    if prev is None:
        return ""
    diff = now - prev
    if diff == 0:
        return " (—)"
    return f" ({'+' if diff > 0 else ''}{diff})"


def build_report(cfg):
    rows = hogql(cfg, Q_DAILY)
    if not rows:
        return "비나리 데일리 리포트\n\n전일 데이터가 없습니다. 계측 또는 배포 상태를 확인해주세요."

    # 컬럼 순서는 Q_DAILY의 SELECT 순서와 같다
    keys = ["d", "people", "sessions", "opens", "onboarded", "asked", "verdicts", "why", "again", "shared", "rated"]
    today = dict(zip(keys, rows[0]))
    prev = dict(zip(keys, rows[1])) if len(rows) > 1 else {}

    dirs = {str(r[0]): r[1] for r in hogql(cfg, Q_DIR)}
    total_v = sum(dirs.values())
    hold, go, stop = dirs.get("HOLD", 0), dirs.get("GO", 0), dirs.get("STOP", 0)

    scores = {str(int(float(r[0]))): r[1] for r in hogql(cfg, Q_RATE) if r[0] is not None}
    n_rated = sum(scores.values())
    hit = scores.get("3", 0)

    L = []
    L.append(f"비나리 데일리 리포트 ({today['d']})")
    L.append("")

    # 총평 — 수치가 아니라 판단을 먼저
    if today["asked"] == 0:
        L.append("전일 질문이 한 건도 없었습니다. 유입 경로를 먼저 점검해야 할 것으로 보입니다.")
    elif today["verdicts"] < today["asked"]:
        fail = today["asked"] - today["verdicts"]
        L.append(f"전일 자 리포트 공유드립니다. 질문 {today['asked']}건 중 {fail}건이 판결까지 도달하지 못했습니다. 응답 실패 원인 확인이 필요합니다.")
    else:
        L.append(f"전일 자 리포트 공유드립니다. 질문 {today['asked']}건 전부 판결까지 정상 응답했습니다.")

    L.append("")
    L.append("[ 지표 ]")
    L.append(f"· 방문자 {today['people']}명{delta(today['people'], prev.get('people'))} / 세션 {today['sessions']}")
    L.append(f"· 온보딩 완료 {today['onboarded']}")
    L.append(f"· 질문 {today['asked']} → 판결 {today['verdicts']} ({pct(today['verdicts'], today['asked'])})")
    L.append(f"· 재질문 {today['again']} ({pct(today['again'], today['verdicts'])})")
    L.append(f"· '왜?' 열람 {today['why']} ({pct(today['why'], today['verdicts'])})")
    L.append(f"· 공유 {today['shared']} ({pct(today['shared'], today['verdicts'])})")
    L.append(f"· 판결 평가 {today['rated']} ({pct(today['rated'], today['verdicts'])})")

    if total_v:
        L.append("")
        L.append(f"[ 판결 방향 ] GO {go} · HOLD {hold} · STOP {stop}")

    L.append("")
    L.append("[ 해석 ]")
    notes = []

    # 단언 비율 — 제품의 핵심 가치 지표
    if total_v >= 5:
        decisive = pct(go + stop, total_v)
        if (go + stop) / total_v < 0.5:
            notes.append(f"HOLD 비중이 {pct(hold, total_v)}로 높습니다. 단언(GO/STOP) 비율이 {decisive}에 그쳐 '결단을 준다'는 핵심 가치가 약해지고 있습니다. 지속되면 판결 프롬프트 임계값 조정 검토가 필요합니다.")
        else:
            notes.append(f"단언(GO/STOP) 비율 {decisive}로 방향성은 유지되고 있습니다.")

    # 평가율 — 품질 피드백 루프
    if today["verdicts"] >= 5:
        rr = today["rated"] / today["verdicts"]
        if rr < 0.3:
            notes.append(f"평가율이 {pct(today['rated'], today['verdicts'])}로 낮습니다. 판결 품질을 검증할 유일한 지표라 이 수준으로는 개선 근거가 쌓이지 않습니다.")

    # 만족도
    if n_rated:
        notes.append(f"평가 {n_rated}건 중 '딱 맞음' {hit}건({pct(hit, n_rated)})입니다.")

    # 재질문 — 인게이지먼트
    if today["verdicts"] >= 5 and today["again"] / max(today["verdicts"], 1) > 0.7:
        notes.append(f"재질문율이 {pct(today['again'], today['verdicts'])}로 높아 한 번 들어온 사용자는 계속 묻고 있습니다.")

    if today["people"] < 10:
        notes.append(f"표본이 {today['people']}명으로 작아 비율 지표는 참고용입니다. 유의미한 해석은 유입 확대 이후 가능합니다.")

    L.extend("· " + n for n in (notes or ["특이사항 없습니다."]))
    return "\n".join(L)


# ── 텔레그램 ─────────────────────────────────────────────────────────────────
def tg(cfg, method, payload=None):
    url = f"https://api.telegram.org/bot{cfg['TELEGRAM_BOT_TOKEN']}/{method}"
    if payload is None:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    return post_json(url, payload, {})


def send(cfg, text):
    return tg(cfg, "sendMessage", {"chat_id": cfg["TELEGRAM_CHAT_ID"], "text": text, "disable_web_page_preview": True})


def whoami(cfg):
    """봇에게 보낸 최근 메시지에서 chat_id를 찾아준다."""
    out = tg(cfg, "getUpdates")
    seen = {}
    for u in out.get("result", []):
        msg = u.get("message") or u.get("channel_post") or {}
        ch = msg.get("chat") or {}
        if ch.get("id"):
            seen[ch["id"]] = ch.get("username") or ch.get("first_name") or ch.get("title") or ""
    if not seen:
        print("최근 메시지가 없습니다. 텔레그램에서 봇에게 아무 메시지나 보낸 뒤 다시 실행해주세요.")
        return
    print("찾은 chat_id (이 값을 ~/.binari-report.env 의 TELEGRAM_CHAT_ID 에 넣으세요):")
    for cid, name in seen.items():
        print(f"  {cid}   {name}")


def main():
    cfg = load_env()
    args = sys.argv[1:]

    if "--whoami" in args:
        if not cfg.get("TELEGRAM_BOT_TOKEN"):
            sys.exit("TELEGRAM_BOT_TOKEN이 없습니다. ~/.binari-report.env 를 확인해주세요.")
        whoami(cfg)
        return

    missing = [k for k in ("POSTHOG_API_KEY", "POSTHOG_PROJECT_ID") if not cfg.get(k)]
    if missing:
        sys.exit(f"설정 누락: {', '.join(missing)} — {ENV_PATH} 를 확인해주세요.")

    try:
        report = build_report(cfg)
    except urllib.error.HTTPError as e:
        sys.exit(f"PostHog 조회 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")

    if "--dry" in args:
        print(report)
        return

    missing = [k for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") if not cfg.get(k)]
    if missing:
        print(report)
        sys.exit(f"\n(발송 안 함) 설정 누락: {', '.join(missing)}")

    try:
        send(cfg, report)
        print("발송 완료")
    except urllib.error.HTTPError as e:
        sys.exit(f"텔레그램 발송 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")


if __name__ == "__main__":
    main()
