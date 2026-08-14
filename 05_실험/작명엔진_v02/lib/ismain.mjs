/* 이 파일이 직접 실행됐는가.
   `import.meta.url === "file://" + process.argv[1]` 는 경로에 한글·공백이 있으면 깨진다
   (import.meta.url 은 퍼센트 인코딩되지만 argv[1] 은 원문). 저장소 경로가 `05_실험/...` 이라 실제로 깨졌다. */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function isMain(metaUrl) {
  try { return realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1]); }
  catch { return false; }
}
