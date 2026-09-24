# Promptly

**言語 / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

AI プロンプト最適化スタジオ：曖昧なゴールを Spec → Questions → Candidates → Metrics → Outcome で、より明確なプロンプトに変換します。

API キーを自分で設定したくない場合は、ホスト済み製品を利用してください：**[https://promptly.solutions/](https://promptly.solutions/)**  
（Releases からもリンクされています）

**中核のプロダクトコードは `cursor-dev` にあります。**  
`main` は公開エントリ / ドキュメント用ブランチです。日常の開発は `cursor-dev` で行います。

現在の実行可能なツリー：[`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## クラウド vs セルフホスト

| 経路 | 使うタイミング |
|------|----------------|
| **クラウド** — [promptly.solutions](https://promptly.solutions/) | `OPENAI_API_KEY` / OAuth / デプロイなしで試す |
| **ローカル / セルフホスト** | 開発・カスタム、または自分のキーでバックエンドを動かす |

---

## クイックスタート（ローカル）

fullstack フォルダ内で作業します：

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. バックエンド

```bash
cd backend
cp .env.example .env
# 最低限設定: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080（起動時にマイグレーション）
```

AI 機能の最小環境変数：

| 変数 | 用途 |
|------|------|
| `JWT_SECRET` | JWT 署名（本番必須・十分長い乱数文字列） |
| `OPENAI_API_KEY` | OpenAI アクセス — 未設定だと LLM / pipeline は無効 |
| `OPENAI_MODEL` | 任意（例のデフォルト: `gpt-4.1-mini`） |
| `CORS_ORIGIN` | 許可するフロントエンドオリジン（カンマ区切り） |
| `SQLITE_PATH` | ローカル DB（デフォルト `./data/app.db`） |
| `DATABASE_URL` | 設定すると PostgreSQL を使用 |
| `GROQ_API_KEY` | 一部プロファイル向けの任意 Groq パス |
| `FRONTEND_URL` | Stripe / OAuth リダイレクト基点 |
| `GOOGLE_*` / `GITHUB_*` | OAuth（任意） |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | 課金（任意） |

一覧：[`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. フロントエンド

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

`http://localhost:4173/index.html` を開きます。  
ページは `config.js` の `window.PROMPTLY_API_BASE` を読みます（`npm run build` で生成）。

### 3. スモークチェック

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## できること

| 機能 | 内容 |
|------|------|
| ホーム / 最適化 | 多段階プロンプトパイプライン + ライブ進捗 |
| Brainstormer（ウィザード） | 生成前に意図を絞り込む Q&A |
| Specs | ゴールと回答からの Spec 抽出 / 確認 |
| Enhancer | 既存プロンプトの反復改善 |
| Outcome | 候補比較とメトリクス / Outcome 実行 |
| Result | 共有可能な結果ビュー |
| Auth | メール/パスワード + Google / GitHub OAuth |
| 利用制限 | 日次利用バナー / プラン上限 |
| サブスクリプション | Stripe チェックアウト（env で有効化） |
| Analytics | 管理用分析画面 |
| i18n | 9 ロケール + 言語セレクタ |

---

## 技術スタック

| 層 | 選択 |
|----|------|
| Frontend | 静的 HTML / CSS / JS（`config.js` が API ベースを注入） |
| Backend | Node.js ESM + Express |
| Database | ローカル SQLite；`DATABASE_URL` があれば PostgreSQL |
| Auth | JWT + bcrypt；Google / GitHub OAuth |
| AI | OpenAI（主）；`GROQ_API_KEY` で Groq も可 |
| Billing | Stripe（任意） |
| Deploy | Render（API）+ Vercel / 静的ホスト（frontend） |

---

## アーキテクチャ（短）

```
ブラウザ（静的フロント）
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite または PostgreSQL
    ├─► OpenAI / Groq（Spec → Questions → Agents → Metrics → Outcome）
    └─► Stripe（任意）
```

コア最適化フロー：`/api/pipeline/*`（`run`、`health`、`stream/:runId`）。

---

## 主要ページ

| パス | 用途 |
|------|------|
| `frontend/index.html` | ランディング / 最適化 |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / メトリクス |
| `frontend/result.html` | 結果ビュー |
| `frontend/settings.html` | アカウント / 設定 |
| `frontend/subscription.html` | プランと課金 |
| `frontend/account.html` | アカウントパネル |

ネストされた製品 README（デプロイ詳細）：  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## スクリプト

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

## ブランチとレイアウト

| 項目 | 役割 |
|------|------|
| `cursor-dev` | **アクティブ開発** — 製品のソース・オブ・トゥルース |
| `main` | 公開 README / エントリ docs |
| `Promptly-cloud-v0.6.8.3-fullstack/` | `main` 上の現行 fullstack |
| 古い `Promptly-cloud-v0.6.*` | 過去スナップショット |
| `milestones/` | マイルストーン成果物 |
| `Promptly 0.6.8 Fix Bundles/` | 修正バンドル保管 |

---

## ライセンス

ネストされたパッケージ docs は MIT。`.env` と API キーは秘匿情報として扱い、コミットしないでください。
