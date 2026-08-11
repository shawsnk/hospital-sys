import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// GET /api/history — 回复历史列表（支持过滤）
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    const operator = url.searchParams.get("operator");
    const annotation = url.searchParams.get("annotation");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const supabase = createServiceClient();

    let query = supabase
      .from("reply_history")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq("source", source);
    if (operator) query = query.eq("operator_name", operator);
    if (annotation) query = query.eq("annotation", annotation);

    const { data, error, count } = await query;

    if (error) {
      console.error("GET history error:", error);
      return NextResponse.json({ error: "获取历史记录失败" }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error("GET /api/history error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/history — 手动创建回复记录（队列发布回复时使用）
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query: queryText, answer, source, operator_name, routing_action, platform, confidence, faq_id } = body as {
      query: string;
      answer: string;
      source: string;
      operator_name: string;
      routing_action?: string;
      platform?: string;
      confidence?: number;
      faq_id?: string;
    };

    if (!queryText || !answer || !source || !operator_name) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("reply_history")
      .insert({
        query: queryText,
        answer,
        source,
        operator_name,
        routing_action: routing_action || null,
        platform: platform || "xiaohongshu",
        confidence: confidence ?? null,
        faq_id: faq_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("POST history error:", error);
      return NextResponse.json({ error: "创建记录失败" }, { status: 500 });
    }

    return NextResponse.json({ row: data });
  } catch (err) {
    console.error("POST /api/history error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
