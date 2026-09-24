# Promptly

**اللغات / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

استوديو لتحسين الـ Prompt بالذكاء الاصطناعي: حوّل هدفًا غامضًا إلى Prompt أوضح عبر Spec → Questions → Candidates → Metrics → Outcome.

لا تريد إعداد مفتاح API بنفسك؟ استخدم المنتج المستضاف: **[https://promptly.solutions/](https://promptly.solutions/)**  
(مذكور أيضًا في Releases)

**الشيفرة الأساسية للمنتج موجودة على `cursor-dev`.**  
`main` هو فرع الدخول العام / التوثيق. العمل اليومي للتطبيق يتم على `cursor-dev`.

الشجرة القابلة للتشغيل حاليًا: [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## السحابة مقابل الاستضافة الذاتية

| المسار | متى تستخدمه |
|--------|-------------|
| **السحابة** — [promptly.solutions](https://promptly.solutions/) | جرّب المنتج دون إعداد `OPENAI_API_KEY` / OAuth / النشر |
| **محلي / استضافة ذاتية** | للتطوير أو التخصيص أو تشغيل الخلفية بمفاتيحك |

---

## بداية سريعة (محليًا)

اعمل داخل مجلد fullstack:

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. الخلفية (Backend)

```bash
cd backend
cp .env.example .env
# عيّن على الأقل: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (ترحيلات عند البدء)
```

الحد الأدنى لمتغيرات البيئة لميزات الذكاء الاصطناعي:

| المتغير | الغرض |
|---------|-------|
| `JWT_SECRET` | توقيع JWT (مطلوب في الإنتاج؛ سلسلة عشوائية طويلة) |
| `OPENAI_API_KEY` | وصول OpenAI — بدونه تُعطَّل LLM / pipeline |
| `OPENAI_MODEL` | اختياري (الافتراضي في المثال: `gpt-4.1-mini`) |
| `CORS_ORIGIN` | أصول الواجهة المسموحة (مفصولة بفواصل) |
| `SQLITE_PATH` | قاعدة محلية (الافتراضي `./data/app.db`) |
| `DATABASE_URL` | يفعّل PostgreSQL بدل SQLite |
| `GROQ_API_KEY` | مسار Groq اختياري لبعض الملفات الشخصية |
| `FRONTEND_URL` | أساس إعادة التوجيه لـ Stripe / OAuth |
| `GOOGLE_*` / `GITHUB_*` | OAuth (اختياري) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | الفوترة (اختياري) |

القائمة الكاملة: [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. الواجهة (Frontend)

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

افتح `http://localhost:4173/index.html`.  
تقرأ الصفحات `window.PROMPTLY_API_BASE` من `config.js` (يُنشأ عبر `npm run build`).

### 3. فحوصات سريعة

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## ما يمكنك فعله

| الميزة | ماذا تفعل |
|--------|-----------|
| الرئيسية / تحسين | تشغيل خط أنابيب متعدد المراحل مع تقدّم مباشر |
| Brainstormer (معالج) | أسئلة وأجوبة موجَّهة لتوضيح النية |
| Specs | استخراج / مراجعة المواصفات من الأهداف والإجابات |
| Enhancer | تحسين الـ Prompts الحالية بشكل تكراري |
| Outcome | مقارنة المرشحين مع المقاييس / تشغيلات Outcome |
| Result | عرض نتيجة قابل للمشاركة |
| المصادقة | بريد/كلمة مرور + OAuth Google / GitHub |
| حدود الاستخدام | شريط يومي / حدود الخطة |
| الاشتراكات | دفع Stripe (يُفعَّل عبر env) |
| Analytics | لوحات تحليل للإدارة |
| i18n | تسع لغات مع مبدّل اللغة |

---

## المكدس التقني

| الطبقة | الاختيار |
|--------|----------|
| Frontend | HTML / CSS / JS ثابت (`config.js` يحقن قاعدة الـ API) |
| Backend | Node.js ESM + Express |
| قاعدة البيانات | SQLite محليًا؛ PostgreSQL عند وجود `DATABASE_URL` |
| المصادقة | JWT + bcrypt؛ OAuth Google / GitHub |
| الذكاء الاصطناعي | OpenAI (أساسي)؛ Groq اختياري عبر `GROQ_API_KEY` |
| الفوترة | Stripe (اختياري) |
| النشر | Render (API) + Vercel أو استضافة ثابتة (frontend) |

---

## المعمارية (مختصر)

```
المتصفح (واجهة ثابتة)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite أو PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (اختياري)
```

التدفق الأساسي: `/api/pipeline/*` (`run`، `health`، `stream/:runId`).

---

## الصفحات الرئيسية

| المسار | الغرض |
|--------|-------|
| `frontend/index.html` | الصفحة الرئيسية / التحسين |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / المقاييس |
| `frontend/result.html` | عرض النتيجة |
| `frontend/settings.html` | الحساب / الإعدادات |
| `frontend/subscription.html` | الخطط والفوترة |
| `frontend/account.html` | لوحة الحساب |

README الداخلي (تفاصيل نشر أكثر):  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## الأوامر

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

## الفروع والبنية

| العنصر | الدور |
|--------|-------|
| `cursor-dev` | **التطوير النشط** — مصدر الحقيقة للمنتج |
| `main` | README / وثائق الدخول العامة |
| `Promptly-cloud-v0.6.8.3-fullstack/` | لقطة fullstack الحالية على `main` |
| مجلدات `Promptly-cloud-v0.6.*` الأقدم | لقطات تاريخية |
| `milestones/` | مخرجات المعالم |
| `Promptly 0.6.8 Fix Bundles/` | أرشيف حزم الإصلاح |

---

## الترخيص

وثائق الحزمة تشير إلى MIT. اعتبر `.env` ومفاتيح API أسرارًا — لا ترفعها إلى المستودع.
