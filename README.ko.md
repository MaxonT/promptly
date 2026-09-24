# Promptly

**언어 / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

AI 프롬프트 최적화 스튜디오: 거친 목표를 Spec → Questions → Candidates → Metrics → Outcome 로 더 명확한 프롬프트로 바꿉니다.

API 키를 직접 설정하고 싶지 않다면 호스팅 제품을 사용하세요: **[https://promptly.solutions/](https://promptly.solutions/)**  
(Releases에도 링크되어 있습니다)

**핵심 제품 코드는 `cursor-dev`에 있습니다.**  
`main`은 공개 진입 / 문서 브랜치입니다. 일상 개발은 `cursor-dev`에서 진행합니다.

현재 실행 가능한 트리: [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## 클라우드 vs 셀프호스트

| 경로 | 언제 쓰나요 |
|------|-------------|
| **클라우드** — [promptly.solutions](https://promptly.solutions/) | `OPENAI_API_KEY` / OAuth / 배포 없이 제품 체험 |
| **로컬 / 셀프호스트** | 개발·커스터마이즈, 또는 본인 키로 백엔드 실행 |

---

## 빠른 시작 (로컬)

fullstack 폴더에서 작업합니다:

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. 백엔드

```bash
cd backend
cp .env.example .env
# 최소 설정: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (시작 시 마이그레이션)
```

AI 기능 최소 환경 변수:

| 변수 | 용도 |
|------|------|
| `JWT_SECRET` | JWT 서명 (프로덕션 필수, 충분히 긴 난수 문자열) |
| `OPENAI_API_KEY` | OpenAI 접근 — 없으면 LLM / pipeline 비활성 |
| `OPENAI_MODEL` | 선택 (예시 기본값: `gpt-4.1-mini`) |
| `CORS_ORIGIN` | 허용 프론트엔드 오리진 (쉼표 구분) |
| `SQLITE_PATH` | 로컬 DB (기본 `./data/app.db`) |
| `DATABASE_URL` | 설정 시 PostgreSQL 사용 |
| `GROQ_API_KEY` | 일부 프로필용 선택적 Groq 경로 |
| `FRONTEND_URL` | Stripe / OAuth 리다이렉트 기준 |
| `GOOGLE_*` / `GITHUB_*` | OAuth (선택) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | 결제 (선택) |

전체 목록: [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. 프론트엔드

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

`http://localhost:4173/index.html` 을 엽니다.  
페이지는 `config.js`의 `window.PROMPTLY_API_BASE`를 읽습니다 (`npm run build`로 생성).

### 3. 스모크 체크

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## 할 수 있는 일

| 기능 | 설명 |
|------|------|
| 홈 / 최적화 | 다단계 프롬프트 파이프라인 + 실시간 진행 |
| Brainstormer (위저드) | 생성 전 의도를 좁히는 Q&A |
| Specs | 목표·답변에서 Spec 추출 / 검토 |
| Enhancer | 기존 프롬프트 반복 개선 |
| Outcome | 후보 비교와 메트릭 / Outcome 실행 |
| Result | 공유 가능한 결과 뷰 |
| Auth | 이메일/비밀번호 + Google / GitHub OAuth |
| 사용량 제한 | 일일 배너 / 플랜 한도 |
| 구독 | Stripe 결제 (env로 활성화) |
| Analytics | 관리자 분석 화면 |
| i18n | 9개 로케일 + 언어 선택기 |

---

## 기술 스택

| 계층 | 선택 |
|------|------|
| Frontend | 정적 HTML / CSS / JS (`config.js`가 API 베이스 주입) |
| Backend | Node.js ESM + Express |
| Database | 로컬 SQLite; `DATABASE_URL` 있으면 PostgreSQL |
| Auth | JWT + bcrypt; Google / GitHub OAuth |
| AI | OpenAI (주); `GROQ_API_KEY`로 Groq 선택 |
| Billing | Stripe (선택) |
| Deploy | Render (API) + Vercel / 정적 호스트 (frontend) |

---

## 아키텍처 (요약)

```
브라우저 (정적 프론트)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite 또는 PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (선택)
```

핵심 최적화 흐름: `/api/pipeline/*` (`run`, `health`, `stream/:runId`).

---

## 주요 페이지

| 경로 | 용도 |
|------|------|
| `frontend/index.html` | 랜딩 / 최적화 |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / 메트릭 |
| `frontend/result.html` | 결과 뷰 |
| `frontend/settings.html` | 계정 / 설정 |
| `frontend/subscription.html` | 플랜 & 결제 |
| `frontend/account.html` | 계정 패널 |

중첩 제품 README (배포 상세):  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## 스크립트

```bash
# Backend
cd Promptly-cloud-v0.6.8.3-fullstack/backend
npm run dev
npm start
npm run health
npm run migrate
npm test

# Frontend
cd Promptly-cloud-v0.6.8.3-fullstack/frontend
npm run build
```

---

## 브랜치 & 레이아웃

| 항목 | 역할 |
|------|------|
| `cursor-dev` | **활성 개발** — 제품 소스 오브 트루스 |
| `main` | 공개 README / 진입 docs |
| `Promptly-cloud-v0.6.8.3-fullstack/` | `main`의 현재 fullstack |
| 이전 `Promptly-cloud-v0.6.*` | 과거 스냅샷 |
| `milestones/` | 마일스톤 산출물 |
| `Promptly 0.6.8 Fix Bundles/` | 픽스 번들 보관 |

---

## 라이선스

중첩 패키지 docs는 MIT입니다. `.env`와 API 키는 비밀로 취급하고 커밋하지 마세요.
