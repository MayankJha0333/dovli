-- Dovli cloud: pages, files, share links and AI usage.
-- Run it once in your Supabase project (SQL editor, or `supabase db push`).
-- Row level security means each person can only ever read and write their own rows.

-- ---------------------------------------------------------------------------
-- Pages
-- ---------------------------------------------------------------------------
create sequence if not exists public.pages_rev_seq;

create table if not exists public.pages (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb,                       -- the whole page (title, blocks, style…); null once purged
  rev bigint not null default nextval('public.pages_rev_seq'),
  purged boolean not null default false,  -- deleted for good: other devices remove it too
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists pages_user_rev on public.pages (user_id, rev);

-- Every write gets a new, ever-growing revision, so devices can ask "what changed since rev N?".
create or replace function public.pages_bump_rev() returns trigger
language plpgsql as $$
begin
  new.rev := nextval('public.pages_rev_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pages_bump_rev on public.pages;
create trigger pages_bump_rev before insert or update on public.pages
for each row execute function public.pages_bump_rev();

alter table public.pages enable row level security;

drop policy if exists "pages: owner reads" on public.pages;
create policy "pages: owner reads" on public.pages for select using (auth.uid() = user_id);
drop policy if exists "pages: owner writes" on public.pages;
create policy "pages: owner writes" on public.pages for insert with check (auth.uid() = user_id);
drop policy if exists "pages: owner updates" on public.pages;
create policy "pages: owner updates" on public.pages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "pages: owner deletes" on public.pages;
create policy "pages: owner deletes" on public.pages for delete using (auth.uid() = user_id);

-- Save a page only if nobody changed it since `p_base_rev` (null = "I think it is new").
-- Returns {ok, rev} on success, or {ok:false, rev, data, purged} so the device can merge and retry.
create or replace function public.push_page(p_id text, p_data jsonb, p_base_rev bigint, p_purged boolean default false)
returns jsonb
language plpgsql
security invoker
as $$
declare
  cur public.pages;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into cur from public.pages where user_id = auth.uid() and id = p_id for update;

  if not found then
    if p_purged then
      return jsonb_build_object('ok', true, 'rev', 0);
    end if;
    insert into public.pages (user_id, id, data, purged) values (auth.uid(), p_id, p_data, false) returning * into cur;
    return jsonb_build_object('ok', true, 'rev', cur.rev);
  end if;

  if p_base_rev is distinct from cur.rev then
    return jsonb_build_object('ok', false, 'rev', cur.rev, 'data', cur.data, 'purged', cur.purged);
  end if;

  update public.pages
     set data = case when p_purged then null else p_data end,
         purged = p_purged
   where user_id = auth.uid() and id = p_id
  returning * into cur;

  -- A page deleted for good stops being shared.
  if p_purged then
    delete from public.shares where user_id = auth.uid() and page_id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'rev', cur.rev);
end $$;

grant execute on function public.push_page(text, jsonb, bigint, boolean) to authenticated;

-- Live updates to other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pages'
  ) then
    alter publication supabase_realtime add table public.pages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Share links
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  id text primary key,                      -- the random part of the link
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null,
  access text not null default 'view' check (access in ('view', 'edit')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, page_id)
);

alter table public.shares enable row level security;
drop policy if exists "shares: owner manages" on public.shares;
create policy "shares: owner manages" on public.shares for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone with the link can read the shared page, and nothing else.
create or replace function public.get_shared_page(p_share text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('access', s.access, 'page', p.data, 'rev', p.rev)
    from public.shares s
    join public.pages p on p.user_id = s.user_id and p.id = s.page_id
   where s.id = p_share and s.enabled and not p.purged and p.data is not null
     and coalesce((p.data ->> 'deletedAt'), '') = '';
$$;

grant execute on function public.get_shared_page(text) to anon, authenticated;

-- People with an "edit" link may change the title and text of that one page.
create or replace function public.update_shared_page(p_share text, p_title text, p_blocks jsonb, p_base_rev bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shares;
  cur public.pages;
begin
  select * into s from public.shares where id = p_share and enabled and access = 'edit';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This link does not allow editing.');
  end if;
  select * into cur from public.pages where user_id = s.user_id and id = s.page_id for update;
  if not found or cur.purged then
    return jsonb_build_object('ok', false, 'error', 'This page no longer exists.');
  end if;
  if p_base_rev is distinct from cur.rev then
    return jsonb_build_object('ok', false, 'conflict', true, 'rev', cur.rev, 'page', cur.data);
  end if;
  update public.pages
     set data = cur.data || jsonb_build_object('title', p_title, 'blocks', p_blocks, 'updatedAt', (extract(epoch from now()) * 1000)::bigint)
   where user_id = s.user_id and id = s.page_id
  returning * into cur;
  return jsonb_build_object('ok', true, 'rev', cur.rev);
end $$;

grant execute on function public.update_shared_page(text, text, jsonb, bigint) to anon, authenticated;

-- Used by the server (service key) to check a file belongs to a shared page before handing out a link.
create or replace function public.shared_file_owner(p_share text, p_file text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select s.user_id
    from public.shares s
    join public.pages p on p.user_id = s.user_id and p.id = s.page_id
   where s.id = p_share and s.enabled and position(('dovli-file://' || p_file) in p.data::text) > 0;
$$;

-- Functions are callable by everyone by default in Postgres, so close this one to all but the server.
revoke execute on function public.shared_file_owner(text, text) from public, anon, authenticated;
grant execute on function public.shared_file_owner(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Files (images, PDFs, audio…) in Storage, one private folder per person
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists "files: owner reads" on storage.objects;
create policy "files: owner reads" on storage.objects for select
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "files: owner writes" on storage.objects;
create policy "files: owner writes" on storage.objects for insert
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "files: owner updates" on storage.objects;
create policy "files: owner updates" on storage.objects for update
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "files: owner deletes" on storage.objects;
create policy "files: owner deletes" on storage.objects for delete
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- AI usage, counted per person per month by the server
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,              -- e.g. 2026-10
  tokens integer not null default 0,
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage: owner reads" on public.ai_usage;
create policy "ai_usage: owner reads" on public.ai_usage for select using (auth.uid() = user_id);
-- Only the server (service key) writes usage.

create or replace function public.add_ai_usage(p_user uuid, p_month text, p_tokens integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, month, tokens) values (p_user, p_month, p_tokens)
  on conflict (user_id, month) do update set tokens = public.ai_usage.tokens + excluded.tokens
  returning tokens;
$$;

revoke execute on function public.add_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.add_ai_usage(uuid, text, integer) to service_role;
