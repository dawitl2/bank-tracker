create table if not exists public.construction_house_visual_plans (
  house_id bigint primary key references public.construction_houses(id) on delete cascade,
  plan jsonb not null default '{"walls":[],"materials":{}}'::jsonb,
  active_wall_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_house_visual_plans_plan_object_check
    check (jsonb_typeof(plan) = 'object')
);

create index if not exists construction_house_visual_plans_updated_at_idx
  on public.construction_house_visual_plans (updated_at desc);

alter table public.construction_house_visual_plans enable row level security;

drop policy if exists "Allow public read for construction visual plans"
  on public.construction_house_visual_plans;
create policy "Allow public read for construction visual plans"
  on public.construction_house_visual_plans
  for select
  using (true);

drop policy if exists "Allow public writes for construction visual plans"
  on public.construction_house_visual_plans;
create policy "Allow public writes for construction visual plans"
  on public.construction_house_visual_plans
  for all
  using (true)
  with check (true);

create or replace function public.set_construction_visual_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_construction_visual_plan_updated_at
  on public.construction_house_visual_plans;
create trigger set_construction_visual_plan_updated_at
  before update on public.construction_house_visual_plans
  for each row
  execute function public.set_construction_visual_plan_updated_at();
