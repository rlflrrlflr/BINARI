#!/usr/bin/env python3
"""결정 7 — 커밋 이력에 남은 개인정보 제거 (준비 완료 · 실행은 창업자 지시 후)

무엇을 하나
  `05_실험/판독기_v01/verify-sky.mjs` · `verify-flow.mjs` 의 **모든 과거 판본을
  현재의 가상 명식 판본으로 통째 교체**한다. 두 파일의 8/11 판본(46ca39d·6b84fe8)에
  실인물의 생년월일·생시·지역이 고정값으로 박혀 있었다. HEAD 는 이미 깨끗하다.

왜 '값 치환'이 아니라 '파일 통째 교체'인가
  ①값을 열거해 치환하면 **이 스크립트 안에 PII 를 옮겨 적게 된다**
  ②숫자 치환은 다른 파일의 같은 숫자까지 건드린다(예: 연도)

실행 전 반드시
  1. **저장소를 비공개로 먼저 돌린다.** 재작성 중에도 노출은 계속된다.
     (GitHub → Settings → General → Danger Zone → Change visibility)
  2. **다른 세션을 멈춘다.** 이 리포는 하루 열 판 넘게 움직이고, 강제 푸시는
     그 사이 올라온 커밋을 날린다. 실행 직전 `git fetch` 로 최신을 확인할 것.
  3. 팀 4명에게 **재클론 예고**. 이후 모든 커밋 해시가 바뀐다.

실행
    pip install git-filter-repo
    git clone --mirror https://github.com/rlflrrlflr/BINARI /tmp/binari-mirror
    mkdir -p /tmp/clean && cd /tmp/binari-mirror
    git show main:05_실험/판독기_v01/verify-sky.mjs  > /tmp/clean/verify-sky.mjs
    git show main:05_실험/판독기_v01/verify-flow.mjs > /tmp/clean/verify-flow.mjs
    CLEAN=/tmp/clean git filter-repo --force \
      --file-info-callback "$(sed -n '/^# ---8<---/,$p' /path/to/tools/history-redact.py)"

검증 (푸시 전)
    git log --all -p -- 05_실험/판독기_v01/verify-sky.mjs | grep -c '가상'
      → 이력 속 모든 판본이 가상 명식이어야 한다
    git rev-list --all --count
      → 커밋 수가 그대로여야 한다(내용만 바뀌고 구조는 안 바뀐다)

푸시
    git push --force --all && git push --force --tags

⚠ 푸시 뒤에도 끝이 아니다
  GitHub 는 고아 커밋을 즉시 지우지 않는다. **SHA 를 아는 사람은 당분간 계속 볼 수 있다.**
  GitHub 지원팀에 캐시·리플로그 삭제를 별도로 요청해야 한다.
  포크가 있으면 포크에도 남는다(2026-08-17 확인 시점 fork 0).

"""
# ---8<--- 아래부터가 --file-info-callback 본문 ---8<---
import os
_CLEAN_DIR = os.environ.get("CLEAN", "/tmp/clean")
_TARGETS = {
    b"05_\xec\x8b\xa4\xed\x97\x98/\xed\x8c\x90\xeb\x8f\x85\xea\xb8\xb0_v01/verify-sky.mjs":  "verify-sky.mjs",
    b"05_\xec\x8b\xa4\xed\x97\x98/\xed\x8c\x90\xeb\x8f\x85\xea\xb8\xb0_v01/verify-flow.mjs": "verify-flow.mjs",
}
_CACHE = {}

def file_info_callback(filename, mode, blob_id, value):
    name = _TARGETS.get(filename)
    if not name:
        return (filename, mode, blob_id)
    if name not in _CACHE:
        with open(os.path.join(_CLEAN_DIR, name), "rb") as fh:
            _CACHE[name] = fh.read()
    return (filename, mode, value.insert_file_with_contents(_CACHE[name]))
