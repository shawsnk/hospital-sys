import { describe, it, expect } from "vitest";
import { determineRouting, FaqMatch } from "@/lib/routing";

// ---------------------------------------------------------------------------
// Helper: 构造 FaqMatch 测试数据
// ---------------------------------------------------------------------------

function makeFaq(overrides: Partial<FaqMatch> = {}): FaqMatch {
  return {
    id: "faq-1",
    question: "测试问题",
    answer: "测试答案",
    category: "general",
    synonyms: "",
    sensitivity: 0,
    similarity: 0.9,
    hit_count: 1,
    ...overrides,
  };
}

// ===========================================================================
// 1. 空结果集
// ===========================================================================

describe("determineRouting — 空结果集", () => {
  it("空数组返回 manual + confidence 0", () => {
    const result = determineRouting([]);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain("未找到");
  });
});

// ===========================================================================
// 2. sensitivity >= 2 → manual（不论 similarity）
// ===========================================================================

describe("determineRouting — sensitivity >= 2", () => {
  it("sensitivity=2, 高相似度仍返回 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 2, similarity: 0.99 })]);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0.99);
  });

  it("sensitivity=3, 返回 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 3, similarity: 0.5 })]);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0.5);
  });

  it("sensitivity=10, 极高值仍 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 10, similarity: 1.0 })]);
    expect(result.action).toBe("manual");
  });
});

// ===========================================================================
// 3. sensitivity == 1 → suggest
// ===========================================================================

describe("determineRouting — sensitivity == 1", () => {
  it("sensitivity=1, 高相似度返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 1, similarity: 0.95 })]);
    expect(result.action).toBe("suggest");
    expect(result.confidence).toBe(0.95);
  });

  it("sensitivity=1, 低相似度仍返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 1, similarity: 0.3 })]);
    expect(result.action).toBe("suggest");
    expect(result.confidence).toBe(0.3);
  });
});

// ===========================================================================
// 4. sensitivity == 0, similarity >= 0.82 → auto_reply
// ===========================================================================

describe("determineRouting — sensitivity=0, auto_reply 区间", () => {
  it("similarity=0.82（精确阈值）返回 auto_reply", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.82 })]);
    expect(result.action).toBe("auto_reply");
    expect(result.confidence).toBe(0.82);
  });

  it("similarity=0.99 返回 auto_reply", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.99 })]);
    expect(result.action).toBe("auto_reply");
  });

  it("similarity=1.0 返回 auto_reply", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 1.0 })]);
    expect(result.action).toBe("auto_reply");
  });

  it("similarity=0.8199… 刚好低于 0.82 不返回 auto_reply", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.8199 })]);
    expect(result.action).not.toBe("auto_reply");
  });
});

// ===========================================================================
// 5. sensitivity == 0, 0.6 <= similarity < 0.82 → suggest
// ===========================================================================

describe("determineRouting — sensitivity=0, suggest 区间", () => {
  it("similarity=0.6（精确阈值）返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.6 })]);
    expect(result.action).toBe("suggest");
    expect(result.confidence).toBe(0.6);
  });

  it("similarity=0.7 返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.7 })]);
    expect(result.action).toBe("suggest");
  });

  it("similarity=0.8199 返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.8199 })]);
    expect(result.action).toBe("suggest");
  });

  it("similarity=0.5999 不返回 suggest", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.5999 })]);
    expect(result.action).toBe("manual");
  });
});

// ===========================================================================
// 6. sensitivity == 0, similarity < 0.6 → manual
// ===========================================================================

describe("determineRouting — sensitivity=0, manual 区间", () => {
  it("similarity=0.59 返回 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.59 })]);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0.59);
  });

  it("similarity=0 返回 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0 })]);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0);
  });

  it("similarity=0.1 返回 manual", () => {
    const result = determineRouting([makeFaq({ sensitivity: 0, similarity: 0.1 })]);
    expect(result.action).toBe("manual");
  });
});

// ===========================================================================
// 7. 边界值与特殊场景
// ===========================================================================

describe("determineRouting — 边界值与特殊场景", () => {
  it("只使用第一个结果（top）做决策", () => {
    const results = [
      makeFaq({ sensitivity: 0, similarity: 0.5 }),  // manual
      makeFaq({ sensitivity: 0, similarity: 0.99 }), // 忽略
    ];
    const result = determineRouting(results);
    expect(result.action).toBe("manual");
    expect(result.confidence).toBe(0.5);
  });

  it("多个结果时 sensitivity 检查基于 top", () => {
    const results = [
      makeFaq({ sensitivity: 2, similarity: 0.9 }),
      makeFaq({ sensitivity: 0, similarity: 0.99 }),
    ];
    const result = determineRouting(results);
    expect(result.action).toBe("manual");
  });

  it("reason 字段始终为非空字符串", () => {
    const cases = [
      [],
      [makeFaq({ sensitivity: 2, similarity: 0.9 })],
      [makeFaq({ sensitivity: 1, similarity: 0.9 })],
      [makeFaq({ sensitivity: 0, similarity: 0.9 })],
      [makeFaq({ sensitivity: 0, similarity: 0.7 })],
      [makeFaq({ sensitivity: 0, similarity: 0.3 })],
    ];
    for (const c of cases) {
      const result = determineRouting(c);
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
    }
  });

  it("action 值始终为三种之一", () => {
    const valid = new Set(["auto_reply", "suggest", "manual"]);
    const cases = [
      [],
      [makeFaq({ sensitivity: 0, similarity: 0.9 })],
      [makeFaq({ sensitivity: 0, similarity: 0.7 })],
      [makeFaq({ sensitivity: 0, similarity: 0.3 })],
      [makeFaq({ sensitivity: 1, similarity: 0.9 })],
      [makeFaq({ sensitivity: 2, similarity: 0.9 })],
    ];
    for (const c of cases) {
      expect(valid.has(determineRouting(c).action)).toBe(true);
    }
  });
});
