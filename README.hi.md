# Promptly

**भाषाएँ / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

AI प्रॉम्प्ट ऑप्टिमाइज़ेशन स्टूडियो: एक अस्पष्ट लक्ष्य को Spec → Questions → Candidates → Metrics → Outcome के ज़रिए साफ़ प्रॉम्प्ट में बदलें।

API key खुद कॉन्फ़िगर नहीं करना चाहते? होस्टेड प्रोडक्ट इस्तेमाल करें: **[https://promptly.solutions/](https://promptly.solutions/)**  
(Releases में भी लिंक है)

**मुख्य प्रोडक्ट कोड `cursor-dev` पर है।**  
`main` सार्वजनिक एंट्री / डॉक्स ब्रांच है। रोज़मर्रा का ऐप काम `cursor-dev` पर होता है।

वर्तमान रन करने योग्य ट्री: [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## क्लाउड बनाम सेल्फ़-होस्ट

| पथ | कब इस्तेमाल करें |
|----|-------------------|
| **क्लाउड** — [promptly.solutions](https://promptly.solutions/) | बिना `OPENAI_API_KEY` / OAuth / डिप्लॉय सेट किए आज़माएँ |
| **लोकल / सेल्फ़-होस्ट** | डेवलप, कस्टमाइज़, या अपनी keys से बैकएंड चलाएँ |

---

## त्वरित शुरुआत (लोकल)

fullstack फ़ोल्डर में काम करें:

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. बैकएंड

```bash
cd backend
cp .env.example .env
# कम से कम सेट करें: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (स्टार्ट पर माइग्रेशन)
```

AI सुविधाओं के लिए न्यूनतम env:

| वेरिएबल | उद्देश्य |
|---------|----------|
| `JWT_SECRET` | JWT साइनिंग (प्रोडक्शन में ज़रूरी; लंबी रैंडम स्ट्रिंग) |
| `OPENAI_API_KEY` | OpenAI एक्सेस — बिना इसके LLM / pipeline बंद |
| `OPENAI_MODEL` | वैकल्पिक (उदाहरण डिफ़ॉल्ट: `gpt-4.1-mini`) |
| `CORS_ORIGIN` | अनुमत फ्रंटएंड ओरिजिन (कॉमा से अलग) |
| `SQLITE_PATH` | लोकल DB (डिफ़ॉल्ट `./data/app.db`) |
| `DATABASE_URL` | सेट करने पर PostgreSQL |
| `GROQ_API_KEY` | कुछ प्रोफ़ाइलों के लिए वैकल्पिक Groq पथ |
| `FRONTEND_URL` | Stripe / OAuth रीडायरेक्ट बेस |
| `GOOGLE_*` / `GITHUB_*` | OAuth (वैकल्पिक) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | बिलिंग (वैकल्पिक) |

पूरी सूची: [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. फ्रंटएंड

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

`http://localhost:4173/index.html` खोलें।  
पेज `config.js` से `window.PROMPTLY_API_BASE` पढ़ते हैं (`npm run build` से जनरेट)।

### 3. स्मोक चेक्स

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## आप क्या कर सकते हैं

| सुविधा | क्या करती है |
|--------|--------------|
| होम / ऑप्टिमाइज़ | मल्टी-स्टेज प्रॉम्प्ट पाइपलाइन + लाइव प्रोग्रेस |
| Brainstormer (विज़र्ड) | जनरेशन से पहले इरादा साफ़ करने वाला Q&A |
| Specs | लक्ष्यों और जवाबों से Spec निकालना / समीक्षा |
| Enhancer | मौजूदा प्रॉम्प्ट को दोहरा-सुधार |
| Outcome | कैंडिडेट तुलना मीट्रिक / Outcome रन के साथ |
| Result | साझा करने योग्य रिजल्ट व्यू |
| Auth | ईमेल/पासवर्ड + Google / GitHub OAuth |
| उपयोग सीमा | दैनिक बैनर / प्लान लिमिट |
| सब्सक्रिप्शन | Stripe चेकआउट (env से चालू) |
| Analytics | एडमिन एनालिटिक्स सतहें |
| i18n | नौ लोकेल्स + भाषा सिलेक्टर |

---

## टेक स्टैक

| परत | विकल्प |
|-----|--------|
| Frontend | स्टैटिक HTML / CSS / JS (`config.js` API बेस इंजेक्ट करता है) |
| Backend | Node.js ESM + Express |
| Database | लोकल SQLite; `DATABASE_URL` पर PostgreSQL |
| Auth | JWT + bcrypt; Google / GitHub OAuth |
| AI | OpenAI (मुख्य); `GROQ_API_KEY` से वैकल्पिक Groq |
| Billing | Stripe (वैकल्पिक) |
| Deploy | Render (API) + Vercel या स्टैटिक होस्ट (frontend) |

---

## आर्किटेक्चर (संक्षेप)

```
ब्राउज़र (स्टैटिक फ्रंटएंड)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite या PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (वैकल्पिक)
```

मुख्य ऑप्टिमाइज़ेशन फ़्लो: `/api/pipeline/*` (`run`, `health`, `stream/:runId`).

---

## मुख्य पेज

| पथ | उद्देश्य |
|----|----------|
| `frontend/index.html` | लैंडिंग / ऑप्टिमाइज़ |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / मीट्रिक्स |
| `frontend/result.html` | रिजल्ट व्यू |
| `frontend/settings.html` | अकाउंट / सेटिंग्स |
| `frontend/subscription.html` | प्लान और बिलिंग |
| `frontend/account.html` | अकाउंट पैनल |

नेस्टेड प्रोडक्ट README (ज़्यादा डिप्लॉय डिटेल):  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## स्क्रिप्ट्स

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

## ब्रांच और लेआउट

| आइटम | भूमिका |
|------|--------|
| `cursor-dev` | **सक्रिय डेवलपमेंट** — प्रोडक्ट सोर्स ऑफ़ ट्रुथ |
| `main` | सार्वजनिक README / एंट्री docs |
| `Promptly-cloud-v0.6.8.3-fullstack/` | `main` पर वर्तमान fullstack |
| पुराने `Promptly-cloud-v0.6.*` | ऐतिहासिक स्नैपशॉट |
| `milestones/` | माइलस्टोन आर्टिफैक्ट |
| `Promptly 0.6.8 Fix Bundles/` | फ़िक्स बंडल आर्काइव |

---

## लाइसेंस

नेस्टेड पैकेज docs में MIT लिखा है। `.env` और API keys को सीक्रेट मानें — कभी commit न करें।
