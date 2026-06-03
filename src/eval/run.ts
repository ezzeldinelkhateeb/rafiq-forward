import { EVAL_SCENARIOS } from "./scenarios";
import { judgeResponse } from "./judge";
import { computeDynamicStance } from "../engine/orchestrator/dynamic-stance";
import { directConversation } from "../engine/orchestrator/conversation-director";
import { buildPrompt } from "../engine/orchestrator/prompt-builder";
import { callGemini } from "../lib/ai-client";
import { DIALOGUE_ACT_RESPONSE_SCHEMA } from "../engine/orchestrator/dialogue-act-schemas";
import * as fs from "fs";
import * as path from "path";

async function runEvaluation() {
  console.log("=== Rafiq Behavioral OS: Evaluation Harness ===");
  console.log(`Loaded ${EVAL_SCENARIOS.length} scenarios for evaluation...\n`);

  const results: any[] = [];
  let totalSlang = 0;
  let totalAntiAi = 0;
  let totalJson = 0;
  let totalStance = 0;

  for (const scenario of EVAL_SCENARIOS) {
    console.log(`Running scenario: [${scenario.id}] ${scenario.name}...`);

    // 1. Compute dynamic stance
    const stance = computeDynamicStance(
      scenario.memory.behavioralScores || {
        momentumScore: 0,
        relapseProbability: 0,
        sleepDebtScore: 0,
        emotionalVolatility: 0,
        recoveryVelocity: 0,
        behavioralConsistency: 0,
        trustScore: 0,
      },
      scenario.state,
      scenario.memory.recentEmotions
    );

    // 2. Direct conversation
    const isActionCompletion =
      scenario.userMessage.startsWith("تمام، عملت ده:") ||
      scenario.userMessage === "تمام، عملتها ✓";
    const direction = directConversation({
      behaviorState: scenario.state,
      stance,
      consecutiveAdviceCount: 0,
      userMessageLength: scenario.userMessage.length,
      hoursSinceLastSession: scenario.memory.hoursSinceLastSession,
      hasUnfinishedAction: !!(
        scenario.memory.lastAction && !scenario.memory.lastAction.done
      ),
      lastActionDone: scenario.memory.lastAction?.done ?? true,
      isActionCompletion,
    });

    // 3. Build prompt
    const { systemInstruction, userMessage } = buildPrompt({
      stance,
      dialogueAct: direction.dialogueAct,
      memory: scenario.memory,
      userMessage: scenario.userMessage,
      behavioralAnalysis: {
        state: scenario.state,
        confidence: 1.0,
        signals: [],
        hourOfDay: 12,
        isLateNight: false,
        isFirstMessageOfDay: false,
      },
      recentRafiqTexts: scenario.memory.recentRafiqTexts,
    });

    // 4. Generate companion reply
    let replyText = "";
    try {
      const aiResult = await callGemini({
        systemInstruction,
        userMessage,
        temperature: 0.85,
        expectJson: true,
        responseSchema: DIALOGUE_ACT_RESPONSE_SCHEMA,
      });
      replyText = aiResult.text;
    } catch (err: any) {
      console.error(`- Generation failed: ${err.message}`);
      replyText = JSON.stringify({
        validate: `حصل مشكلة: ${err.message}`,
        reframe: "",
        action: "",
      });
    }

    console.log(`- Generated Reply:\n${replyText}\n`);

    // 5. Evaluate using the judge
    console.log("- Running judge evaluation...");
    const evaluation = await judgeResponse({
      scenarioName: scenario.name,
      userMessage: scenario.userMessage,
      companionReply: replyText,
      expectedState: scenario.state,
      stance,
      dialogueAct: direction.dialogueAct,
    });

    console.log(
      `- Scores: Slang: ${evaluation.slangScore}/5, Anti-AI: ${evaluation.antiAiSmellScore}/5, JSON: ${evaluation.jsonScore}/5, Stance: ${evaluation.stanceScore}/5`
    );
    console.log(`- Reasoning: ${evaluation.reasoning}\n`);

    results.push({
      scenario,
      stance,
      dialogueAct: direction.dialogueAct,
      replyText,
      evaluation,
    });

    totalSlang += evaluation.slangScore;
    totalAntiAi += evaluation.antiAiSmellScore;
    totalJson += evaluation.jsonScore;
    totalStance += evaluation.stanceScore;
  }

  const numScenarios = EVAL_SCENARIOS.length;
  const avgSlang = totalSlang / numScenarios;
  const avgAntiAi = totalAntiAi / numScenarios;
  const avgJson = totalJson / numScenarios;
  const avgStance = totalStance / numScenarios;
  const overallAvg = (avgSlang + avgAntiAi + avgJson + avgStance) / 4;

  console.log("=== EVALUATION COMPLETE ===");
  console.log(`Average Slang Score: ${avgSlang.toFixed(2)} / 5.0`);
  console.log(`Average Anti-AI Score: ${avgAntiAi.toFixed(2)} / 5.0`);
  console.log(`Average JSON Score: ${avgJson.toFixed(2)} / 5.0`);
  console.log(`Average Stance Score: ${avgStance.toFixed(2)} / 5.0`);
  console.log(`Overall Average Score: ${overallAvg.toFixed(2)} / 5.0\n`);

  // Write evaluation report markdown file to artifacts
  const artifactDir = process.env.EVAL_ARTIFACT_DIR || "/mnt/documents";
  const reportPath = path.join(artifactDir, "eval_results.md");

  let markdown = `# Rafiq Behavioral OS — Evaluation Results\n\n`;
  markdown += `* **Generated At:** ${new Date().toISOString()}\n`;
  markdown += `* **Total Scenarios Evaluated:** ${numScenarios}\n\n`;

  markdown += `## Summary Dashboard\n\n`;
  markdown += `| Metric | Average Score |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| **Egyptian Slang Authenticity** | ${avgSlang.toFixed(2)} / 5.0 |\n`;
  markdown += `| **Anti-AI Smell (Format/Tone)** | ${avgAntiAi.toFixed(2)} / 5.0 |\n`;
  markdown += `| **JSON Format Compliance** | ${avgJson.toFixed(2)} / 5.0 |\n`;
  markdown += `| **Stance & Goal Alignment** | ${avgStance.toFixed(2)} / 5.0 |\n`;
  markdown += `| **Overall Quality Rating** | **${overallAvg.toFixed(2)} / 5.0** |\n\n`;

  markdown += `## Detailed Scenario Results\n\n`;

  results.forEach((r, idx) => {
    markdown += `### ${idx + 1}. Scenario: ${r.scenario.name}\n\n`;
    markdown += `* **User State:** \`${r.scenario.state}\`\n`;
    markdown += `* **Dialogue Act Assigned:** \`${r.dialogueAct}\`\n`;
    markdown += `* **Target Stance:** Warmth: \`${r.stance.warmth}\`, Pressure: \`${r.stance.pressure}\`, Playful: \`${r.stance.playfulness}\`, Directness: \`${r.stance.directness}\`, Depth: \`${r.stance.depth}\`\n`;
    markdown += `* **User Input:** *"${r.scenario.userMessage}"*\n\n`;

    markdown += `#### Generated Companion Response\n\`\`\`json\n${r.replyText}\n\`\`\`\n\n`;

    markdown += `#### Evaluation Scores\n`;
    markdown += `- **Slang Score:** ${r.evaluation.slangScore}/5\n`;
    markdown += `- **Anti-AI Smell:** ${r.evaluation.antiAiSmellScore}/5\n`;
    markdown += `- **JSON Score:** ${r.evaluation.jsonScore}/5\n`;
    markdown += `- **Stance Score:** ${r.evaluation.stanceScore}/5\n\n`;

    markdown += `> **Judge Reasoning:** ${r.evaluation.reasoning}\n\n`;
    markdown += `---\n\n`;
  });

  try {
    fs.writeFileSync(reportPath, markdown, "utf-8");
    console.log(`Saved evaluation report to: ${reportPath}`);
  } catch (err: any) {
    console.error(`Failed to save evaluation report to artifacts: ${err.message}`);
  }
}

runEvaluation().catch((err) => {
  console.error("Evaluation run failed:", err);
  process.exit(1);
});
