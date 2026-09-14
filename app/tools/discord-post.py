#!/usr/bin/env python3
"""디스코드로 한 통 보낸다 — 보내는 방법이 사는 단 한 곳.

쓰는 법:  echo "본문" | DISCORD_WEBHOOK_URL=... python3 discord-post.py
         (본문은 표준입력으로 받는다. 셸에 끼워 넣지 않으므로 따옴표·백틱이 안 깨진다)

왜 한 곳으로 모으나 — 같은 함정을 두 번 밟았다:
  2026-07-28  아침 지표 첫 발송이 **403** 으로 실패했다. 원인은 파이썬 기본 User-Agent 였다.
              디스코드는 자기를 안 밝히는 요청을 막는다. 그때 `daily-report.py` 에 고쳤고
              사유도 주석으로 적어 뒀다.
  2026-09-14  `deploy-notify.yml` 을 새로 만들면서 **같은 403 으로 네 번 실패**했다.
              고친 코드가 한 파일에만 있어서, 새 파일은 그 교훈을 물려받지 못했다.
  → 그래서 보내는 방법을 여기 한 곳에 둔다. 새로 만드는 쪽은 이걸 부르기만 한다.

⚠ 실패를 조용히 삼키지 않는다. 알림이 안 갔는데 워크플로가 초록으로 끝나면,
  「알림이 안 온다 = 바뀐 게 없다」로 읽혀서 **없는 평온**을 만든다.
  그게 이 알림을 만든 이유(피드백이 안 닫히는 것)와 정면으로 어긋난다.
"""
import json
import os
import sys
import urllib.error
import urllib.request

# 디스코드 API 문서가 요구하는 형식으로 자신을 밝힌다. 이 줄이 없으면 403 이다.
USER_AGENT = "DiscordBot (https://binari-sepia.vercel.app, 1.0)"

# 디스코드 한 통 상한은 2000자. 여유를 두고 자른다 — 넘으면 400 으로 통째로 안 간다.
MAX_LEN = 1900


def post(webhook, content, timeout=20):
    content = (content or "").strip()
    if not content:
        raise ValueError("보낼 본문이 비었다")
    body = json.dumps({
        "content": content[:MAX_LEN],
        # 알림 폭탄 방지 — 본문에 @everyone 이 섞여도 실제로 멘션되지 않는다
        "allowed_mentions": {"parse": []},
    }).encode("utf-8")
    req = urllib.request.Request(webhook, data=body, headers={
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status


def main():
    hook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    if not hook:
        # 웹훅이 아예 설정되지 않은 환경(포크·시험 실행)에서는 실패가 아니다.
        print("웹훅 주소가 없다 — 보내지 않는다(실패는 아니다)")
        return 0
    content = sys.stdin.read()
    try:
        post(hook, content)
        print("보냈다")
        return 0
    except ValueError as e:
        print(f"::error::{e}")
        return 1
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:200]
        print(f"::error::디스코드가 거절했다 ({e.code}). {detail}")
        if e.code == 403:
            print("::error::403 은 대개 User-Agent 문제다. 이 파일을 안 거치고 직접 보내지 마라.")
        if e.code in (401, 404):
            print("::error::웹훅 주소가 지워졌거나 틀렸다. DISCORD_WEBHOOK_URL 을 다시 넣어라.")
        return 1
    except Exception as e:                       # 네트워크·시간초과
        print(f"::error::디스코드로 못 보냈다 — {str(e)[:160]}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
