# 🧭 رفيق — Behavioral Companion OS

> آخر تحديث: 2026-05-27
> **التحوّل الأساسي:** من "AI chatbot بفلتر مصري" → إلى **Behavioral Companion OS** حقيقي.
> **الشعار الهندسي:** *Minimum Words. Maximum Motion.*

---

## 0. الفلسفة الثابتة (لا تتغير)

رفيق **ليس**:
- مصدر dopamine
- therapist مزيف
- تطبيق إنتاجية
- chatbot motivational

رفيق **هو**:
- صاحب فاهم cycle الإنسان
- يقلّل الـ shame
- يحوّل الشلل لحركة
- يقفل المحادثة لما لازم تتقفل
- يدفع للفعل، مش للكلام

> **النقطة المحورية اللي اكتشفناها:** الـ features مش المشكلة. المشكلة إن كل feature شغّال لوحده زي widget، مش بيغذّي "سلوك رفيق". لما habits + focus + sleep + rewards + calendar يبقوا كلهم input لـ **Behavioral Engine واحد** — رفيق يبدأ يبقى كائن حي سلوكي.

---

## 1. تشخيص النسخة الحالية

### 1.1 مشكلة الشخصية (Persona Smell)
- الردود لسة `validate → reframe → action` بنفس الـ rhythm.
- المصرية flavor مش روح.
- بيحس كأنه AI بيقرا prompt.

### 1.2 الذكاء السلوكي ضحل (Shallow State Machine)
الموجود: keywords + وقت + شوية patterns.
الناقص:
- `relapseProbability`
- `momentumScore`
- `recoveryVelocity`
- `sleepDebtScore`
- `emotionalVolatility`
- `behavioralConsistency`
- `trustScore`

### 1.3 الذاكرة سطحية
- Summaries أكتر من moments.
- مفيش **open loops** (وعود/تأجيلات/أعذار متكررة).
- مفيش **contradiction engine**.
- مفيش **exact emotional callbacks**.
- مفيش **semantic recall** حقيقي.

### 1.4 الـ Features Disconnected
habits, pomodoro, streaks, calendar, rewards — كلهم شغالين، لكن مفيش واحد منهم بيغيّر سلوك رفيق فعلياً.

---

## 2. الـ 9 Pillars للنسخة الجاية

### A) Conversation Director System
بدل `validate/reframe/act` → **Dialogue Acts**:
- `interrupt` — "طب استنى."
- `silence` — يسكت
- `callback` — "دي تالت مرة."
- `tease` — مزحة خفيفة
- `mirror` — يرجّع الجملة
- `challenge` — "لا دي مش المشكلة."
- `refuse` — "مش هديك نصيحة دلوقتي."
- `close_loop` — يقفل
- `soft_presence` — حضور بدون كلام

### B) Behavioral OS (Deterministic Scores)
كل score بـ pure function (مش prompt):
```
momentumScore        ← habit completion velocity × recency
relapseProbability   ← gap patterns + late-night signals + avoidance
sleepDebtScore       ← sleep target misses × cumulative
emotionalVolatility  ← stddev(emotional_timeline last 7d)
recoveryVelocity     ← time between collapse → first action
behavioralConsistency← habit stddev across week
trustScore           ← actions accepted ÷ actions suggested
```

### C) Unified Event Engine
جدول `events` واحد. كل feature يكتب فيه:
`message_sent`, `habit_complete`, `pomodoro_done`, `sleep_miss`, `disappearance_24h`, `calendar_add`, `action_ignored`, `action_done`, `reward_claimed`.
**Behavior Engine** يستهلك الـ stream → يحدّث الـ scores.

### D) Open Loop Memory
جدول `open_loops`:
```
type:        promise | postponement | excuse | avoidance | win | collapse
content:     "هذاكر بعد المغرب"
opened_at:   ts
expected_by: ts
status:      open | kept | broken | forgotten
recurrence_count: int
```
يخلي رفيق يقدر يقول: *"إنت وعدت نفسك بكده الخميس اللي فات."*

### E) Anti-AI Smell System
- `phrase_fatigue` — track آخر 50 جملة فتح، لو تكررت → block.
- `structure_fatigue` — لو آخر 3 ردود نفس الـ shape → اقلب.
- `humor_throttle` — مزحة كل N ردود max.
- `silence_permission` — أحياناً empty response = صح.
- `imperfect_speech` — جمل ناقصة، dots، "..."، تردد طبيعي.

### F) Conversational Realism
- يغيّر طول الرد حسب الحالة (من كلمة لـ paragraph).
- يقاطع.
- مايبقاش helpful 24/7.
- يبقى blunt أحياناً.

### G) Real Behavioral Integration
- **Habits → confidence / action sizing** — لو consistency واطية، الـ actions تبقى أصغر.
- **Pomodoro → focus windows detection** — يقترح المذاكرة في الـ window الفعلي بتاعك.
- **Sleep → collapse prediction + nudge timing**.
- **Calendar → intelligent scheduling** (مش 1-hour generic).

### H) Proactive Intelligence
- `quiet_hours` (احترام النوم)
- `cooldown` بعد كل nudge
- `permission_system` — يسأل قبل ما يقاطع
- `emotional_timing` — مايقاطعش في collapse
- `interruption_confidence` — score يقرر يكلم ولا لأ

### I) Evaluation Harness
`pnpm eval` — conversation QA يقيس:
- AI smell
- repetition
- warmth
- continuity
- realism
- movement quality
- Egyptian naturalness

علشان الجودة ماتبوظش مع كل تعديل.

---

## 3. الـ Phases التنفيذية

### ✅ Phase 0 — Foundation (DONE)
TanStack Start, Supabase, Gemini, 5-layer memory tables, habits, pomodoro, dashboard.

### 🟢 Phase 1 — Chat Quality Fixes (NOW)
**الهدف:** يخلص الـ symptoms اللي بتقتل التجربة دلوقتي.
- [ ] JSON يطلع في وسط الرسالة → strict schema + better parser fallback.
- [ ] الرسائل ناقصة → زود `maxOutputTokens` لكل mode + streaming.
- [ ] Generic "يا صاحبي" → phrase blocklist + opening rotation.
- [ ] Upgrade model (`gemini-2.5-pro` للـ companion، `flash-lite` للـ summarizer).
- [ ] Persona voice consistency pass.

### 🟡 Phase 2 — Unified Event Engine + Behavioral Scores
**الهدف:** يبني الـ backbone اللي كل حاجة تانية هتركب عليه.
- [ ] جدول `events` (append-only).
- [ ] Migration: كل feature يكتب event.
- [ ] `src/engine/behavior/scores.ts` — pure functions للـ 7 scores.
- [ ] `behavioral_scores` table (cached, recomputed on event).
- [ ] الـ context-assembler يحقن الـ scores في الـ prompt.

### 🟠 Phase 3 — Conversation Director
**الهدف:** يكسر شكل الردود التقليدي.
- [ ] `dialogue-acts.ts` — 9 acts بدل 3 modes.
- [ ] Director يختار act حسب: scores + history + recent acts.
- [ ] Schema per-act (silence = empty, interrupt = ≤4 words…).
- [ ] Anti-smell layer (phrase fatigue, structure fatigue).

### 🔵 Phase 4 — Open Loop Memory
- [ ] جدول `open_loops`.
- [ ] Extractor: بعد كل رد، LLM يستخرج promises/excuses/wins.
- [ ] Retrieval: الـ context-assembler يجيب open loops relevant.
- [ ] Callback generator: لما loop يتكسر → رفيق يفكّر.

### 🟣 Phase 5 — Proactive Intelligence v2
- [ ] Quiet hours + cooldown logic.
- [ ] Interruption confidence score.
- [ ] Permission-based check-ins.

### ⚫ Phase 6 — Evaluation Harness
- [ ] Eval dataset (50 محادثة مرجعية).
- [ ] LLM-as-judge على 7 metrics.
- [ ] CI: regression لو AI smell زاد.

### 🔴 Phase 7 — Auth Migration
نقل من anonymous UUID → Supabase Auth + RLS سليمة (مؤجل لحد ما الـ behavioral core يستقر).

---

## 4. مبادئ القرار

عند أي feature جديد، اسأل:
1. هل ده **بيغيّر سلوك رفيق** أم مجرد widget؟
2. هل بيكتب event للـ Behavioral Engine؟
3. هل ممكن يبقى deterministic بدل prompt؟
4. هل بيقلل الـ AI smell ولا بيزوّده؟

لو الإجابة "لأ" على ٢ منهم → ماتعملوش.
