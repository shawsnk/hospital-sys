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

-- ---------------------------------------------------------------------------
-- Reply history — stores every published reply
-- ---------------------------------------------------------------------------
create table if not exists reply_history (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  answer text not null,
  source text not null check (source in ('faq','ai_generated','manual','template')),
  confidence float,
  faq_id uuid references faqs(id),
  routing_action text check (routing_action in ('auto_reply','suggest','manual')),
  operator_name text not null,
  platform text default 'xiaohongshu',
  annotation text check (annotation in ('correct','wrong')),
  annotated_at timestamptz,
  annotated_by text,
  status text default 'published',
  created_at timestamptz default now()
);

create index if not exists idx_reply_history_created on reply_history (created_at desc);
create index if not exists idx_reply_history_operator on reply_history (operator_name);
create index if not exists idx_reply_history_source on reply_history (source);

-- ---------------------------------------------------------------------------
-- Queue items — manual processing queue
-- ---------------------------------------------------------------------------
create table if not exists queue_items (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  platform text default 'xiaohongshu',
  platform_user text,
  priority text default 'normal' check (priority in ('urgent','high','normal','low')),
  category text,
  sensitivity int default 0,
  assigned_to text not null,
  status text default 'pending' check (status in ('pending','in_progress','done','reassigned')),
  suggested_reply text,
  suggested_confidence float,
  suggested_source text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_queue_status on queue_items (status, priority);
create index if not exists idx_queue_assigned on queue_items (assigned_to);

-- ---------------------------------------------------------------------------
-- Users table (P1)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text not null default 'operator' check (role in ('super_admin','admin','operator')),
  avatar_letter text,
  avatar_class text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_users_role on users (role);

-- ---------------------------------------------------------------------------
-- Sensitive keywords (P2)
-- ---------------------------------------------------------------------------
create table if not exists sensitive_keywords (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  category text not null,
  is_whitelist boolean default false,
  created_at timestamptz default now()
);

create unique index if not exists idx_kw_word_cat on sensitive_keywords (word, category);

-- ---------------------------------------------------------------------------
-- System settings (P2)
-- ---------------------------------------------------------------------------
create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
