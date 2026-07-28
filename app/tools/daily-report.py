#!/usr/bin/env python3
"""비나리 데일리 리포트 — PostHog에서 전일 지표를 뽑아 디스코드로 보낸다.

GitHub Actions(.github/workflows/daily-report.yml)가 매일 아침 자동 실행한다.
맥을 켜둘 필요도, Zapier 같은 중계 서비스도, 유료 플랜도 필요 없다.
표준 라이브러리만 쓰므로 pip 설치가 없다.

필요한 값 3개 — GitHub 저장소 Settings > Secrets and variables > Actions 에 넣는다.
    POSTHOG_API_KEY       PostHog > Settings > Personal API keys (query:read 권한)
    POSTHOG_PROJECT_ID    526669
    DISCORD_WEBHOOK_URL   디스코드 채널 편집 > 연동 > 웹후크 에서 복사한 주소
로컬에서 돌릴 때는 ~/.binari-report.env 에 같은 이름으로 넣어도 된다(git 에 올리지 말 것).

사용:
    python3 daily-report.py           # 전일 리포트를 디스코드로 발송
    python3 daily-report.py --dry     # 발송 없이 화면에만 출력(연결 점검용)
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ENV_PATH = Path.home() / ".binari-report.env"
PH_HOST = "https://us.posthog.com"
KEYS = ("POSTHOG_API_KEY", "POSTHOG_PROJECT_ID", "DISCORD_WEBHOOK_URL")


def load_env():
    """환경변수 우선, 없으면 ~/.binari-report.env 에서 읽는다."""
    cfg = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in KEYS:
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def post_json(url, payload, headers=None, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode("utf-8")
        return json.loads(body) if body.strip() else {}


def hogql(cfg, query):
    """PostHog Query API로 HogQL 실행 → 행 리스트."""
    url = f"{PH_HOST}/api/projects/{cfg['POSTHOG_PROJECT_ID']}/query/"
    out = post_json(url, {"query": {"kind": "HogQLQuery", "query": query}},
                    {"Authorization": f"Bearer {cfg['POSTHOG_API_KEY']}"})
    return out.get("results", [])


# ── 지표 ─────────────────────────────────────────────────────────────────────
# 내부(팀·지인) 트래픽을 항상 따로 센다. 섞어서 보면 게이트 판정이 무력화된다.
Q_DAILY = """
SELECT
    toDate(timestamp)                                   AS d,
    uniqIf(person_id, properties.is_internal != true)   AS people,
    uniqIf(person_id, properties.is_internal = true)    AS internal_people,
    countIf(event = 'app_open')                         AS visits,
    countIf(event = 'onboard_start')                    AS ob_start,
    countIf(event = 'guardian_awaken')                  AS ob_done,
    countIf(event = 'question_asked')                   AS asked,
    countIf(event = 'verdict_shown')                    AS verdicts,
    countIf(event = 'verdict_failed')                   AS failed,
    countIf(event = 'verdict_rated')                    AS rated,
    countIf(event = 'letter_clicked')                   AS letter,
    countIf(event = 'letter_intent_confirmed')          AS letter_yes,
    countIf(event = 'verdict_shared')                   AS shared
FROM events
WHERE timestamp >= today() - 2 AND event NOT LIKE '$%'
GROUP BY d ORDER BY d DESC LIMIT 3
"""

Q_DIR = """
SELECT properties.dir AS dir, count() AS n
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'verdict_shown'
GROUP BY dir ORDER BY n DESC
"""

# 실패는 원인을 알아야 손을 쓴다. rate_limited 면 RL_MAX, origin_blocked 면 허용목록 문제다.
Q_FAIL = """
SELECT properties.reason AS reason, count() AS n
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'verdict_failed'
GROUP BY reason ORDER BY n DESC
"""

# 온보딩에서 어느 화면이 사람을 가장 많이 잃는가
Q_ONBOARD = """
SELECT properties.step AS step, uniq(person_id) AS u
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'onboard_step'
GROUP BY step ORDER BY u DESC
"""

STEP_KO = {
    "name": "이름", "birth_date": "생년월일", "birth_time_city": "태어난 시·도시",
    "sex": "성별", "context": "직업·관계", "mbti": "MBTI",
    "values_16to6": "가치 16→6", "values_6to3": "가치 6→3", "values_3to1": "가치 3→1",
}
FAIL_KO = {
    "rate_limited": "호출 한도 초과", "upstream_error": "AI 서버 장애",
    "parse_failed": "응답 형식 오류", "origin_blocked": "허용되지 않은 주소",
    "bad_request": "잘못된 요청", "network": "네트워크",
}


def pct(a, b):
    return f"{round(a / b * 100)}%" if b else "—"


def delta(now, prev):
    if prev is None:
        return ""
    diff = now - prev
    return " (—)" if diff == 0 else f" ({'+' if diff > 0 else ''}{diff})"


def build_report(cfg):
    rows = hogql(cfg, Q_DAILY)
    if not rows:
        return "**비나리 데일리 리포트**\n\n전일 데이터가 없습니다. 배포 상태와 계측을 확인해주세요."

    keys = ["d", "people", "internal_people", "visits", "ob_start", "ob_done",
            "asked", "verdicts", "failed", "rated", "letter", "letter_yes", "shared"]
    t = dict(zip(keys, rows[0]))
    p = dict(zip(keys, rows[1])) if len(rows) > 1 else {}

    L = [f"**비나리 데일리 리포트 · {t['d']}**", ""]

    # ── 총평: 숫자보다 판단을 먼저 놓는다 ──
    if t["failed"] > 0:
        L.append(f"⚠️ 판결 **{t['failed']}건이 실패**했습니다. 유저가 판결을 못 받고 이탈한 만큼입니다.")
    elif t["asked"] == 0:
        L.append("전일 질문이 한 건도 없었습니다. 유입 경로부터 확인이 필요합니다.")
    else:
        L.append(f"질문 {t['asked']}건 전부 판결까지 정상 응답했습니다.")

    if t["people"] == 0 and t["internal_people"] > 0:
        L.append("_전일 활동은 전부 내부(팀·지인) 트래픽입니다. 제품 판단에 쓰지 마세요._")

    # ── 사람과 방문: 습관 앱의 핵심 축 ──
    L += ["", "```", f"외부 사용자   {t['people']:>4}{delta(t['people'], p.get('people'))}"]
    L.append(f"내부 사용자   {t['internal_people']:>4}   (지표에서 제외 대상)")
    per = round(t["visits"] / t["people"], 1) if t["people"] else 0
    L.append(f"방문          {t['visits']:>4}{delta(t['visits'], p.get('visits'))}"
             + (f"   1인 {per}회" if t["people"] else ""))

    # ── 퍼널 ──
    L += ["", f"온보딩 시작   {t['ob_start']:>4}",
          f"수호신 도달   {t['ob_done']:>4}   완주 {pct(t['ob_done'], t['ob_start'])}",
          f"질문          {t['asked']:>4}{delta(t['asked'], p.get('asked'))}",
          f"판결          {t['verdicts']:>4}{delta(t['verdicts'], p.get('verdicts'))}"]
    if t["failed"]:
        L.append(f"판결 실패     {t['failed']:>4}   ← 확인 필요")

    # ── 제품 신호 ──
    L += ["", f"판결 평가     {t['rated']:>4}   평가율 {pct(t['rated'], t['verdicts'])}",
          f"서신 클릭     {t['letter']:>4}   클릭률 {pct(t['letter'], t['verdicts'])}",
          f"  └ 받을게    {t['letter_yes']:>4}   전환 {pct(t['letter_yes'], t['letter'])}",
          f"공유          {t['shared']:>4}   공유율 {pct(t['shared'], t['verdicts'])}", "```"]

    # ── 판결 방향: HOLD 편중을 계속 본다 ──
    dirs = {str(r[0]): r[1] for r in hogql(cfg, Q_DIR)}
    tv = sum(dirs.values())
    if tv:
        go, hold, stop = dirs.get("GO", 0), dirs.get("HOLD", 0), dirs.get("STOP", 0)
        line = f"판결 방향 — GO {go} · HOLD {hold} ({pct(hold, tv)}) · STOP {stop}"
        if stop == 0 and tv >= 5:
            line += "\n_STOP이 한 건도 없습니다. '망설임엔 단언을'이 핵심 가치인데 제품이 '하지 마'를 말한 적이 없습니다._"
        L += ["", line]

    # ── 실패 원인: 있을 때만 ──
    if t["failed"]:
        fails = hogql(cfg, Q_FAIL)
        if fails:
            L += ["", "실패 원인 — " + " · ".join(
                f"{FAIL_KO.get(str(r[0]), str(r[0]))} {r[1]}건" for r in fails)]

    # ── 온보딩 최대 이탈 지점 ──
    ob = [(str(r[0]), r[1]) for r in hogql(cfg, Q_ONBOARD)]
    if len(ob) >= 2:
        worst, drop = None, 0
        for i in range(1, len(ob)):
            d = ob[i - 1][1] - ob[i][1]
            if d > drop:
                worst, drop = ob[i][0], d
        if worst and drop:
            L += ["", f"온보딩 최대 이탈 — {STEP_KO.get(worst, worst)} 화면에서 {drop}명"]

    return "\n".join(L)


def send_discord(cfg, text):
    # 디스코드 메시지 상한 2000자. 넘치면 잘라 보낸다(리포트를 통째로 잃는 것보다 낫다).
    if len(text) > 1900:
        text = text[:1890] + "\n…(생략)"
    post_json(cfg["DISCORD_WEBHOOK_URL"], {"content": text, "allowed_mentions": {"parse": []}})


def main():
    cfg = load_env()
    dry = "--dry" in sys.argv[1:]

    need = ["POSTHOG_API_KEY", "POSTHOG_PROJECT_ID"] + ([] if dry else ["DISCORD_WEBHOOK_URL"])
    missing = [k for k in need if not cfg.get(k)]
    if missing:
        sys.exit(f"설정 누락: {', '.join(missing)}")

    try:
        report = build_report(cfg)
    except urllib.error.HTTPError as e:
        sys.exit(f"PostHog 조회 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")

    if dry:
        print(report)
        return

    try:
        send_discord(cfg, report)
        print("발송 완료")
    except urllib.error.HTTPError as e:
        sys.exit(f"디스코드 발송 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")


if __name__ == "__main__":
    main()
