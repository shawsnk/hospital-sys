// ---------------------------------------------------------------------------
// FAQ 路由决策逻辑
// ---------------------------------------------------------------------------

export interface FaqMatch {
  id: string;
  question: string;
  answer: string;
  category: string;
  synonyms: string;
  sensitivity: number;
  similarity: number;
  hit_count: number;
}

export interface Routing {
  action: "auto_reply" | "suggest" | "manual";
  confidence: number;
  reason: string;
}

export function determineRouting(results: FaqMatch[]): Routing {
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
