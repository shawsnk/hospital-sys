/**
 * Seed script: reads faq-data.json, generates embeddings via OpenRouter,
 * and inserts into Supabase with pgvector.
 *
 * Usage: npx tsx scripts/seed-faq.ts
 * Requires: .env.local with OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getEmbedding(text: string): Promise<number[]> {
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
    throw new Error(`Embedding failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

interface FaqEntry {
  question: string;
  answer: string;
  category: string;
  synonyms: string;
  sensitivity: number;
}

async function main() {
  const dataPath = path.join(__dirname, "faq-data.json");
  const faqs: FaqEntry[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  console.log(`Loaded ${faqs.length} FAQ entries. Starting embedding...`);

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  let inserted = 0;

  for (let i = 0; i < faqs.length; i += batchSize) {
    const batch = faqs.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (faq) => {
        // Combine question + synonyms for better embedding
        const textToEmbed = `${faq.question} ${faq.synonyms.replace(/;/g, " ")}`;
        const embedding = await getEmbedding(textToEmbed);
        return { ...faq, embedding };
      })
    );

    // Insert batch into Supabase
    const { error } = await supabase.from("faqs").insert(
      results.map((r) => ({
        question: r.question,
        answer: r.answer,
        category: r.category,
        synonyms: r.synonyms,
        sensitivity: r.sensitivity,
        embedding: JSON.stringify(r.embedding),
        hit_count: Math.floor(Math.random() * 80) + 5, // Random hit count for demo
      }))
    );

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      inserted += results.length;
      console.log(`Inserted ${inserted}/${faqs.length} entries...`);
    }

    // Small delay between batches
    if (i + batchSize < faqs.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone! ${inserted} FAQ entries seeded with embeddings.`);
}

main().catch(console.error);
