-- Enable pgvector extension (run this in Supabase SQL editor first)
create extension if not exists vector;

-- FAQ knowledge base with vector embeddings
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  synonyms text,
  sensitivity int default 0,
  embedding vector(1536),
  hit_count int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Vector similarity search index
create index if not exists faqs_embedding_idx on faqs using hnsw (embedding vector_cosine_ops);

-- Function for similarity search
create or replace function match_faqs(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  question text,
  answer text,
  category text,
  synonyms text,
  sensitivity int,
  hit_count int,
  similarity float
)
language sql stable
as $$
  select
    faqs.id,
    faqs.question,
    faqs.answer,
    faqs.category,
    faqs.synonyms,
    faqs.sensitivity,
    faqs.hit_count,
    1 - (faqs.embedding <=> query_embedding) as similarity
  from faqs
  where faqs.is_active = true
    and 1 - (faqs.embedding <=> query_embedding) > match_threshold
  order by faqs.embedding <=> query_embedding
  limit match_count;
$$;
