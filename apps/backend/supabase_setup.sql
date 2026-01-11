-- Create a table for public profiles using Supabase Auth
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- Policy: Admins can view all profiles (we'll implement the is_admin check later, for now let's keep it simple or use role check)
-- Ideally we use a clean is_admin function to avoid recursion if we query profiles to check role.
-- BUT, querying the table itself in the policy for the same table can cause infinite recursion.
-- SO: We will rely on JWT claims or a separate setup. 
-- FOR THIS MVP: We will use a function that is "SECURITY DEFINER" to check admin status safely.

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Now the admin policy
create policy "Admins can view all profiles" on profiles
  for select using (public.is_admin());

create policy "Admins can update all profiles" on profiles
  for update using (public.is_admin());

-- Handle New User (Triggers)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Helper to list tables for the admin dashboard
create or replace function get_tables()
returns table (table_name text) language plpgsql security definer as $$
begin
  return query
  select tablename::text
  from pg_catalog.pg_tables
  where schemaname = 'public';
end;
$$;
