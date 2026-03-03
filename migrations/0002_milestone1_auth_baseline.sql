create table if not exists apartments (
  id integer primary key,
  name text not null unique,
  code text not null unique,
  is_active integer not null default 1 check (is_active in (0, 1)),
  created_at text not null,
  updated_at text not null
);

create table if not exists accounts (
  id integer primary key,
  username text not null unique collate nocase,
  password_hash text not null,
  role text not null check (role in ('resident', 'admin', 'staff')),
  is_active integer not null default 1 check (is_active in (0, 1)),
  created_at text not null,
  updated_at text not null,
  last_login_at text
);

create table if not exists residents (
  account_id integer primary key references accounts(id),
  apartment_id integer not null references apartments(id),
  full_name text not null,
  flat_number text not null,
  mobile_number text not null,
  created_at text not null,
  updated_at text not null,
  unique(apartment_id, flat_number)
);

create table if not exists admins (
  account_id integer primary key references accounts(id),
  apartment_id integer not null unique references apartments(id),
  display_name text not null,
  mobile_number text,
  is_shared_account integer not null default 1 check (is_shared_account = 1),
  created_at text not null,
  updated_at text not null
);

create table if not exists staff (
  account_id integer primary key references accounts(id),
  full_name text not null,
  mobile_number text not null,
  staff_type text not null check (staff_type in ('electrician', 'plumber')),
  created_at text not null,
  updated_at text not null
);

create table if not exists sessions (
  id integer primary key,
  token_hash text not null unique,
  account_id integer not null references accounts(id),
  csrf_token text not null,
  expires_at text not null,
  created_at text not null,
  updated_at text not null,
  last_seen_at text not null,
  revoked_at text,
  user_agent text,
  ip_address text
);

create index if not exists idx_sessions_account_id on sessions(account_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

insert into meta (key, value)
values ('schema_version', '2')
on conflict(key) do update set value = excluded.value;
