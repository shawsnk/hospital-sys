import { NextRequest, NextResponse } from "next/server";
import { getEmbedding } from "@/lib/openrouter";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// POST /api/faq/search — 语义搜索 FAQ，返回匹配结果 + 路由决策
// ---------------------------------------------------------------------------

interface FaqMatch {
  id: string;
  question: string;
  answer: string;
  category: string;
  synonyms: string;
  sensitivity: number;
  similarity: number;
  hit_count: number;
}

interface Routing {
  action: "auto_reply" | "suggest" | "manual";
  confidence: number;
  reason: string;
}

function determineRouting(results: FaqMatch[]): Routing {
  if (results.length === 0) {
    return {
      action: "manual",
      confidence: 0,
      reason: "未找到匹配的 FAQ",
    };
  }

  const top = results[0];

  // sensitivity >= 2 → 必须转人工，无论相似度多高
  if (top.sensitivity >= 2) {
    return {
      action: "manual",
      confidence: top.similarity,
      reason: "该问题敏感等级较高，需转人工处理",
    };
  }

  // sensitivity == 1 → 需要审核，降级为 suggest
  if (top.sensitivity === 1) {
    return {
      action: "suggest",
      confidence: top.similarity,
      reason: "该问题需人工审核后回复",
    };
  }

  // sensitivity == 0 的情况，按相似度判断
  if (top.similarity >= 0.82) {
    return {
      action: "auto_reply",
      confidence: top.similarity,
      reason: "高置信度匹配，可自动回复",
    };
  }

  if (top.similarity >= 0.6) {
    return {
      action: "suggest",
      confidence: top.similarity,
      reason: "中等置信度匹配，推荐候选答案供参考",
    };
  }

  return {
    action: "manual",
    confidence: top.similarity,
    reason: "置信度不足，建议转人工处理",
  };
}

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

    const embedding = await getEmbedding(query.trim());

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

    return NextResponse.json({ results, routing });
  } catch (err) {
    console.error("POST /api/faq/search error:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/faq/search — 获取全部 FAQ 列表（FAQ 管理页使用）
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("faqs")
      .select("id, question, answer, category, synonyms, sensitivity, hit_count")
      .order("category")
      .order("hit_count", { ascending: false });

    if (error) {
      console.error("GET faqs error:", error);
      return NextResponse.json(
        { error: "获取 FAQ 列表失败" },
        { status: 500 },
      );
    }

    return NextResponse.json({ faqs: data });
  } catch (err) {
    console.error("GET /api/faq/search error:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 },
    );
  }
}
