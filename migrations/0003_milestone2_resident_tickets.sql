create table if not exists tickets (
  id integer primary key,
  ticket_number text not null unique,
  apartment_id integer not null references apartments(id),
  resident_account_id integer not null references residents(account_id),
  resident_flat_snapshot text not null,
  issue_type text not null check (issue_type in ('electrical', 'plumbing')),
  title text not null,
  description text not null,
  status text not null check (status in ('open', 'assigned', 'in_progress', 'completed')),
  assigned_staff_account_id integer references staff(account_id),
  created_at text not null,
  updated_at text not null,
  assigned_at text,
  in_progress_at text,
  completed_at text,
  completed_by_admin_cancel integer not null default 0 check (completed_by_admin_cancel in (0, 1))
);

create table if not exists ticket_events (
  id integer primary key,
  ticket_id integer not null references tickets(id),
  event_type text not null check (event_type in ('created', 'assigned', 'reassigned', 'status_changed', 'admin_completed_cancel')),
  from_status text check (from_status in ('open', 'assigned', 'in_progress', 'completed')),
  to_status text check (to_status in ('open', 'assigned', 'in_progress', 'completed')),
  from_staff_account_id integer references staff(account_id),
  to_staff_account_id integer references staff(account_id),
  actor_account_id integer not null references accounts(id),
  actor_role text not null check (actor_role in ('resident', 'admin', 'staff')),
  note_text text,
  created_at text not null
);

create table if not exists ticket_comments (
  id integer primary key,
  ticket_id integer not null references tickets(id),
  author_account_id integer not null references accounts(id),
  author_role text not null check (author_role in ('resident', 'admin', 'staff')),
  comment_text text not null,
  created_at text not null
);

create index if not exists idx_tickets_resident_status_updated
  on tickets(resident_account_id, status, updated_at desc);

create index if not exists idx_tickets_resident_updated
  on tickets(resident_account_id, updated_at desc);

create index if not exists idx_tickets_apartment_status_updated
  on tickets(apartment_id, status, updated_at desc);

create index if not exists idx_ticket_events_ticket_created
  on ticket_events(ticket_id, created_at);

create index if not exists idx_ticket_comments_ticket_created
  on ticket_comments(ticket_id, created_at);

insert into meta (key, value)
values ('schema_version', '3')
on conflict(key) do update set value = excluded.value;
