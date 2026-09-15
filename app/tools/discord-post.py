#!/usr/bin/env python3
"""디스코드로 한 통 보낸다 — 보내는 방법이 사는 단 한 곳.

쓰는 법:  echo "본문" | DISCORD_WEBHOOK_URL=... python3 discord-post.py
         echo "본문" | DISCORD_BOT_TOKEN=... DISCORD_CHANNEL_ID=... python3 discord-post.py
         (본문은 표준입력으로 받는다. 셸에 끼워 넣지 않으므로 따옴표·백틱이 안 깨진다)

가는 길이 둘이다 — **채널이 정해져 있으면 그 채널로, 아니면 웹훅으로.**
  ⚠ 2026-09-15 실사고: 디자인 채널에서 시킨 작업의 결과가 **데이터 채널**에 떴다.
    하드코딩 때문이 아니다 — **웹훅은 만들어진 채널 하나에 영구히 묶인다.**
    그 웹훅이 아침 지표용(데이터 채널)이라, 어디서 시키든 결과가 거기로만 갔다.
    시킨 사람은 자기 채널만 보고 있으니 **아무 일도 안 일어난 것처럼 보인다.**
  → 명령이 온 채널을 알면 **봇 토큰으로 그 채널에 직접 쓴다.**
    못 쓰면(권한 없음 등) **웹훅으로라도 보낸다** — 결과를 통째로 잃는 것보다 낫다.

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


def _send(url, content, auth=None, timeout=20):
    content = (content or "").strip()
    if not content:
        raise ValueError("보낼 본문이 비었다")
    body = json.dumps({
        "content": content[:MAX_LEN],
        # 알림 폭탄 방지 — 본문에 @everyone 이 섞여도 실제로 멘션되지 않는다
        "allowed_mentions": {"parse": []},
    }).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": USER_AGENT}
    if auth:
        headers["Authorization"] = auth
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status


def post(webhook, content, timeout=20):
    """웹훅으로 보낸다(채널이 고정된 길)."""
    return _send(webhook, content, timeout=timeout)


def post_channel(channel_id, bot_token, content, timeout=20):
    """봇 토큰으로 **그 채널에** 보낸다 — 시킨 사람이 보고 있는 곳."""
    return _send(f"https://discord.com/api/v10/channels/{channel_id}/messages",
                 content, auth=f"Bot {bot_token}", timeout=timeout)


def main():
    hook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    chan = os.environ.get("DISCORD_CHANNEL_ID", "").strip()
    bot  = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    if not hook and not (chan and bot):
        # 보낼 길이 아예 없는 환경(포크·시험 실행)에서는 실패가 아니다.
        print("보낼 길이 없다 — 보내지 않는다(실패는 아니다)")
        return 0
    content = sys.stdin.read()

    # ① 명령이 온 채널을 알면 거기로. 시킨 사람이 보고 있는 곳이 거기다.
    if chan and bot:
        try:
            post_channel(chan, bot, content)
            print(f"보냈다 — 명령이 온 채널({chan})")
            return 0
        except Exception as e:
            # ⚠ 여기서 죽지 않는다. 결과를 통째로 잃는 것보다 **엉뚱한 채널에라도 닿는 게** 낫다.
            #   대신 어디로 갔는지 반드시 말한다 — 조용히 다른 데로 가면 그게 이번 사고였다.
            print(f"::warning::그 채널에 못 썼다({str(e)[:120]}) — 웹훅 채널로 보낸다. "
                  f"봇이 그 채널에 글쓰기 권한이 있는지 확인해라.")
            if not hook:
                print("::error::웹훅도 없어서 결과를 못 보냈다.")
                return 1

    # ② 채널을 모르면(손으로 돌린 판 등) 웹훅으로.
    try:
        post(hook, content)
        print("보냈다 — 웹훅 채널")
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
