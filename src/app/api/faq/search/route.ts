import { NextRequest, NextResponse } from "next/server";
import { getEmbedding } from "@/lib/openrouter";
import { createServiceClient } from "@/lib/supabase";
import { determineRouting } from "@/lib/routing";
import type { FaqMatch } from "@/lib/routing";

// ---------------------------------------------------------------------------
// POST /api/faq/search — 语义搜索 FAQ，返回匹配结果 + 路由决策
// ---------------------------------------------------------------------------

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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("include_inactive") === "true";

    const supabase = createServiceClient();
    let query = supabase
      .from("faqs")
      .select("id, question, answer, category, synonyms, sensitivity, hit_count, is_active")
      .order("category")
      .order("hit_count", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

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
