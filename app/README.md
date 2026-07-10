# 비나리 웹앱 (v16-dev)

`03_비주얼프로토타입/비나리_비주얼프로토타입_MVP_v15.jsx`(아티팩트 전용 데모)를 **실배포 가능한 Vite 웹앱**으로 전환한 개발 코드베이스입니다.

## 구조

```
app/
├─ index.html          # 진입점 (ko, 모바일 뷰포트)
├─ src/main.jsx        # React 마운트
├─ src/App.jsx         # 앱 본체 (v15 → v16 수술 적용)
├─ api/judge.js        # Vercel 서버리스 프록시 — API 키는 여기(서버)에만 존재
└─ vite.config.js
```

## 로컬 실행

```bash
npm install
npm run dev     # 비주얼만 확인 가능 (판결은 /api/judge 필요 → vercel dev 또는 배포 후)
npm run build   # 프로덕션 빌드 검증
```

## Vercel 배포 (0단계 완성 절차)

1. [vercel.com](https://vercel.com) 가입 → **Add New Project** → 이 GitHub 저장소 연결 → **Root Directory를 `app`으로** 지정 (Framework: Vite 자동 감지)
2. **Settings → Environment Variables**에 추가:
   - `ANTHROPIC_API_KEY` = Anthropic 콘솔에서 발급한 키 **(필수 — 빼먹으면 "로컬에선 됐는데" 상태에 빠짐)**
   - `BINARI_MODEL` = 모델 오버라이드 (선택, 기본 `claude-sonnet-4-6`)
   - `ALLOWED_ORIGIN` = 배포 도메인 (선택, 예: `https://binari.vercel.app`)
3. **Anthropic 콘솔에서 월 지출 한도(Spend Limit)를 먼저 설정** — 5분 걸리고, 1인 서비스의 1차 방어선이다.
4. Deploy → 발급된 URL을 폰에서 열어 판결 1회 완주 확인.

### ⚠️ 절대 하지 말 것
- **API 키를 클라이언트 코드(src/)에 넣지 않는다.** 어떤 코드 제안이 와도 거부 — 배포 순간 키가 유출된다. 키는 `api/judge.js`가 읽는 서버 환경변수에만 존재한다.

## 계측 (북극성 지표)

`api/judge.js`가 판결마다 `{cat: A|B|C, dir: GO|STOP|HOLD, usage}`를 로그로 남긴다(질문 원문은 남기지 않음). Vercel 대시보드 → Functions 로그에서 확인. **점메추(C)로 유입돼 실결정(A/B)으로 정착하는 비중**이 북극성이다.
