import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/keywords — 获取所有敏感词（按分类分组）
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("sensitive_keywords")
      .select("id, word, category, is_whitelist")
      .order("category")
      .order("word");

    if (error) {
      return NextResponse.json({ error: "获取敏感词失败" }, { status: 500 });
    }

    const categories: Record<string, string[]> = {};
    const whitelist: string[] = [];
    for (const kw of data ?? []) {
      if (kw.is_whitelist) {
        whitelist.push(kw.word);
      } else {
        if (!categories[kw.category]) categories[kw.category] = [];
        categories[kw.category].push(kw.word);
      }
    }

    return NextResponse.json({ categories, whitelist });
  } catch (err) {
    console.error("GET /api/keywords error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// POST /api/keywords — 添加敏感词
export async function POST(request: NextRequest) {
  try {
    const { word, category, is_whitelist } = (await request.json()) as {
      word: string;
      category: string;
      is_whitelist?: boolean;
    };

    if (!word || !category) {
      return NextResponse.json({ error: "word 和 category 必填" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("sensitive_keywords").insert({
      word,
      category,
      is_whitelist: is_whitelist || false,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "该敏感词已存在" }, { status: 409 });
      }
      return NextResponse.json({ error: "添加失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/keywords error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// DELETE /api/keywords — 删除敏感词
export async function DELETE(request: NextRequest) {
  try {
    const { word, category } = (await request.json()) as {
      word: string;
      category: string;
    };

    if (!word || !category) {
      return NextResponse.json({ error: "word 和 category 必填" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("sensitive_keywords")
      .delete()
      .eq("word", word)
      .eq("category", category);

    if (error) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/keywords error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
