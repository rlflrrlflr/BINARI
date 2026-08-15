/* 온보딩 통과 헬퍼 — 로비(질문 입력칸)까지 데려다 놓는다.
   verdict.mjs 안에만 있던 걸 꺼냈다. 로비 뒤에 붙은 상품(각인·궁합)이 늘면서
   "온보딩부터 다시 통과시켜야 하는" 검사가 여럿 생겼고, 화면 문구가 바뀔 때마다
   같은 수정을 파일 수만큼 반복하게 되기 때문이다.

   ⚠ 생년월일은 가상 값이다(CLAUDE.md §운영 규칙 — 실제 인물의 값을 쓰지 않는다).
      검사에 필요한 건 '고정된 입력'이지 '진짜 입력'이 아니다. */
export async function onboard(page, BASE, qs = "", nm = "") {
  await page.goto(BASE + qs); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  if (nm) {                                                            // 이름을 넣고 들어가는 경로
    await page.locator("input.in.wide.center").fill(nm); await page.waitForTimeout(200);
    await page.getByRole("button", { name: new RegExp(nm + " — 그래") }).click();
  } else await page.getByRole("button", { name: "이름 없이 갈래" }).click();
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await page.getByRole("button", { name: "기억났어" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 });
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}
