/* 브라우저 콘솔에 붙여넣어 쓰는 추출기 — 에이전트가 못 가는 페이지에서 사람이 한 번 긁는 용도.
 *
 * 쓰는 법
 *   1) 대법원 통계 페이지를 연다
 *      https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025
 *      → '출생신고 시 선호하는 이름' → 연도·성별 조건으로 조회 (표가 화면에 보이는 상태)
 *   2) F12 → Console 탭 → 아래 전체를 붙여넣고 Enter
 *   3) CSV 가 출력되고 클립보드에도 복사된다. 그대로 채팅에 붙여넣거나 파일로 저장.
 *   4) 연도·성별 바꿔 조회하고 2)를 반복. 최소 3개 연도.
 *
 * 화면의 모든 <table> 을 훑어 '한글 이름 + 숫자'가 있는 행만 건진다.
 * 페이지 구조가 바뀌어도 대체로 살아남게 만든 것이라, 열 이름을 안다면 손으로 고쳐도 된다.
 */
(() => {
  const NAME = /^[가-힣]{2,4}$/;
  const num = s => { const t = String(s).replace(/[,\s명]/g, ""); return /^\d+$/.test(t) ? +t : null; };
  const rows = [];
  for (const table of document.querySelectorAll("table")) {
    for (const tr of table.querySelectorAll("tr")) {
      const cells = [...tr.querySelectorAll("td,th")].map(td => td.textContent.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const name = cells.find(c => NAME.test(c) && !["남자","여자","순위","이름","인원","합계"].includes(c));
      if (!name) continue;
      const nums = cells.map(num).filter(n => n !== null);
      if (!nums.length) continue;
      rows.push({ name, count: Math.max(...nums) });      // 순위·인원이 같이 있으면 큰 쪽이 인원
    }
  }
  if (!rows.length) { console.warn("표를 못 찾았습니다. 조회 결과가 화면에 떠 있는지 확인하세요."); return; }

  const g = (prompt("성별을 입력하세요 — m(남) 또는 f(여)", "m") || "m").trim().toLowerCase();
  const gender = g.startsWith("f") || g.startsWith("여") ? "f" : "m";
  const csv = ["name,gender,count", ...rows.map(r => `${r.name},${gender},${r.count}`)].join("\n");

  console.log(`%c추출 ${rows.length}행 (성별 ${gender})`, "font-weight:bold");
  console.log(csv);
  navigator.clipboard?.writeText(csv)
    .then(() => console.log("%c클립보드에 복사됨 — 그대로 붙여넣으세요", "color:green"))
    .catch(() => console.log("클립보드 복사 실패 — 위 CSV 를 직접 긁어 쓰세요"));
  return csv;
})();
