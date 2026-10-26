-- Morrow Studio application schema.
-- Run in the Supabase SQL Editor. The Next.js server accesses these tables
-- with SUPABASE_SERVICE_ROLE_KEY; never expose that key to browser code.

create table if not exists public.store_users (
  email text primary key check (email = lower(email)),
  name text not null check (char_length(name) between 2 and 80),
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pending_signups (
  email text primary key check (email = lower(email)),
  name text not null check (char_length(name) between 2 and 80),
  password_salt text not null,
  password_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  detail text not null default '' check (char_length(detail) <= 160),
  price numeric(10, 2) not null check (price > 0 and price <= 100000),
  label text not null default '' check (char_length(label) <= 30),
  image text not null check (char_length(image) between 1 and 1000),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  email text not null check (email = lower(email)),
  phone text not null check (char_length(phone) between 7 and 24),
  address text not null check (char_length(address) between 10 and 500),
  payment_method text not null check (payment_method in ('gcash', 'maya')),
  payment_reference text not null check (char_length(payment_reference) between 1 and 100),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  total numeric(12, 2) not null check (total > 0),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'paid', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_signups_expiry_idx
  on public.pending_signups (expires_at);
create index if not exists products_active_created_idx
  on public.products (active, created_at);
create index if not exists orders_email_created_idx
  on public.orders (email, created_at desc);
create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.complete_signup(p_email text, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending public.pending_signups%rowtype;
begin
  select *
    into pending
    from public.pending_signups
    where email = lower(p_email)
    for update;

  if not found then
    return 'expired';
  end if;

  if pending.expires_at <= pg_catalog.now() then
    delete from public.pending_signups where email = pending.email;
    return 'expired';
  end if;

  if pending.attempts >= 5 then
    delete from public.pending_signups where email = pending.email;
    return 'locked';
  end if;

  if pending.code_hash <> p_code_hash then
    update public.pending_signups
      set attempts = attempts + 1
      where email = pending.email;
    return 'invalid';
  end if;

  if exists (
    select 1 from public.store_users where email = pending.email
  ) then
    delete from public.pending_signups where email = pending.email;
    return 'exists';
  end if;

  insert into public.store_users (email, name, password_salt, password_hash)
    values (pending.email, pending.name, pending.password_salt, pending.password_hash);
  delete from public.pending_signups where email = pending.email;
  return 'verified';
end;
$$;

revoke all on function public.complete_signup(text, text) from public, anon, authenticated;
grant execute on function public.complete_signup(text, text) to service_role;

alter table public.store_users enable row level security;
alter table public.pending_signups enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

revoke all on table public.store_users from anon, authenticated;
revoke all on table public.pending_signups from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.orders from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.store_users to service_role;
grant select, insert, update, delete on table public.pending_signups to service_role;
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.orders to service_role;

insert into public.products (name, detail, price, label, image, color)
values
  ('Washed Bomber Jacket', 'Lightweight nylon · Clay', 128.00, 'BESTSELLER', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85', '#c8b9a7'),
  ('Original Graphic Tee', 'Cotton jersey · Ivory', 84.00, 'JUST IN', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85', '#e6dfd3'),
  ('The Vintage Jean', 'Straight leg · Vintage blue', 112.00, '', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85', '#8292a2'),
  ('City Co-ord Set', 'Relaxed fit · Sky blue', 146.00, 'LOW STOCK', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85', '#383431'),
  ('Everyday Cotton Shirt', 'Organic cotton · Soft white', 96.00, 'JUST IN', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85', '#e8e3da'),
  ('Relaxed Linen Trousers', 'Linen blend · Sand', 118.00, '', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=85', '#cbbda8'),
  ('Soft Knit Cardigan', 'Textured knit · Oatmeal', 132.00, 'BESTSELLER', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85', '#c8b9a7'),
  ('Weekend Shoulder Bag', 'Everyday carry · Espresso', 88.00, '', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85', '#604638')
on conflict (name) do nothing;
