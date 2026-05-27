/**
 * Brain-Map Server Functions — manages user nodes, relationships,
 * and automated AI extraction from chat contexts.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";

export interface BrainNode {
  id: string;
  user_id: string;
  type: "problem" | "goal" | "fear" | "task";
  title: string;
  status: "active" | "resolved";
  parent_id: string | null;
  created_at: string;
}

export interface NodeLink {
  from_node: string;
  to_node: string;
  relation_type: "causes" | "helps" | "blocks" | "subtask";
}

// ─── Fetch Brain Map Data ──────────────────────────────────────────────────

export const fetchBrainMapData = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ nodes: BrainNode[]; links: NodeLink[] }> => {
    const { userId } = data;

    const [nodesRes, linksRes] = await Promise.all([
      supabaseAdmin
        .from("brain_nodes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("node_links")
        .select("from_node, to_node, relation_type")
        .or(`from_node.in.(select id from brain_nodes where user_id='${userId}'),to_node.in.(select id from brain_nodes where user_id='${userId}')`),
    ]);

    const nodes = (nodesRes.data as BrainNode[]) || [];
    const links = (linksRes.data as NodeLink[]) || [];

    return { nodes, links };
  });

// ─── Add Manual Node ────────────────────────────────────────────────────────

export const addManualNode = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      title: string;
      type: "problem" | "goal" | "fear" | "task";
      parentId?: string;
    }) => input
  )
  .handler(async ({ data }): Promise<BrainNode> => {
    const { userId, title, type, parentId } = data;

    const { data: node, error } = await supabaseAdmin
      .from("brain_nodes")
      .insert({
        user_id: userId,
        title: title.trim(),
        type,
        parent_id: parentId || null,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return node as BrainNode;
  });

// ─── Delete Brain Node ─────────────────────────────────────────────────────

export const deleteBrainNode = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; nodeId: string }) => input)
  .handler(async ({ data }) => {
    const { userId, nodeId } = data;

    // Delete relationships and children (due to CASCADE in DB, parent delete is sufficient)
    const { error } = await supabaseAdmin
      .from("brain_nodes")
      .delete()
      .eq("id", nodeId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Update Node Status ─────────────────────────────────────────────────────

export const updateNodeStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; nodeId: string; status: "active" | "resolved" }) => input
  )
  .handler(async ({ data }) => {
    const { userId, nodeId, status } = data;

    const { error } = await supabaseAdmin
      .from("brain_nodes")
      .update({ status })
      .eq("id", nodeId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Extract Brain Nodes From Chat (AI pipeline) ───────────────────────────

export const extractBrainNodesFromChat = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; userText: string }) => input)
  .handler(async ({ data }) => {
    const { userId, userText } = data;

    // 1. Fetch current active nodes to allow linking
    const { data: existingNodes } = await supabaseAdmin
      .from("brain_nodes")
      .select("id, title, type")
      .eq("user_id", userId)
      .eq("status", "active");

    const existingList = (existingNodes || [])
      .map((n) => `[id: ${n.id}, type: ${n.type}, title: "${n.title}"]`)
      .join("\n");

    const systemInstruction = `
أنت جزء من عقل "رفيق" السلوكي ومحلل نفسي ومساعد تنظيم. مهمتك تحليل رسالة المستخدم الأخيرة وتحديد ما إذا كان يذكر أي أهداف أو مشاكل أو مخاوف أو مهام جديدة لتحديث خريطة دماغه.

الفئات التي نبحث عنها:
- goal: هدف أو شيء يريد تحقيقه (مثال: "عايز أنظم نومي").
- problem: مشكلة أو عقبة حالية يواجهها (مثال: "بكسل أبدأ").
- fear: خوف أو قلق يمنعه من التقدم (مثال: "قلقان ما ألحقش أذاكر").
- task: مهمة مادية محددة صغيرة (مثال: "هقرأ صفحتين كيمياء").

التعليمات الفنية:
١) قم بصياغة العقد الجديدة بأسلوب موجز جداً (من ٢ إلى ٥ كلمات بالعامية المصرية الدافئة).
٢) إذا كانت العقد الجديدة مرتبطة ببعضها أو بعقدة قديمة، حدد الرابط بدقة.
٣) أنواع العلاقات المسموحة:
   - "causes": عقدة تسبب عقدة أخرى.
   - "helps": عقدة تساعد في حل/تحقيق عقدة أخرى.
   - "blocks": عقدة تعطل أو تمنع عقدة أخرى.
   - "subtask": مهمة فرعية من هدف أو مشكلة.

العقد الحالية الموجودة في خريطة المستخدم (استخدم الـ id للربط معها):
${existingList || "لا يوجد عقد حالياً."}

يجب أن يكون ردك عبارة عن كود JSON صالح فقط ومطابق للهيكل التالي تماماً (بدون أي نصوص إضافية أو علامات كود):
{
  "nodes": [
    {
      "temp_id": "new_1",
      "type": "goal" | "problem" | "fear" | "task",
      "title": "عنوان العقدة بالعامية"
    }
  ],
  "links": [
    {
      "from_temp_id": "new_1",
      "to_node_id": "معرف العقدة القديمة (إذا كان مرتبطاً بها)",
      "relation_type": "causes" | "helps" | "blocks" | "subtask"
    },
    {
      "from_temp_id": "new_1",
      "to_temp_id": "new_2 (في حال ربط عقدتين جديدتين)",
      "relation_type": "causes" | "helps" | "blocks" | "subtask"
    }
  ]
}

إذا لم يكن هناك أي فكرة جديدة تستحق الإضافة، أرجع كود فارغ تماماً: {"nodes": [], "links": []}
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: `رسالة المستخدم الأخيرة: "${userText}"`,
      temperature: 0.2, // low temperature for precise classification
      maxOutputTokens: 1000,
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                temp_id: { type: "string" },
                type: { type: "string" },
                title: { type: "string" },
              },
              required: ["temp_id", "type", "title"],
            },
          },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from_temp_id: { type: "string" },
                from_node_id: { type: "string" },
                to_temp_id: { type: "string" },
                to_node_id: { type: "string" },
                relation_type: { type: "string" },
              },
              required: ["relation_type"],
            },
          },
        },
        required: ["nodes", "links"],
      },
    });

    if (!aiResult.json) {
      return { success: true, newNodesCount: 0 };
    }

    const { nodes: newNodes = [], links: newLinks = [] } = aiResult.json as {
      nodes: Array<{ temp_id: string; type: string; title: string }>;
      links: Array<{
        from_temp_id?: string;
        from_node_id?: string;
        to_temp_id?: string;
        to_node_id?: string;
        relation_type: string;
      }>;
    };

    if (newNodes.length === 0) {
      return { success: true, newNodesCount: 0 };
    }

    // 2. Write new nodes into database & keep map from temp_id -> UUID
    const tempToUuid: Record<string, string> = {};
    for (const node of newNodes) {
      const typeValid = ["problem", "goal", "fear", "task"].includes(node.type)
        ? (node.type as "problem" | "goal" | "fear" | "task")
        : "task";

      const { data: insertedNode } = await supabaseAdmin
        .from("brain_nodes")
        .insert({
          user_id: userId,
          type: typeValid,
          title: node.title.trim(),
          status: "active",
        })
        .select("id")
        .single();

      if (insertedNode) {
        tempToUuid[node.temp_id] = insertedNode.id;
      }
    }

    // 3. Write links into database
    for (const link of newLinks) {
      const fromNodeId = link.from_node_id || (link.from_temp_id ? tempToUuid[link.from_temp_id] : null);
      const toNodeId = link.to_node_id || (link.to_temp_id ? tempToUuid[link.to_temp_id] : null);
      const relValid = ["causes", "helps", "blocks", "subtask"].includes(link.relation_type)
        ? (link.relation_type as "causes" | "helps" | "blocks" | "subtask")
        : "helps";

      if (fromNodeId && toNodeId) {
        await supabaseAdmin.from("node_links").insert({
          from_node: fromNodeId,
          to_node: toNodeId,
          relation_type: relValid,
        });
      }
    }

    return { success: true, newNodesCount: newNodes.length };
  });
