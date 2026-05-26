# 🧭 رفيق — خريطة التطوير الشاملة (Roadmap & Vision)

> آخر تحديث: 2026-05-26
> الحالة الحالية: Phase 4 مكتمل (habits, pomodoro, sleep target, rewards, google calendar link)
> الإحساس الحالي: رفيق بيتكلم زي chatbot عادي — مش رفيق حقيقي بيدفع قدام

---

## 1. التشخيص — ليه رفيق لسة مش "حي"؟

### 🔴 مشاكل الـ Chat (الأولوية القصوى — P0)

| # | المشكلة | السبب التقني | الأثر على المستخدم |
|---|---------|--------------|--------------------|
| 1 | الردود كلها "يا صاحبي" / generative / متشابهة | الـ system prompt مش متنوع كفاية + temperature ثابت | إحساس robotic، مفيش شخصية حقيقية |
| 2 | الرسائل بتوصل ناقصة / مقطوعة | `maxOutputTokens` قليل أو الـ streaming مش مفعّل | كسر الثقة، الرسالة تبان مش مكتملة |
| 3 | الـ JSON بيظهر جوة الرسالة | `responseSchema` مش متطبق دايماً + الـ parser fallback ضعيف | كارثة UX — رفيق يبان كأنه bug |
| 4 | الموديل `gemini-2.5-flash` مش الأحدث | لسة على نسخة قديمة | جودة الردود أقل من المتاح |
| 5 | الردود مش "طبيعية" | مفيش conversation rhythm حقيقي + الـ persona مش varying | كل رد بنفس النغمة |

### 🟡 الفلسفة (P1) — رفيق chatbot مش companion

- مفيش **أذرع تنفيذية** — رفيق بيتكلم بس، مش بيعمل
- مفيش **ذاكرة طويلة المدى مرئية** للمستخدم — مش حاسس إن رفيق فاكره
- مفيش **خطط منظمة** — كل محادثة منفصلة، مفيش mapping للـ "دماغ"
- مفيش **proactive scheduling حقيقي** — مش بيذكّر في الوقت الصح

---

## 2. الـ Vision الجديد — رفيق كـ "عقل خارجي"

> رفيق مش chatbot. رفيق هو **العقل التاني** اللي بيرتب دوشة دماغك ويحوّلها لخطوات قابلة للتنفيذ، ويفضل جنبك لحد ما تتحرك فعلاً.

### الأذرع الـ 5 لرفيق (The 5 Arms)

```
              ┌─────────────────────────┐
              │     🧠 رفيق (Core)      │
              │  AI Orchestrator + LLM  │
              └────────────┬────────────┘
                           │
        ┌──────────┬───────┼───────┬──────────┐
        │          │       │       │          │
       🗓️         ✅      🧩      🌱         🔔
   Calendar    Tasks   Brain-   Habits   Reminders
   (Google)   Tracker   Map    Tracker   Engine
```

| الذراع | الوظيفة | الحالة |
|--------|---------|--------|
| 🗓️ **Calendar Arm** | يحجز slots في Google Calendar لما المستخدم يلتزم بـ action | 🟡 link فقط (لازم OAuth حقيقي) |
| ✅ **Task Arm** | to-do lists + checkpoints لكل خطة كبيرة | 🔴 مش موجود |
| 🧩 **Brain-Map Arm** | يقسّم "الدوشة" لـ nodes (مشاكل / أهداف / مخاوف) ويربطها | 🔴 مش موجود |
| 🌱 **Habits Arm** | عادات تتبني + عادات تتبطل (مع streak) | 🟢 موجود (Phase 4) |
| 🔔 **Reminders Engine** | تذكيرات ذكية في الأوقات الصح (مش spam) | 🟡 proactive nudges فقط |

---

## 3. خطة التنفيذ — 6 مراحل

### 🚑 المرحلة 0 — إصلاح الـ Chat (أسبوع 1)

**هدف:** رفيق يرد بشكل طبيعي، كامل، بدون JSON ظاهر.

- [ ] **ترقية الموديل**: نقل من `gemini-2.5-flash` → `gemini-3-flash-preview` (الأحدث المجاني)
- [ ] **إصلاح JSON leak**: إعادة كتابة `ai-client.ts` بحيث:
  - `responseSchema` يكون mandatory لكل الـ chat calls
  - parser يرفض أي رد فيه JSON ويعيد المحاولة مرة واحدة
  - أي fallback يرجع نص نظيف، مش raw
- [ ] **streaming**: تفعيل `generateContentStream` بدل `generateContent` للـ chat
- [ ] **زيادة `maxOutputTokens`**: من 300 → 800 للـ companion calls
- [ ] **تنويع النغمة**: 5 persona variants (صديق / مدرب / فيلسوف هادي / أخ أكبر / مرشد روحي) — اختيار dynamic حسب emotional_tag
- [ ] **حذف الـ "يا صاحبي" التلقائي**: إزالة كل openers الجاهزة من الـ prompt
- [ ] **conversation rhythm**: لو آخر 3 ردود من نفس النوع → غيّر النغمة قسراً

### 🧩 المرحلة 1 — Brain-Map (أسبوع 2-3)

**هدف:** رفيق يحوّل دوشة الدماغ لـ visual map قابل للتنفيذ.

- [ ] **DB schema جديد**:
  - `brain_nodes` (id, user_id, type [problem|goal|fear|task], title, status, parent_id)
  - `node_links` (from_node, to_node, relation_type)
- [ ] **Server fn**: `extractBrainNodes(userText)` → يستخدم Gemini لاستخراج nodes من رسالة المستخدم
- [ ] **UI Component**: `BrainMap.tsx` — react-flow أو d3 لعرض الـ map التفاعلي
- [ ] **Auto-suggest**: رفيق يقترح ربط nodes جديدة بـ nodes قديمة

### ✅ المرحلة 2 — Task Arm + Plans (أسبوع 4)

**هدف:** كل خطة كبيرة تتقسم لـ micro-tasks مع checkpoints.

- [ ] **DB schema**:
  - `plans` (id, user_id, title, brain_node_id, target_date, status)
  - `plan_steps` (id, plan_id, order, title, status, due_at)
- [ ] **Server fn**: `generatePlanFromGoal(goal)` → يرجع 5-10 micro-steps
- [ ] **UI**: `PlansList.tsx` + `PlanDetailDrawer.tsx` مع checkboxes
- [ ] **ربط بالـ chat**: لما رفيق يقترح action، زرار "اعمل خطة كاملة"

### 🗓️ المرحلة 3 — Google Calendar Real Integration (أسبوع 5)

**هدف:** رفيق يحجز slots حقيقية في كاليندر المستخدم.

- [ ] **OAuth per-user** (مش connector — كل user بكاليندره):
  - Google Cloud project + OAuth credentials
  - scope: `calendar.events`
  - flow في `/auth/google-calendar`
- [ ] **DB**: `user_calendar_tokens` (user_id, access_token, refresh_token, expires_at)
- [ ] **Server fn**: `scheduleAction(action, dateTime, duration)` → ينشئ event
- [ ] **UI**: زرار "احجزها في كاليندري" في الـ MessageBubble

### 🔔 المرحلة 4 — Reminders Engine (أسبوع 6)

**هدف:** رفيق يبادر في الوقت الصح، مش random.

- [ ] **pg_cron job**: يشتغل كل 15 دقيقة، يفحص:
  - users بطلوا يدخلوا من >24 ساعة
  - actions لسة مش `done` ومرّ عليها time
  - habits النهارده مش متعملة وفي وقت المساء
- [ ] **Push notifications** (Web Push API + service worker)
- [ ] **Quiet hours**: من الـ user settings (مش يبعت بليل)
- [ ] **Smart timing**: استخدام Gemini لاختيار أحسن وقت بناءً على tracking pattern

### 🌟 المرحلة 5 — Polish & Soul (أسبوع 7-8)

**هدف:** رفيق يكون له "روح".

- [ ] **Voice (Web Speech API)**: رفيق يتكلم صوت لما المستخدم في mode "دماغي زحمة"
- [ ] **Haptics**: لما action تتعمل ✓ — vibration pattern
- [ ] **Daily Ritual**: 7 صباحاً + 9 مساءً — checkpoint قصير
- [ ] **رحلتي page**: timeline بصري لكل الـ wins
- [ ] **Export memory**: المستخدم يقدر يحمّل كل رحلته PDF

---

## 4. التحديثات التقنية الفورية (Quick Wins)

نفّذ الأسبوع الأول قبل أي feature جديدة:

1. ✅ **رفع `gemini-3-flash-preview`** في `src/config/ai.ts`
2. ✅ **Schema-enforced JSON** في كل calls الـ chat
3. ✅ **Streaming responses** في الـ UI (typewriter effect حقيقي مش fake)
4. ✅ **Persona rotation** (5 modes بدل واحد)
5. ✅ **Token limits**: 800 للـ chat، 1500 للـ narrative
6. ✅ **Error UX**: لو الـ JSON parse فشل → "خد لحظة، أنا بفكر تاني..." بدل ما الـ raw يظهر

---

## 5. مبادئ تصميمية لازم تفضل قائمة

- **Minimum Words, Maximum Motion** — رفيق ما يكتبش paragraphs، يكتب جمل قصيرة بتحرّك
- **No shame, no gamification of anxiety** — مفيش "فشلت اليوم"، فيه "بكرا فرصة جديدة"
- **Action over conversation** — كل رد لازم يفتح باب لحركة (أو يقول صراحة "النهارده بس نسمع")
- **Memory is sacred** — رفيق ما ينساش، وما يكررش نفس السؤال
- **Arabic-native, globally adaptable** — اللغة هي الـ home base

---

## 6. ما اللي مش هنعمله

عشان نفضل focused:

- ❌ مش هنعمل social features (مفيش feed، مفيش friends)
- ❌ مش هنعمل gamification (مفيش points، مفيش leaderboards)
- ❌ مش هنعمل subscriptions دلوقتي
- ❌ مش هنعمل mobile app native (PWA كفاية)
- ❌ مش هنخلي رفيق "يعرف كل حاجة" — هو رفيق مش جوجل

---

## 7. خطوات البداية الفورية

لما تقول "ابدأ"، هنبدأ بـ **المرحلة 0 كاملة** في turn واحد:

1. ترقية الموديل
2. إصلاح JSON parser
3. تفعيل streaming
4. persona rotation
5. اختبار end-to-end

بعدها نقرر سوا: brain-map الأول ولا tasks الأول؟

---

*"الهدف مش الكمال، الهدف الـ momentum."*
