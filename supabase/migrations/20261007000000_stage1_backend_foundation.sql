-- Stage 1 backend foundation. Run AFTER supabase-engagement.sql (engagement tables are extended with RLS policies below).
-- Identity: the auth-telegram Edge Function issues a JWT with claims telegram_id + tp_role; all RLS keys off those claims.
-- Secure by default: RLS on everywhere; clients never write xp/stars/balance (server RPC / service role only, Stage 2).

-- ---------- helpers ----------
create or replace function tp_uid() returns bigint language sql stable as $$
  select nullif(auth.jwt() ->> 'telegram_id', '')::bigint
$$;
comment on function tp_uid() is 'Telegram user id from the verified JWT (never from client input). NULL for anon.';

create table if not exists admins (
  telegram_id bigint primary key,
  role text not null default 'admin' check (role in ('admin', 'owner')),
  created_at timestamptz not null default now()
);
comment on table admins is 'Source of truth for admin rights. Managed only via SQL editor / service role. First admin: insert into admins values (<your telegram id>, ''owner'');';

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where telegram_id = tp_uid())
$$;
comment on function is_admin() is 'True when the verified JWT telegram_id exists in admins. Do not rely on the tp_role claim alone.';

-- ---------- tables ----------
create table if not exists users (
  telegram_id bigint primary key,
  username text, first_name text, last_name text, avatar_url text, language_code text,
  xp bigint not null default 0 check (xp >= 0),
  stars bigint not null default 0 check (stars >= 0),
  balance numeric(18,4) not null default 0 check (balance >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  referral_code text unique,
  referred_by bigint references users(telegram_id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
comment on table users is 'One row per Telegram user, created by auth-telegram. xp/stars/balance are server-controlled.';

create table if not exists tasks (
  id text primary key,
  title text not null, description text, kind text not null default 'link', url text,
  reward_stars int not null default 0 check (reward_stars >= 0),
  reward_xp int not null default 0 check (reward_xp >= 0),
  sort_order int not null default 0,
  published boolean not null default false,
  created_by bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on table tasks is 'Admin-managed tasks; users see published rows only.';

create table if not exists user_tasks (
  user_id bigint not null references users(telegram_id) on delete cascade,
  task_id text not null references tasks(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed', 'claimed')),
  progress int not null default 0 check (progress >= 0),
  started_at timestamptz not null default now(), claimed_at timestamptz,
  primary key (user_id, task_id)
);
comment on table user_tasks is 'Task progress/claims. Users read their own; writes happen via server functions (Stage 2).';

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id bigint, title text, body text, media_url text, link_url text,
  kind text not null default 'text' check (kind in ('text', 'image', 'video', 'link')),
  status text not null default 'draft' check (status in ('draft', 'published', 'trashed')),
  sponsor text, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on table posts is 'Channel posts. Public read only when status = published.';

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id bigint not null references users(telegram_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id bigint not null references users(telegram_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(telegram_id) on delete cascade,
  username text, avatar_url text,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
comment on table messages is 'Global chat. Authenticated users read all, insert only as themselves.';
create index if not exists messages_created_at_idx on messages (created_at desc);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id bigint not null references users(telegram_id) on delete cascade,
  referred_id bigint not null unique references users(telegram_id) on delete cascade,
  claimed_milestone int not null default 0,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create table if not exists rig_parts_owned (
  user_id bigint not null references users(telegram_id) on delete cascade,
  part_id text not null,
  purchased_at timestamptz not null default now(),
  primary key (user_id, part_id)
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(telegram_id) on delete cascade,
  type text not null check (type in ('deposit_request', 'withdraw_request', 'reward', 'purchase', 'adjustment')),
  amount numeric(18,4) not null,
  currency text not null default 'TON',
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  note text, created_at timestamptz not null default now()
);
comment on table wallet_transactions is 'Users may only file pending deposit/withdraw requests; everything else is server-written.';

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id bigint not null,
  action text not null, target text, payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
comment on table admin_actions is 'Append-only audit log of admin changes.';

create table if not exists app_settings (
  key text primary key, value jsonb not null default '{}',
  is_public boolean not null default false,
  updated_by bigint, updated_at timestamptz not null default now()
);
comment on table app_settings is 'Admin-managed settings (e.g. xp_timer). Only is_public rows are readable by users.';

create table if not exists phases (
  id int primary key, name text not null,
  features jsonb not null default '[]', active boolean not null default false
);
create table if not exists feature_flags (
  key text primary key, enabled boolean not null default false, description text
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- RLS: enable everywhere ----------
alter table admins enable row level security;
alter table users enable row level security;
alter table tasks enable row level security;
alter table user_tasks enable row level security;
alter table posts enable row level security;
alter table post_comments enable row level security;
alter table post_likes enable row level security;
alter table messages enable row level security;
alter table referrals enable row level security;
alter table rig_parts_owned enable row level security;
alter table wallet_transactions enable row level security;
alter table admin_actions enable row level security;
alter table app_settings enable row level security;
alter table phases enable row level security;
alter table feature_flags enable row level security;
alter table notifications enable row level security;

-- ---------- own-data policies ----------
create policy admins_self_read on admins for select to authenticated using (telegram_id = tp_uid());
create policy users_self_read on users for select to authenticated using (telegram_id = tp_uid() or is_admin());
create policy users_self_update on users for update to authenticated using (telegram_id = tp_uid()) with check (telegram_id = tp_uid());
-- Column-level guard: clients may only edit profile fields, never xp/stars/balance/referred_by.
revoke insert, update, delete on users from anon, authenticated;
grant update (username, first_name, last_name, avatar_url, language_code) on users to authenticated;

create policy user_tasks_self_read on user_tasks for select to authenticated using (user_id = tp_uid() or is_admin());
create policy referrals_self_read on referrals for select to authenticated using (referrer_id = tp_uid() or referred_id = tp_uid() or is_admin());
create policy rig_self_read on rig_parts_owned for select to authenticated using (user_id = tp_uid() or is_admin());
create policy wallet_self_read on wallet_transactions for select to authenticated using (user_id = tp_uid() or is_admin());
create policy wallet_self_request on wallet_transactions for insert to authenticated
  with check (user_id = tp_uid() and type in ('deposit_request', 'withdraw_request') and status = 'pending');

create policy messages_read on messages for select to authenticated using (true);
create policy messages_insert_own on messages for insert to authenticated with check (user_id = tp_uid());
create policy messages_admin_delete on messages for delete to authenticated using (is_admin());

create policy comments_read on post_comments for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.status = 'published'));
create policy comments_insert_own on post_comments for insert to authenticated
  with check (user_id = tp_uid() and exists (select 1 from posts p where p.id = post_id and p.status = 'published'));
create policy comments_admin_delete on post_comments for delete to authenticated using (is_admin());
create policy likes_read on post_likes for select to anon, authenticated using (true);
create policy likes_insert_own on post_likes for insert to authenticated with check (user_id = tp_uid());
create policy likes_delete_own on post_likes for delete to authenticated using (user_id = tp_uid());

-- ---------- public read of published content ----------
create policy tasks_public_read on tasks for select to anon, authenticated using (published);
create policy posts_public_read on posts for select to anon, authenticated using (status = 'published');
create policy settings_public_read on app_settings for select to anon, authenticated using (is_public);
create policy phases_public_read on phases for select to anon, authenticated using (true);
create policy flags_public_read on feature_flags for select to anon, authenticated using (true);
create policy notifications_public_read on notifications for select to anon, authenticated using (published);

-- ---------- admin-only writes (and full read) ----------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'posts', 'app_settings', 'phases', 'feature_flags', 'notifications']
  loop
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
  end loop;
end $$;

create policy admin_actions_read on admin_actions for select to authenticated using (is_admin());
create policy admin_actions_insert on admin_actions for insert to authenticated with check (is_admin() and admin_id = tp_uid());
-- no update/delete policy on admin_actions: the audit log is append-only.

-- ---------- engagement tables (from supabase-engagement.sql) ----------
create policy streaks_self_read on user_streaks for select to authenticated using (user_id = tp_uid() or is_admin());
create policy leaderboard_read on leaderboard_history for select to authenticated using (true);
create policy sponsors_read on sponsors for select to anon, authenticated using (now() between start_date and end_date);
create policy cosmetics_read on premium_cosmetics for select to anon, authenticated using (true);
create policy premium_self_read on user_premium for select to authenticated using (user_id = tp_uid() or is_admin());
create policy milestones_read on community_milestones for select to anon, authenticated using (true);
do $$
declare t text;
begin
  foreach t in array array['sponsors', 'premium_cosmetics', 'community_milestones', 'analytics_exports']
  loop
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
  end loop;
end $$;
-- user_streaks, user_premium, leaderboard_history: client writes intentionally not allowed (server-side only).

-- ---------- seed ----------
insert into phases (id, name, features, active) values
  (1, 'Stealth', '["feed"]', true),
  (2, 'Community', '["feed","chat","bonuses","rig"]', false),
  (3, 'Token & Wallet', '["feed","chat","bonuses","rig","wallet","shop","airdrop"]', false)
on conflict (id) do nothing;
insert into app_settings (key, value, is_public) values ('xp_timer', '{"hours": 4, "xp": 20}', true) on conflict (key) do nothing;
