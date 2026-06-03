# 🧭 رفيق — Behavioral Companion OS
# Architectural Roadmap v2.0

> آخر تحديث: 2026-06-03
> **التحوّل الجوهري:** من "AI Chat + Productivity Tools" → إلى **Behavioral Companion Operating System** حقيقي يشعر بالحياة.
> **الشعار الهندسي:** *Minimum Words. Maximum Motion.*

---

## 0. الفلسفة الثابتة (لا تتغير)

رفيق **ليس**:
- مصدر dopamine
- therapist مزيف
- تطبيق إنتاجية بـ widgets
- chatbot motivational بـ validate/reframe/act ثابت

رفيق **هو**:
- كائن سلوكي حي يفهم دورة الإنسان
- يقلّل الـ shame ويحوّل الشلل لحركة
- يعرف متى يسكت ومتى يقاطع
- يتذكر اللحظات مش بس الملخصات
- يتغير مع اللحظة مش مع التاب اللي اختاره المستخدم

> **التشخيص الجذري:** الـ features موجودة، الذكاء موجود، لكن كل حاجة شغّالة لوحدها. Habits ≠ Behavior. Focus ≠ Intelligence. Memory ≠ Continuity. المشكلة مش نقص features — المشكلة إن مفيش **قلب واحد** ينبض وراء كل الـ features دي.

---

## 1. Audit النسخة الحالية — ما يوجد وما ينقص

### ✅ ما تم بناؤه بالفعل (لا تلمس)

#### البنية التحتية
- **Event System**: `event-types.ts` + `event-logger.ts` — جاهز تماماً لـ 12 event type
- **Score Functions**: `event-scores.ts` — 7 pure functions محسوبة (momentum، relapse، sleep، volatility، recovery، consistency، trust)
- **State Machine**: `analyzer/state-machine.ts` — V2 بـ weighted scoring + emotional inertia
- **Memory Layer**: 5 جداول DB (identity، snapshots، patterns، emotional_timeline، interactions)
- **Prompt Builder**: `prompt-builder.ts` — 18 mode instructions + humanization rules + scores section
- **Context Assembler**: `context-assembler.ts` — يجمع 6 مصادر memory بـ parallel queries
- **Response Strategy**: `response-strategy.ts` — Priority routing + persona preferences
- **Conversation Rhythm**: `conversation-rhythm.ts` — Anti-repetition + pacing rules
- **Proactive Engine**: `initiative-engine.ts` — 6 trigger types بـ priority queue
- **Core Beliefs**: `core-beliefs.ts` — الفلسفة كـ engineering constants
- **DB Schema**: interactions، habits، habit_logs، focus_sessions، plans، brain_nodes، emotional_timeline

#### ما يعمل من الـ Features
- Chat + Message history
- Habit tracking + streaks
- Focus sessions (Pomodoro)
- Brain nodes + Plans
- Proactive nudges (static templates)
- Dashboard drawer
- Persona selector (sage/coach/friend)
- Onboarding flow
- Google Calendar integration

---

### 🔴 الثغرات الحقيقية (ترتيب ROI)

#### ثغرة A — جدول `events` غير مربوط بـ features
**الكود موجود، الـ wiring مكسور.**
- `habit_logs` لا تكتب في `events`
- `focus_sessions` لا تكتب في `events`
- `action_done` على الـ interaction لا تكتب `action_done` event
- نتيجة: الـ `computeBehavioralScores` تشتغل على events فاضية → scores كلها صفر → سياق فاضي للـ AI
- **هذه أكبر ثغرة وأسهلها في الإصلاح — ROI = 10/10**

#### ثغرة B — Persona System مكشوفة للمستخدم
**الـ tabs موجودة في الـ UI، والمستخدم "يختار" رفيق.**
- `response-strategy.ts` تأخذ `persona` كـ input وتضيف candidates حسبه
- هذا يكسر الوهم: المستخدم يشعر إنه "ضبط إعدادات" مش إن رفيق "فاهمه"
- يجب حذف الـ tabs ونقل الـ persona logic داخل الـ engine كـ dynamic output

#### ثغرة C — Memory تعتمد على Summaries فقط
- `memory-summarizer.ts` يكتب summaries سردية جيدة لكن:
  - لا يوجد جدول `open_loops` (وعود + تأجيلات + أعذار متكررة)
  - الذاكرة لا تتذكر **اللحظات الدقيقة** — فقط ملخصات
  - لا يوجد contradiction detection ("قلت هتنام بدري، وبعدين سهرت تلات أيام")
  - العودة لـ loop: "دي تالت مرة بنقول نفس الكلام"

#### ثغرة D — Validate/Reframe/Act هيكل مرئي
- 7 modes من أصل 18 تعتمد على نفس schema `{validate, reframe, action}`
- المستخدمون يبدأون يحسوا بالـ template
- المحتاج: `Conversation Director` حقيقي يختار الـ conversational move الصح

#### ثغرة E — Anti-AI Smell غير كافي
- `conversation-rhythm.ts` يمنع تكرار الـ opening phrases بس
- لا يوجد phrase fatigue tracking حقيقي عبر الـ sessions
- لا يوجد structure fatigue detection (اكتشاف تكرار الـ shape مش الكلمات)
- لا يوجد response variety scoring

#### ثغرة F — Proactive Engine غير ذكي
- النصوص static templates (`NUDGE_TEMPLATES`) → كل مستخدم يستقبل نفس الكلام
- لا يستخدم الـ behavioral scores في قرار الـ nudge
- `interruption_confidence` score غير موجود

#### ثغرة G — Evaluation غير موجود
- لا يوجد أي طريقة لقياس جودة المحادثة
- لا يوجد regression testing
- بمجرد تغيير prompt → لا تعرف إذا التحسين فعلاً حصل

---

## 2. الـ Architecture الجديدة — القرارات الهندسية

### القرار 1: احذف Persona Tabs
**المبرر:** الـ persona selector يكسر immersion ويحول رفيق من "صاحب" لـ "إعداد".

**البديل:** `DynamicStance` — رفيق يحسب موقفه الداخلي autonomously:

```typescript
interface DynamicStance {
  warmth: number;        // 0-1: دفء الاستجابة
  pressure: number;      // 0-1: ضغط الدفع للحركة
  playfulness: number;   // 0-1: نسبة الخفة والفكاهة
  directness: number;    // 0-1: مباشرة الكلام
  depth: number;         // 0-1: عمق التحليل
}
```

يُحسب من: `behavioralState + scores + timeOfDay + trustScore + recoveryState + recentEmotionalHistory`

---

### القرار 2: Event Engine كـ Backbone حقيقي
كل feature **يجب أن تكتب event**. بدون event = مش موجود للـ brain.

**Events المطلوب إضافتها:**

| Event | Source | مين يكتبه |
|---|---|---|
| `habit_complete` | habit_logs | habit completion hook |
| `habit_missed` | scheduled check | cron/session start |
| `focus_started` | focus_sessions | timer start |
| `focus_completed` | focus_sessions | timer complete |
| `focus_aborted` | focus_sessions | timer abort |
| `action_accepted` | interactions | action confirm button |
| `action_skipped` | interactions | timeout/ignore |
| `sleep_target_met` | sleep check | session start check |
| `sleep_target_missed` | sleep check | session start check |
| `nudge_accepted` | proactive | nudge reply |
| `nudge_ignored` | proactive | nudge dismiss |
| `long_absence` | session start | computed from gap |
| `return_after_absence` | session start | computed from gap |
| `open_loop_broken` | open_loops | loop tracker |

---

### القرار 3: Open Loop Memory كـ جدول منفصل

```sql
CREATE TABLE open_loops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loop_type        TEXT NOT NULL CHECK (loop_type IN ('promise', 'postponement', 'excuse', 'avoidance', 'win', 'collapse')),
  content          TEXT NOT NULL,          -- "هذاكر بعد المغرب"
  extracted_from   UUID REFERENCES interactions(id),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_by      TIMESTAMPTZ,            -- متى يُتوقع إنه يتم
  closed_at        TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'kept', 'broken', 'forgotten')),
  recurrence_count INT NOT NULL DEFAULT 1, -- اتكرر كام مرة
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Extractor**: بعد كل رد من رفيق، LLM خفيف (Flash-lite) يستخرج الـ loops.
**Retrieval**: الـ context-assembler يجيب آخر 3 loops مفتوحة.
**Callback**: لما رفيق يكتشف recurrence_count > 2 → dialogue act = `recall`.

---

### القرار 4: Conversation Director بدل Fixed Schema

**اللي عنده دلوقتي:** response strategy → mode → fixed JSON schema.
**اللي المطلوب:** Conversation Director → dialogue act → dynamic output shape.

```typescript
type DialogueAct =
  | "interrupt"      // "طب استنى." ≤ 3 كلمات
  | "silence"        // فراغ مقصود — رد فاضي أو نقطة واحدة
  | "callback"       // "دي تالت مرة..." — يرجّع loop قديم
  | "tease"          // مزحة خفيفة تنكش العادة
  | "mirror"         // يعيد الجملة اللي قالها المستخدم
  | "challenge"      // "لا دي مش المشكلة الحقيقية"
  | "refuse"         // "مش هديك نصيحة دلوقتي"
  | "close_loop"     // يقفل المحادثة
  | "soft_presence"  // حضور بدون كلام كتير
  | "move"           // micro-action واحدة محددة
  | "question"       // سؤال واحد فقط
  | "celebrate"      // احتفال حقيقي
  | "recall"         // "وعدت نفسك بنفس الكلام الخميس"
  | "observe";       // ملاحظة نمط مش نصيحة

interface ConversationDirectorOutput {
  dialogueAct: DialogueAct;
  warmth: number;          // 0-1
  pressure: number;        // 0-1
  maxWords: number;        // حد أقصى للكلمات
  allowAction: boolean;    // هيقترح action زرار؟
  imperfectionLevel: number; // 0-1: نسبة التردد البشري الطبيعي
  endingType: "open" | "closed" | "question" | "silence";
}
```

**Director يحسب output بناءً على:**
- `behavioralState` + `scores`
- `recentDialogueActs` (آخر 5 acts — ممنوع تكرار)
- `trustScore` (لو منخفض → pressure أقل، warmth أعلى)
- `timeOfDay` (ليل → warmth أعلى، pressure أقل)
- `openLoops` (لو في loop متكررة → callback أو recall)
- `emotionalVolatility` (لو عالية → softness أعلى)

---

### القرار 5: Anti-AI Smell كـ Architecture

**مش prompt instructions — كود قابل للقياس:**

```typescript
interface SmellMetrics {
  phraseRepetition: Map<string, number>;  // عدد مرات كل جملة افتتاحية
  structureFatigue: number;               // كم مرة نفس الـ shape
  humorCount: number;                     // عدد المزح في آخر N ردود
  actionTypeHistory: string[];            // أنواع الأكشن المقترحة
  openingVariety: number;                 // 0-1: تنوع الفتح
}
```

**Rules محسوبة قبل prompt:**
1. لو `phraseRepetition[phrase] >= 2` في آخر 20 رد → حطه في blocklist للـ prompt
2. لو آخر 3 ردود نفس الـ structure shape → اختر dialogue act مختلف قسراً
3. لو `humorCount >= 3` في آخر 10 ردود → `humor_throttle = true`
4. `imperfectionLevel` يرتفع مع `emotionalVolatility` (تردد بشري أكثر)

---

### القرار 6: Habits/Focus/Calendar → Behavioral Inputs

| Feature | الـ Impact على الـ Brain |
|---|---|
| **Habit completion** | `momentumScore` ↑, `trustScore` ↑ (لو الـ action كان habit) |
| **Habit missed** | `relapseProbability` ↑, `behavioralConsistency` ↓ |
| **Focus completed** | `momentumScore` ↑↑, تحديد `focus_window` للمستخدم |
| **Focus aborted** | `emotionalVolatility` ↑, إشارة إنه مش قادر يكمل |
| **Sleep met** | `sleepDebtScore` ↓, `recoveryVelocity` يُحسَّن |
| **Sleep missed** | `sleepDebtScore` ↑, `relapseProbability` ↑ |
| **Calendar add** | يُسجَّل كـ commitment → open loop مفتوح |
| **Calendar skip** | loop يتحول لـ `broken` → callback في المحادثة |

**action difficulty scaling:**
- لو `momentumScore < 0.3` → الأكشن المقترح يكون **أصغر** (5 دقايق مش 30)
- لو `trustScore < 0.3` → قلّل عدد الـ actions المقترحة (مش أكتر من 1)
- لو `behavioralConsistency > 0.7` → ممكن تقترح حاجة أكبر شوية

---

### القرار 7: Evaluation Harness

```typescript
interface TranscriptScore {
  aiSmell: number;           // 0-10: 10 = بشري جداً
  warmth: number;            // 0-10
  continuity: number;        // 0-10: هل ذكر ماضي؟
  realism: number;           // 0-10: هل كلامه طبيعي؟
  movementQuality: number;   // 0-10: هل الأكشن محدد وقابل للتنفيذ؟
  actionLikelihood: number;  // 0-10: احتمال تنفيذ المستخدم للأكشن
  egyptianNaturalness: number; // 0-10: مصرية حقيقية؟
  repetition: number;        // 0-10: 10 = لا تكرار
}
```

**التنفيذ:**
- dataset من 50 محادثة مرجعية (good/bad examples)
- LLM-as-judge (Gemini Pro) يقيّم كل transcript
- `pnpm eval` command يشغل التقييم
- CI: لو `aiSmell < 6` في أي محادثة → fail

---

## 3. الـ Phases التنفيذية (مرتبة بـ ROI)

### ✅ Phase 0 — Foundation (DONE)
TanStack Start، Supabase، Gemini، 5-layer memory، habits، focus، dashboard، proactive، 18-mode prompt system.

---

### 🔴 Phase 1 — Event Wiring (الأعلى ROI، الأسهل تنفيذاً)
**الهدف:** وصل الـ features الموجودة بالـ behavioral brain.
**وقت التنفيذ المتوقع:** 2-3 أيام.

- [ ] `habit_logs` insert → يكتب `habit_complete` event تلقائياً (DB trigger أو hook في الكود)
- [ ] Session start → يحسب `sleep_target_met/missed` ويكتب event
- [ ] Focus session complete → يكتب `focus_completed` event
- [ ] Focus session abort → يكتب `focus_aborted` event
- [ ] `action_done = true` → يكتب `action_accepted` event
- [ ] Nudge dismiss → يكتب `nudge_ignored` event
- [ ] Nudge reply → يكتب `nudge_accepted` event
- [ ] Session start بعد غياب → يكتب `long_absence` / `return_after_absence`
- [ ] **تحقق:** الـ `computeBehavioralScores` يعمل على events حقيقية مش فاضية

**معيار النجاح:** الـ scores في الـ prompt مش صفرية. رفيق يشير لـ momentum/sleep/trust بشكل صحيح.

---

### 🟠 Phase 2 — Remove Persona Tabs + Dynamic Stance
**الهدف:** رفيق يتكيف تلقائياً — المستخدم ما يختارش مود.
**وقت التنفيذ المتوقع:** 2-3 أيام.

- [ ] **احذف** Persona tabs من الـ UI (`index.tsx` lines 27-32, 179-202)
- [ ] احذف `persona` parameter من `handleSend` و `handleConfirm`
- [ ] أنشئ `src/engine/orchestrator/dynamic-stance.ts`:
  - input: `behavioralScores + state + timeOfDay + recentDialogueActs`
  - output: `DynamicStance { warmth, pressure, playfulness, directness, depth }`
- [ ] عدّل `response-strategy.ts` يستخدم `DynamicStance` بدل `persona`
- [ ] عدّل `prompt-builder.ts` يعكس الـ stance في الـ system instruction بدل persona name
- [ ] احتفظ بـ `core-beliefs.ts` → `PERSONA_VOICES` مخفي داخلياً (لا يراه المستخدم)

**معيار النجاح:** مستخدم يفتح التطبيق → رفيق يرد بنبرة مختلفة حسب وقت الليل والسلوك الأخير بدون ما المستخدم يختار حاجة.

---

### 🟡 Phase 3 — Conversation Director
**الهدف:** كسر الـ validate/reframe/act template المرئي.
**وقت التنفيذ المتوقع:** 3-4 أيام.

- [ ] أنشئ `src/engine/orchestrator/conversation-director.ts`:
  - يحسب `DialogueAct` + `ConversationDirectorOutput`
  - يأخذ: scores، state، recentActs، openLoops، timeOfDay
- [ ] أنشئ `dialogue-act-schemas.ts`:
  - كل act بـ JSON schema مختلف
  - `interrupt` → `{ text: string }` ≤ 4 كلمات
  - `silence` → `{ text: "." }`
  - `move` → `{ text: string, action: string }`
  - `callback` → `{ text: string }` يذكر loop محدد
- [ ] عدّل `prompt-builder.ts` يستخدم `DialogueAct` بدل `ResponseMode`
- [ ] سجّل الـ `dialogue_act` في جدول `interactions` للتحليل لاحقاً

**معيار النجاح:** في 10 محادثات متتالية، لا يوجد رد بنفس الشكل مرتين متتاليتين.

---

### 🟢 Phase 4 — Open Loop Memory
**الهدف:** رفيق يتذكر اللحظات مش بس الملخصات.
**وقت التنفيذ المتوقع:** 3-4 أيام.

- [ ] Migration: إضافة جدول `open_loops` في Supabase
- [ ] أنشئ `src/engine/memory/open-loop-extractor.ts`:
  - بعد كل رد، Gemini Flash-lite يستخرج promises/excuses/wins
  - يكتب في جدول `open_loops`
- [ ] عدّل `context-assembler.ts` يجيب آخر 3-5 loops مفتوحة
- [ ] عدّل `prompt-builder.ts` يضم `[حلقات مفتوحة]` section
- [ ] لما `recurrence_count >= 2` → الـ Director يختار `callback` أو `recall` act

**معيار النجاح:** رفيق يقدر يقول "إنت قلت نفس الكلام الخميس اللي فات" بشكل صحيح وموثوق.

---

### 🔵 Phase 5 — Anti-AI Smell Architecture
**الهدف:** مقياس قابل للقياس للجودة البشرية للردود.
**وقت التنفيذ المتوقع:** 2-3 أيام.

- [ ] أنشئ `src/engine/quality/smell-detector.ts`:
  - `phraseRepetitionMap` من آخر 30 رد
  - `structureShapeHash` لكل رد
  - `humorThrottle` counter
  - `openingVarietyScore`
- [ ] عدّل `prompt-builder.ts` يضم نتيجة الـ smell detection كـ blocklist ديناميكية
- [ ] عدّل `conversation-rhythm.ts` يستخدم `structureShapeHash` في الـ fatigue detection

**معيار النجاح:** لا يوجد نفس الـ opening في آخر 5 ردود. لا يوجد نفس الـ structure في آخر 3 ردود.

---

### 🟣 Phase 6 — Intelligent Proactive Engine
**الهدف:** الـ nudges تبقى شخصية ومبنية على السلوك الحقيقي.
**وقت التنفيذ المتوقع:** 2-3 أيام.

- [ ] عدّل `initiative-engine.ts` يستخدم `behavioralScores` في قرار الـ nudge
- [ ] أضف `interruption_confidence` score مشتق من:
  - `emotionalVolatility` (لو عالية → متقاطعش)
  - `trustScore` (لو منخفض → خليك ناعم)
  - `hourOfDay` (ليل → لا pressure)
- [ ] الـ nudge text يتولّد من Gemini مش static templates (للمستخدمين بعد 7 أيام)
- [ ] أضف `quiet_hours` config لكل مستخدم

**معيار النجاح:** مستخدم بـ `relapseProbability > 0.7` يستقبل nudge مختلف تماماً عن مستخدم بـ `momentumScore > 0.8`.

---

### ⚫ Phase 7 — Evaluation Harness
**الهدف:** ما تعرفش إذا كانت تحسيناتك شغّالة → مبتحسنش.
**وقت التنفيذ المتوقع:** 3-4 أيام.

- [ ] أنشئ `src/eval/` directory
- [ ] اجمع 50 محادثة مرجعية (good/bad)
- [ ] أنشئ `src/eval/judge.ts` — Gemini Pro يقيّم الـ 8 metrics
- [ ] `pnpm eval` command يشغّل التقييم ويطبع الـ scores
- [ ] GitHub Action: eval يشتغل على كل PR

**معيار النجاح:** تقدر تقول بأرقام إذا كان تعديل الـ prompt حسّن الجودة أم لا.

---

### 🔴 Phase 8 — Auth Migration
مؤجل لحد ما الـ behavioral core يستقر.
- نقل من anonymous UUID → Supabase Auth + RLS حقيقية
- هذا مش ضروري للـ product quality دلوقتي

---

## 4. ما يجب حذفه (REMOVE)

| العنصر | السبب |
|---|---|
| **Persona Tabs UI** (sage/coach/friend) | يكسر الـ immersion — رفيق يتكيف تلقائياً |
| **Static nudge templates** (بعد Phase 6) | مش شخصية — كل المستخدمين بياخدوا نفس الكلام |
| **`validate_reframe_act` كـ default fallback دايماً** | هو سبب الـ template fatigue |
| **`consecutiveAdviceCount`** في response-strategy | يُعوَّض بـ `structureFatigue` في الـ director الجديد |

---

## 5. مبادئ القرار للمستقبل

عند أي feature جديد، اسأل:
1. هل ده بيغيّر سلوك رفيق أم مجرد widget؟
2. هل بيكتب event للـ Behavioral Engine؟ (لو لأ → مش موجود للـ brain)
3. هل ممكن يبقى deterministic بدل AI prompt؟ (لو ممكن → افعل)
4. هل بيقلل الـ AI smell ولا بيزوده؟
5. هل المستخدم هيحسه ولا هيشوفه؟ (الأحسن هيحسه بدون ما يشوفه)

لو الإجابة "لأ" على 2 منهم → ماتعملوش.

---

## 6. الخريطة البصرية للـ Architecture الجديدة

```
User Message
     │
     ▼
┌─────────────────────────────────────┐
│         Session Start               │
│  → Sleep check → Events             │
│  → Absence check → Events           │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Context Assembler               │
│  Memory (5 layers) + Open Loops     │
│  Events → BehavioralScores (7)      │
│  Emotional Timeline                 │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Behavioral Analyzer             │
│  State Machine V2                   │
│  → UserBehaviorState                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Dynamic Stance Calculator       │
│  scores + state + time → Stance     │
│  { warmth, pressure, playfulness }  │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Conversation Director           │
│  → DialogueAct                      │
│  → ConversationDirectorOutput       │
│  Anti-Smell checks                  │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Prompt Builder                  │
│  Philosophy + Stance + Memory       │
│  + Director Output + Act Schema     │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Gemini 2.5 Flash/Pro            │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│     Response + Event Logging        │
│  → interactions table               │
│  → events table                     │
│  → open_loops extractor (async)     │
│  → memory summarizer (async)        │
└─────────────────────────────────────┘
```
