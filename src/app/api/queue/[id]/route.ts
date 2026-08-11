import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// PATCH /api/queue/[id] — 队列操作：publish / done / reassign
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body as {
      action: "publish" | "done" | "reassign";
      reply?: string;
      assigned_to?: string;
      operator_name?: string;
      notes?: string;
    };

    if (!action) {
      return NextResponse.json({ error: "缺少 action" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch current queue item
    const { data: item, error: fetchErr } = await supabase
      .from("queue_items")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ error: "队列项不存在" }, { status: 404 });
    }

    if (action === "publish") {
      const reply = body.reply as string;
      const operatorName = (body.operator_name as string) || item.assigned_to;

      if (!reply) {
        return NextResponse.json({ error: "缺少回复内容" }, { status: 400 });
      }

      // 1. Mark queue item as done
      await supabase
        .from("queue_items")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", id);

      // 2. Create reply_history entry
      const { error: histErr } = await supabase.from("reply_history").insert({
        query: item.query,
        answer: reply,
        source: item.suggested_reply === reply ? (item.suggested_source || "ai_generated") : "manual",
        confidence: item.suggested_confidence,
        routing_action: "manual",
        operator_name: operatorName,
        platform: item.platform,
      });

      if (histErr) {
        console.error("Insert reply_history error:", histErr);
      }

      return NextResponse.json({ ok: true, status: "done" });
    }

    if (action === "done") {
      const { error } = await supabase
        .from("queue_items")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "操作失败" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "done" });
    }

    if (action === "reassign") {
      const newAssignee = body.assigned_to as string;
      if (!newAssignee) {
        return NextResponse.json({ error: "缺少转交目标" }, { status: 400 });
      }

      // Update current item
      const { error } = await supabase
        .from("queue_items")
        .update({
          assigned_to: newAssignee,
          notes: (body.notes as string) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "转交失败" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, assigned_to: newAssignee });
    }

    return NextResponse.json({ error: "未知 action" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/queue/[id] error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
