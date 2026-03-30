create table if not exists public.user_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.user_billing enable row level security;

drop policy if exists "Users can view own billing" on public.user_billing;
create policy "Users can view own billing"
  on public.user_billing
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own billing" on public.user_billing;
create policy "Users can insert own billing"
  on public.user_billing
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own billing" on public.user_billing;
create policy "Users can update own billing"
  on public.user_billing
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional migration from older table name used in early MVP:
do $$
begin
  if to_regclass('public.profiles') is not null then
    insert into public.user_billing (user_id, plan, stripe_customer_id, stripe_subscription_id, updated_at)
    select id, plan, stripe_customer_id, stripe_subscription_id, updated_at
    from public.profiles
    on conflict (user_id) do update
    set plan = excluded.plan,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        updated_at = excluded.updated_at;
  end if;
end $$;
