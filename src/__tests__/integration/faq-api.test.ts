import { describe, it, expect } from 'vitest'

const BASE_URL = 'https://ardr.ai'
const SEARCH_URL = `${BASE_URL}/api/faq/search`

// Helper: check if the live API is reachable before running tests
async function isApiReachable(): Promise<boolean> {
  try {
    const res = await fetch(SEARCH_URL, { method: 'GET', signal: AbortSignal.timeout(8000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

describe('FAQ Search API (live integration)', () => {
  // -----------------------------------------------------------------------
  // 1. GET /api/faq/search — returns FAQ list
  // -----------------------------------------------------------------------
  it('GET should return FAQ list with expected fields', async () => {
    const res = await fetch(SEARCH_URL, { method: 'GET' })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('faqs')
    expect(Array.isArray(json.faqs)).toBe(true)

    if (json.faqs.length > 0) {
      const faq = json.faqs[0]
      expect(faq).toHaveProperty('id')
      expect(faq).toHaveProperty('question')
      expect(faq).toHaveProperty('answer')
      expect(faq).toHaveProperty('category')
      expect(faq).toHaveProperty('sensitivity')
      expect(faq).toHaveProperty('hit_count')
    }
  })

  // -----------------------------------------------------------------------
  // 2. POST with common query — should return results with routing
  // -----------------------------------------------------------------------
  it('POST with common query should return results and routing', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '挂号怎么挂' }),
    })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('results')
    expect(json).toHaveProperty('routing')
    expect(Array.isArray(json.results)).toBe(true)

    // Routing structure validation
    expect(json.routing).toHaveProperty('action')
    expect(json.routing).toHaveProperty('confidence')
    expect(json.routing).toHaveProperty('reason')
    expect(['auto_reply', 'suggest', 'manual']).toContain(json.routing.action)
    expect(typeof json.routing.confidence).toBe('number')
    expect(typeof json.routing.reason).toBe('string')
  })

  // -----------------------------------------------------------------------
  // 3. POST with sensitive query — should route to manual or suggest
  // -----------------------------------------------------------------------
  it('POST with sensitive query should route to manual or suggest', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '医疗事故怎么处理' }),
    })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('routing')
    // Sensitive topics should not be auto-replied
    expect(['suggest', 'manual']).toContain(json.routing.action)
  })

  // -----------------------------------------------------------------------
  // 4. POST with empty query — should return 400
  // -----------------------------------------------------------------------
  it('POST with empty query should return 400', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    })
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json).toHaveProperty('error')
  })

  it('POST with missing query field should return 400', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json).toHaveProperty('error')
  })

  // -----------------------------------------------------------------------
  // 5. POST with irrelevant query — should return low confidence or manual
  // -----------------------------------------------------------------------
  it('POST with irrelevant query should return low confidence or manual routing', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '今天天气怎么样' }),
    })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('routing')

    // Irrelevant queries should either have no results or low confidence
    if (json.results.length === 0) {
      expect(json.routing.action).toBe('manual')
      expect(json.routing.confidence).toBe(0)
    } else {
      // If there are results, confidence should be relatively low
      expect(json.routing.confidence).toBeLessThan(0.85)
    }
  })

  // -----------------------------------------------------------------------
  // 6. Response time check — API should respond within 5 seconds
  // -----------------------------------------------------------------------
  it('POST should respond within 5 seconds', async () => {
    const start = Date.now()
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '门诊时间' }),
    })
    const elapsed = Date.now() - start

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(5000)
  })

  // -----------------------------------------------------------------------
  // 7. Result structure validation — check all expected fields
  // -----------------------------------------------------------------------
  it('POST results should contain all expected fields', async () => {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '怎么预约挂号' }),
    })
    expect(res.status).toBe(200)

    const json = await res.json()

    if (json.results.length > 0) {
      const result = json.results[0]
      // Validate FaqMatch fields from the route definition
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('question')
      expect(result).toHaveProperty('answer')
      expect(result).toHaveProperty('category')
      expect(result).toHaveProperty('similarity')
      expect(result).toHaveProperty('sensitivity')

      // Type checks
      expect(typeof result.id).toBe('string')
      expect(typeof result.question).toBe('string')
      expect(typeof result.answer).toBe('string')
      expect(typeof result.category).toBe('string')
      expect(typeof result.similarity).toBe('number')
      expect(typeof result.sensitivity).toBe('number')

      // similarity should be between 0 and 1
      expect(result.similarity).toBeGreaterThanOrEqual(0)
      expect(result.similarity).toBeLessThanOrEqual(1)

      // Results should be sorted by similarity (descending)
      for (let i = 1; i < json.results.length; i++) {
        expect(json.results[i - 1].similarity).toBeGreaterThanOrEqual(
          json.results[i].similarity,
        )
      }
    }

    // Routing structure is always present
    expect(json.routing).toBeDefined()
    expect(['auto_reply', 'suggest', 'manual']).toContain(json.routing.action)
    expect(json.routing.confidence).toBeGreaterThanOrEqual(0)
    expect(json.routing.confidence).toBeLessThanOrEqual(1)
    expect(json.routing.reason.length).toBeGreaterThan(0)
  })
})
