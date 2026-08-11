import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/dashboard — 聚合统计数据
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Parallel queries
    const [historyRes, faqRes, queueRes] = await Promise.all([
      supabase.from("reply_history").select("source, confidence, annotation, created_at"),
      supabase
        .from("faqs")
        .select("id, category, sensitivity, is_active, hit_count"),
      supabase.from("queue_items").select("status, created_at, updated_at"),
    ]);

    const history = historyRes.data ?? [];
    const faqs = faqRes.data ?? [];
    const queue = queueRes.data ?? [];

    // Today filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const todayHistory = history.filter((r) => r.created_at >= todayStr);

    // Reply stats
    const totalReplies = todayHistory.length;
    const autoReplies = todayHistory.filter(
      (r) => r.source === "faq" || r.source === "ai_generated",
    ).length;
    const manualReplies = todayHistory.filter(
      (r) => r.source === "manual",
    ).length;
    const autoRate =
      totalReplies > 0 ? Math.round((autoReplies / totalReplies) * 100) : 0;

    const withConf = todayHistory.filter((r) => r.confidence != null);
    const avgConfidence =
      withConf.length > 0
        ? (
            withConf.reduce((s, r) => s + (r.confidence || 0), 0) /
            withConf.length
          ).toFixed(2)
        : "0.00";

    const correctCount = todayHistory.filter(
      (r) => r.annotation === "correct",
    ).length;
    const wrongCount = todayHistory.filter(
      (r) => r.annotation === "wrong",
    ).length;
    const annotated = correctCount + wrongCount;
    const accuracyRate =
      annotated > 0 ? Math.round((correctCount / annotated) * 100) : 0;

    // FAQ stats
    const activeFaqs = faqs.filter((f) => f.is_active !== false);
    const categories = new Set(faqs.map((f) => f.category).filter(Boolean));
    const sensitiveCount = faqs.filter((f) => (f.sensitivity || 0) >= 1).length;
    const totalHits = faqs.reduce((s, f) => s + (f.hit_count || 0), 0);

    // Queue stats
    const pendingCount = queue.filter((q) => q.status === "pending").length;
    const todayDone = queue.filter(
      (q) => q.status === "done" && q.updated_at >= todayStr,
    ).length;

    return NextResponse.json({
      today: {
        total_replies: totalReplies,
        auto_replies: autoReplies,
        manual_replies: manualReplies,
        auto_rate: autoRate,
        avg_confidence: avgConfidence,
        correct_count: correctCount,
        wrong_count: wrongCount,
        accuracy_rate: accuracyRate,
      },
      faq_stats: {
        total_faqs: faqs.length,
        active_faqs: activeFaqs.length,
        categories: categories.size,
        sensitive_count: sensitiveCount,
        total_hits: totalHits,
      },
      queue_stats: {
        pending: pendingCount,
        done_today: todayDone,
      },
    });
  } catch (err) {
    console.error("GET /api/dashboard error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
