-- Stage 2: server-authoritative progression. Run AFTER the Stage 1 migration.
-- Clients never write xp/stars/balance; they call these SECURITY DEFINER functions (identity = verified JWT via tp_uid()).

alter table users add column if not exists last_xp_claim timestamptz;
alter table users add column if not exists last_daily timestamptz;
alter table users add column if not exists tasks_completed int not null default 0;
alter table users add column if not exists referral_claimed int[] not null default '{}';
alter table users add column if not exists settings jsonb not null default '{}';
alter table users add column if not exists ton_keeper_connected boolean not null default false;
grant update (settings, ton_keeper_connected) on users to authenticated;

alter table tasks add column if not exists metric text;
alter table tasks add column if not exists goal int not null default 1 check (goal >= 0);
alter table posts add column if not exists payload jsonb not null default '{}';
alter table notifications add column if not exists payload jsonb not null default '{}';

insert into tasks (id, title, kind, reward_stars, reward_xp, metric, goal, sort_order, published) values
  ('earn_xp', 'Zdobądź 50 XP', 'metric', 10, 0, 'xp_total', 50, 1, true),
  ('invite_3', 'Zaproś 3 znajomych', 'metric', 50, 0, 'referral_count', 3, 2, true),
  ('reach_lvl3', 'Osiągnij poziom 3', 'metric', 100, 0, 'level', 3, 3, true),
  ('complete_10', 'Wykonaj 10 zadań', 'metric', 200, 0, 'tasks_completed', 10, 4, true),
  ('top_10', 'Wejdź do Top 10 rankingu', 'metric', 500, 0, 'in_top10', 1, 5, true)
on conflict (id) do nothing;

-- ---------- helpers ----------
create or replace function tp_setting(p_key text, p_default jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = p_key), p_default)
$$;

create or replace function tp_me() returns users language plpgsql security definer set search_path = public as $$
declare u users;
begin
  if tp_uid() is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select * into u from users where telegram_id = tp_uid() for update;
  if not found then raise exception 'no_user' using errcode = 'P0002'; end if;
  return u;
end $$;

create or replace function tp_level_for(p_xp bigint) returns int language sql immutable as $$
  select case when p_xp >= 20000 then 7 when p_xp >= 12000 then 6 when p_xp >= 7000 then 5
              when p_xp >= 3500 then 4 when p_xp >= 1500 then 3 when p_xp >= 500 then 2 else 1 end
$$;

-- ---------- XP timer / daily ----------
create or replace function tp_claim_timer() returns users language plpgsql security definer set search_path = public as $$
declare u users; s jsonb := tp_setting('xp_timer', '{"hours": 4, "xp": 20}');
begin
  u := tp_me();
  if u.last_xp_claim is not null and u.last_xp_claim + (coalesce((s ->> 'hours')::numeric, 4) * interval '1 hour') > now() then
    raise exception 'cooldown' using errcode = 'P0001';
  end if;
  update users set xp = xp + coalesce((s ->> 'xp')::bigint, 20), last_xp_claim = now() where telegram_id = u.telegram_id returning * into u;
  return u;
end $$;

create or replace function tp_claim_daily() returns users language plpgsql security definer set search_path = public as $$
declare u users; s jsonb := tp_setting('daily', '{"xp": 10}');
begin
  u := tp_me();
  if u.last_daily is not null and u.last_daily + interval '24 hours' > now() then
    raise exception 'cooldown' using errcode = 'P0001';
  end if;
  update users set xp = xp + coalesce((s ->> 'xp')::bigint, 10), last_daily = now(), tasks_completed = tasks_completed + 1
    where telegram_id = u.telegram_id returning * into u;
  return u;
end $$;

-- ---------- tasks ----------
create or replace function tp_claim_task(p_task_id text) returns users language plpgsql security definer set search_path = public as $$
declare u users; t tasks; v numeric; mult numeric := coalesce(nullif(tp_setting('xp_multiplier', '1') #>> '{}', '')::numeric, 1);
begin
  u := tp_me();
  select * into t from tasks where id = p_task_id and published;
  if not found then raise exception 'unknown_task' using errcode = 'P0001'; end if;
  if exists (select 1 from user_tasks where user_id = u.telegram_id and task_id = t.id and status = 'claimed') then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;
  if t.metric is not null then
    v := case t.metric
      when 'xp_total' then u.xp
      when 'level' then tp_level_for(u.xp)
      when 'tasks_completed' then u.tasks_completed
      when 'clicks' then u.clicks
      when 'referral_count' then (select count(*) from referrals where referrer_id = u.telegram_id)
      when 'in_top10' then case when (select count(*) from users x where x.xp > u.xp) < 10 then 1 else 0 end
      else null end;
    if v is null then raise exception 'unknown_metric' using errcode = 'P0001'; end if;
    if v < t.goal then raise exception 'not_ready' using errcode = 'P0001'; end if;
  end if;
  insert into user_tasks (user_id, task_id, status, progress, claimed_at) values (u.telegram_id, t.id, 'claimed', t.goal, now())
    on conflict (user_id, task_id) do update set status = 'claimed', progress = excluded.progress, claimed_at = now();
  update users set stars = stars + t.reward_stars, xp = xp + round(t.reward_xp * mult), tasks_completed = tasks_completed + 1
    where telegram_id = u.telegram_id returning * into u;
  return u;
end $$;

-- ---------- RIG ----------
create or replace function tp_buy_rig_part(p_part_id text) returns users language plpgsql security definer set search_path = public as $$
declare u users; prices jsonb := '{"case":25,"ram":20,"gpu":40,"monitor":30,"keyboard":15,"mouse":10}'::jsonb || coalesce(tp_setting('rig_prices', '{}'), '{}');
        price bigint;
begin
  u := tp_me();
  if p_part_id = 'desk' or not (prices ? p_part_id) then raise exception 'unknown_part' using errcode = 'P0001'; end if;
  price := (prices ->> p_part_id)::bigint;
  if exists (select 1 from rig_parts_owned where user_id = u.telegram_id and part_id = p_part_id) then raise exception 'owned' using errcode = 'P0001'; end if;
  if u.stars < price then raise exception 'insufficient_stars' using errcode = 'P0001'; end if;
  insert into rig_parts_owned (user_id, part_id) values (u.telegram_id, p_part_id);
  update users set stars = stars - price where telegram_id = u.telegram_id returning * into u;
  return u;
end $$;

-- ---------- referrals ----------
create or replace function tp_register_referral(p_referrer bigint) returns users language plpgsql security definer set search_path = public as $$
declare u users;
begin
  u := tp_me();
  if u.referred_by is null and p_referrer <> u.telegram_id and u.created_at > now() - interval '1 day'
     and exists (select 1 from users where telegram_id = p_referrer) then
    insert into referrals (referrer_id, referred_id) values (p_referrer, u.telegram_id) on conflict (referred_id) do nothing;
    update users set referred_by = p_referrer where telegram_id = u.telegram_id returning * into u;
  end if;
  return u;
end $$;

create or replace function tp_claim_referrals() returns users language plpgsql security definer set search_path = public as $$
declare u users; cnt int; m jsonb;
  ms jsonb := tp_setting('referral_milestones', '[{"count":10,"xp":100},{"count":20,"xp":250},{"count":50,"xp":1000}]');
begin
  u := tp_me();
  select count(*) into cnt from referrals where referrer_id = u.telegram_id;
  for m in select * from jsonb_array_elements(ms) loop
    if cnt >= (m ->> 'count')::int and not ((m ->> 'count')::int = any (u.referral_claimed)) then
      update users set xp = xp + (m ->> 'xp')::bigint, referral_claimed = array_append(referral_claimed, (m ->> 'count')::int)
        where telegram_id = u.telegram_id returning * into u;
    end if;
  end loop;
  return u;
end $$;

-- ---------- clicker ----------
create or replace function tp_sync_clicks(p_clicks bigint) returns users language plpgsql security definer set search_path = public as $$
declare u users; thr jsonb := tp_setting('click_thresholds', '{"small":100,"smallXp":5,"big":1000,"bigXp":50,"special":10000}');
        nxt bigint; sm bigint; bg bigint; sp bigint; xp_gain bigint;
begin
  u := tp_me();
  nxt := least(greatest(p_clicks, u.clicks), u.clicks + 1000);
  if nxt = u.clicks then return u; end if;
  sm := greatest((thr ->> 'small')::bigint, 1); bg := greatest((thr ->> 'big')::bigint, 1); sp := greatest((thr ->> 'special')::bigint, 1);
  xp_gain := greatest(0, (nxt / bg - u.clicks / bg) - (nxt / sp - u.clicks / sp)) * (thr ->> 'bigXp')::bigint
           + (nxt / sp - u.clicks / sp) * (thr ->> 'bigXp')::bigint
           + greatest(0, (nxt / sm - u.clicks / sm) - (nxt / bg - u.clicks / bg)) * (thr ->> 'smallXp')::bigint;
  update users set clicks = nxt, xp = xp + xp_gain where telegram_id = u.telegram_id returning * into u;
  return u;
end $$;

-- ---------- wallet requests ----------
create or replace function tp_request_wallet(p_type text, p_amount numeric) returns users language plpgsql security definer set search_path = public as $$
declare u users;
begin
  u := tp_me();
  if p_type not in ('deposit', 'withdraw') or p_amount is null or p_amount <= 0 then raise exception 'invalid_request' using errcode = 'P0001'; end if;
  if p_type = 'withdraw' then
    if u.balance < p_amount then raise exception 'insufficient_balance' using errcode = 'P0001'; end if;
    update users set balance = balance - p_amount where telegram_id = u.telegram_id returning * into u;
  end if;
  insert into wallet_transactions (user_id, type, amount, status) values (u.telegram_id, p_type || '_request', p_amount, 'pending');
  return u;
end $$;

-- ---------- leaderboard (only public fields) ----------
create or replace function tp_leaderboard() returns table (telegram_id bigint, username text, avatar_url text, xp bigint, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select telegram_id, username, case when length(avatar_url) < 2000 then avatar_url else null end, xp, last_seen_at
  from users where coalesce((settings -> 'privacy' ->> 'show_in_ranking')::boolean, true)
  order by xp desc limit 20
$$;

-- ---------- grants ----------
do $$
declare f text;
begin
  foreach f in array array['tp_me()', 'tp_claim_timer()', 'tp_claim_daily()', 'tp_claim_task(text)', 'tp_buy_rig_part(text)',
    'tp_register_referral(bigint)', 'tp_claim_referrals()', 'tp_sync_clicks(bigint)', 'tp_request_wallet(text, numeric)', 'tp_leaderboard()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke all on function tp_setting(text, jsonb) from public, anon, authenticated;
