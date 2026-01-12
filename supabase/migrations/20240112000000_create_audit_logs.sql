-- Create Audit Logs Table
create table if not exists public.audit_logs (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    action text not null,
    ip_address text,
    user_agent text,
    details jsonb default '{}'::jsonb,
    created_at timestamp with time zone not null default now(),
    
    constraint audit_logs_pkey primary key (id)
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policies
-- 1. Admins can view all logs
create policy "Admins can view all audit logs"
    on public.audit_logs
    for select
    using (
        exists (
            select 1 from public.admins
            where admins.user_id = auth.uid()
        )
    );

-- 2. System can insert logs (Service Role)
-- Service role bypasses RLS, but if we want explicit insert for authenticated users (not typically for audit logs unless done via RPC or backend), we leave it restricted.
-- However, our backend uses Service Role key for inserting audit logs, which bypasses RLS, so this is fine.

-- 3. Users can view their own logs (for "My Actions")
create policy "Users can view their own audit logs"
    on public.audit_logs
    for select
    using (
        auth.uid() = user_id
    );

-- Index for performance
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
