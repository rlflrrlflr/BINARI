/* 동전 의식 통과 헬퍼 (v140) — '판결을 청한다' 를 누른 뒤 여섯 번 던져 판결까지 보낸다.
   ⚠ v129.2~v139 동안 의식이 꺼져 있어서 검사들이 '청한다 → 곧장 판결'을 전제로 쓰였다.
     v140 에 되살리면서 그 전제가 깨졌으므로, onboard.mjs 와 같은 이유로 헬퍼를 하나로 뺀다 —
     화면 문구가 바뀔 때마다 파일 수만큼 같은 수정을 반복하지 않기 위해서다.
   ⚠ 의식이 다시 꺼지면(`COIN_RITUAL = false`) 던질 버튼이 없다. 그때는 조용히 통과한다 —
     검사가 스위치 상태에 안 묶이게. */
export async function throwCoins(page, { timeout = 20000 } = {}) {
  const btn = () => page.getByRole("button", { name: /쥐었다 놓아 던진다/ });
  if (await btn().count() === 0) return false;          // 의식이 꺼져 있다 — 할 일 없음
  for (let i = 0; i < 6; i++) {
    await btn().click({ timeout });
    await page.waitForTimeout(1150);                     // 체공(최대 ~1.2s) + 낙착
  }
  return true;
}
