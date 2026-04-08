export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embedding failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.max_tokens ?? 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter chat failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
