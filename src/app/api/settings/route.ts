import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/settings — 获取所有系统设置
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value");

    if (error) {
      return NextResponse.json({ error: "获取设置失败" }, { status: 500 });
    }

    const settings: Record<string, unknown> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// PUT /api/settings — 批量更新设置
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(body)) {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { key, value: JSON.parse(JSON.stringify(value)), updated_at: now },
          { onConflict: "key" },
        );
      if (error) {
        console.error(`Update setting ${key} error:`, error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
