import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// GET /api/queue — 获取队列列表
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assigned_to");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const supabase = createServiceClient();
    let query = supabase
      .from("queue_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);

    const { data, error } = await query;

    if (error) {
      console.error("GET queue error:", error);
      return NextResponse.json({ error: "获取队列失败" }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("GET /api/queue error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/queue — 创建队列项
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query: queryText,
      platform_user,
      priority,
      category,
      sensitivity,
      assigned_to,
      suggested_reply,
      suggested_confidence,
      suggested_source,
    } = body as {
      query: string;
      platform_user?: string;
      priority?: string;
      category?: string;
      sensitivity?: number;
      assigned_to: string;
      suggested_reply?: string;
      suggested_confidence?: number;
      suggested_source?: string;
    };

    if (!queryText || !assigned_to) {
      return NextResponse.json(
        { error: "query 和 assigned_to 为必填" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("queue_items")
      .insert({
        query: queryText,
        platform_user: platform_user || null,
        priority: priority || "normal",
        category: category || null,
        sensitivity: sensitivity ?? 0,
        assigned_to,
        suggested_reply: suggested_reply || null,
        suggested_confidence: suggested_confidence ?? null,
        suggested_source: suggested_source || null,
      })
      .select()
      .single();

    if (error) {
      console.error("POST queue error:", error);
      return NextResponse.json({ error: "创建队列项失败" }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("POST /api/queue error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
