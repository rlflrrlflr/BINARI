/* 궁합을 여는 길 — **한 곳에만 적는다.**
   2026-08-28 에 궁합이 판결 탭에서 빠지고 곁 탭의 기능이 됐다(창업자 "판결 탭에서 궁합 없애").
   그때 세 검사가 동시에 타임아웃으로만 알려 왔다 — 길이 세 군데 베껴져 있었기 때문이다.
   앞으로 길이 또 바뀌면 여기만 고친다. */
export async function openMatch(page, { timeout = 15000 } = {}) {
  await page.getByRole("button", { name: "곁", exact: true }).click();
  await page.waitForTimeout(1100);
  const cta = page.getByRole("button", { name: /곁에 서|부르게 돼|둘 사이를 보면/ });
  if (await cta.count()) { await cta.first().click({ timeout }); }
  await page.waitForSelector(".impask", { timeout });
}
