-- Fair-engagement + monetization tables (run in the Supabase SQL editor). The app mirrors to these best-effort; localStorage stays the source of truth offline.
-- RLS is enabled below with no policies = locked to the service role. Add explicit policies (admin-only writes for sponsors, premium_cosmetics, analytics_exports; never trust client-asserted user_premium) before connecting the app.
create table if not exists user_streaks (user_id bigint primary key, current_streak int not null default 0, max_streak int not null default 0, last_login timestamptz, reset_at timestamptz);
create table if not exists leaderboard_history (id uuid primary key default gen_random_uuid(), snapshot jsonb not null, created_at timestamptz not null default now());
create table if not exists sponsors (id text primary key, name text not null, logo_url text, link text not null, start_date timestamptz not null, end_date timestamptz not null, created_by bigint);
create table if not exists premium_cosmetics (id text primary key, name text not null, type text not null check (type in ('border', 'theme', 'bubble')), config jsonb not null default '{}');
create table if not exists user_premium (user_id bigint primary key, tier text, expires_at timestamptz);
create table if not exists community_milestones (id text primary key, metric text not null, target bigint not null, current bigint not null default 0, unlocked_at timestamptz);
create table if not exists analytics_exports (id text primary key, admin_id bigint, type text not null, file_url text, created_at timestamptz not null default now());
alter table user_streaks enable row level security;
alter table leaderboard_history enable row level security;
alter table sponsors enable row level security;
alter table premium_cosmetics enable row level security;
alter table user_premium enable row level security;
alter table community_milestones enable row level security;
alter table analytics_exports enable row level security;
