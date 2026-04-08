import { NextRequest, NextResponse } from "next/server";
import { getEmbedding, chatCompletion } from "@/lib/openrouter";
import { createServiceClient } from "@/lib/supabase";
import { determineRouting } from "@/lib/routing";
import type { FaqMatch } from "@/lib/routing";

const SYSTEM_PROMPT = `你是一家三甲医院的社交媒体智能回复助手，主要在小红书平台回复患者留言。

严格规则（违反任何一条即为不合格）：
- 绝对不能提供任何诊断、治疗方案或用药指导
- 不能承诺疗效、治愈率或具体价格
- 不能透露医院内部管理信息
- 急症/紧急情况必须第一时间引导拨打急诊电话或前往急诊科
- 投诉类问题只能道歉+引导私信，不能承诺赔偿或解释内部原因

语气要求：
- 亲切专业，适合社交媒体风格
- 适当使用"亲"、"姐妹"等称呼
- 可以使用少量 emoji 增加亲和力
- 回复控制在 100 字以内`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body as { query?: string };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "缺少有效的 query 参数" },
        { status: 400 },
      );
    }

    const trimmed = query.trim();

    // Step 1: Embedding search (reuse same logic as /api/faq/search)
    const embedding = await getEmbedding(trimmed);
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("match_faqs", {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (error) {
      console.error("match_faqs RPC error:", error);
      return NextResponse.json(
        { error: "FAQ 搜索失败" },
        { status: 500 },
      );
    }

    const results: FaqMatch[] = data ?? [];
    const routing = determineRouting(results);

    // Step 2: Branch based on routing decision
    // High sensitivity → manual only, no AI generation
    if (routing.action === "manual" && results.length > 0 && results[0].sensitivity >= 2) {
      return NextResponse.json({
        source: "manual_only",
        answer: null,
        confidence: routing.confidence,
        routing,
        results: results.slice(0, 3),
      });
    }

    // High confidence FAQ match → return FAQ answer directly
    if (routing.action === "auto_reply") {
      return NextResponse.json({
        source: "faq",
        answer: results[0].answer,
        confidence: results[0].similarity,
        routing,
        results: results.slice(0, 3),
      });
    }

    // Medium confidence or no match → LLM generation
    const faqContext = results.length > 0
      ? results
          .slice(0, 3)
          .map((r, i) => `FAQ${i + 1}:\n问：${r.question}\n答：${r.answer}`)
          .join("\n\n")
      : "（无匹配的FAQ条目）";

    const userPrompt = results.length > 0
      ? `以下是知识库中相关的FAQ供参考：\n\n${faqContext}\n\n用户留言：${trimmed}\n\n请基于以上FAQ内容，生成一条合适的回复。如果FAQ内容不够相关，可以基于医院常识回复，但必须遵守安全规则。`
      : `用户留言：${trimmed}\n\n知识库中没有直接相关的FAQ。请基于医院常识生成一条安全、得体的回复。`;

    const aiReply = await chatCompletion([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);

    return NextResponse.json({
      source: "ai_generated",
      answer: aiReply,
      confidence: routing.confidence,
      routing,
      results: results.slice(0, 3),
    });
  } catch (err) {
    console.error("POST /api/ai/reply error:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 },
    );
  }
}
