import { NextRequest, NextResponse } from "next/server";
import { getEmbedding } from "@/lib/openrouter";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// POST /api/faq/manage — 创建 FAQ（自动生成 embedding）
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, category, synonyms, sensitivity } = body as {
      question?: string;
      answer?: string;
      category?: string;
      synonyms?: string;
      sensitivity?: number;
    };

    if (!question || !answer) {
      return NextResponse.json(
        { error: "question 和 answer 为必填字段" },
        { status: 400 },
      );
    }

    // Generate embedding from question + synonyms
    const embeddingInput = synonyms
      ? `${question} ${synonyms}`
      : question;
    const embedding = await getEmbedding(embeddingInput);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("faqs")
      .insert({
        question,
        answer,
        category: category || null,
        synonyms: synonyms || null,
        sensitivity: sensitivity ?? 0,
        embedding: JSON.stringify(embedding),
        hit_count: 0,
        is_active: true,
      })
      .select("id, question, answer, category, synonyms, sensitivity, hit_count, is_active, created_at")
      .single();

    if (error) {
      console.error("Insert FAQ error:", error);
      return NextResponse.json({ error: "创建 FAQ 失败" }, { status: 500 });
    }

    return NextResponse.json({ faq: data });
  } catch (err) {
    console.error("POST /api/faq/manage error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/faq/manage — 更新 FAQ（问题/同义词变更时重新生成 embedding）
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, question, answer, category, synonyms, sensitivity } = body as {
      id: string;
      question?: string;
      answer?: string;
      category?: string;
      synonyms?: string;
      sensitivity?: number;
    };

    if (!id) {
      return NextResponse.json({ error: "缺少 FAQ id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch current FAQ to compare question/synonyms
    const { data: current, error: fetchErr } = await supabase
      .from("faqs")
      .select("question, synonyms")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "FAQ 不存在" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;
    if (category !== undefined) updates.category = category;
    if (synonyms !== undefined) updates.synonyms = synonyms;
    if (sensitivity !== undefined) updates.sensitivity = sensitivity;

    // Re-generate embedding if question or synonyms changed
    const newQuestion = question ?? current.question;
    const newSynonyms = synonyms ?? current.synonyms;
    if (question !== undefined || synonyms !== undefined) {
      const embeddingInput = newSynonyms
        ? `${newQuestion} ${newSynonyms}`
        : newQuestion;
      const embedding = await getEmbedding(embeddingInput);
      updates.embedding = JSON.stringify(embedding);
    }

    const { data, error } = await supabase
      .from("faqs")
      .update(updates)
      .eq("id", id)
      .select("id, question, answer, category, synonyms, sensitivity, hit_count, is_active, created_at")
      .single();

    if (error) {
      console.error("Update FAQ error:", error);
      return NextResponse.json({ error: "更新 FAQ 失败" }, { status: 500 });
    }

    return NextResponse.json({ faq: data });
  } catch (err) {
    console.error("PUT /api/faq/manage error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/faq/manage — 切换 is_active（软删除/恢复）
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, is_active } = body as { id: string; is_active: boolean };

    if (!id || is_active === undefined) {
      return NextResponse.json(
        { error: "需要 id 和 is_active 字段" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("faqs")
      .update({ is_active })
      .eq("id", id);

    if (error) {
      console.error("Toggle FAQ error:", error);
      return NextResponse.json({ error: "操作失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/faq/manage error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
