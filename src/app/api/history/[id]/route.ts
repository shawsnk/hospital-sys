import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// PATCH /api/history/[id] — 标注回复（correct / wrong）
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { annotation, annotated_by } = body as {
      annotation: "correct" | "wrong";
      annotated_by?: string;
    };

    if (!annotation || !["correct", "wrong"].includes(annotation)) {
      return NextResponse.json(
        { error: "annotation 必须为 correct 或 wrong" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("reply_history")
      .update({
        annotation,
        annotated_at: new Date().toISOString(),
        annotated_by: annotated_by || null,
      })
      .eq("id", id);

    if (error) {
      console.error("PATCH history error:", error);
      return NextResponse.json({ error: "标注失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/history/[id] error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
