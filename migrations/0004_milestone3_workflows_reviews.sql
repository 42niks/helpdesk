create table if not exists staff_apartment_links (
  id integer primary key,
  staff_account_id integer not null references staff(account_id),
  apartment_id integer not null references apartments(id),
  is_active integer not null default 1 check (is_active in (0, 1)),
  linked_at text not null,
  unlinked_at text
);

create unique index if not exists uniq_staff_apartment_active
  on staff_apartment_links(staff_account_id, apartment_id)
  where is_active = 1;

create index if not exists idx_staff_apartment_links_apartment_active
  on staff_apartment_links(apartment_id, is_active, staff_account_id);

create table if not exists ticket_reviews (
  id integer primary key,
  ticket_id integer not null unique references tickets(id),
  resident_account_id integer not null references residents(account_id),
  staff_account_id integer not null references staff(account_id),
  rating integer check (rating between 1 and 5),
  review_text text,
  created_at text not null,
  check (rating is not null or review_text is null or length(trim(review_text)) = 0)
);

create index if not exists idx_ticket_reviews_staff_created
  on ticket_reviews(staff_account_id, created_at desc);

create index if not exists idx_ticket_reviews_resident_created
  on ticket_reviews(resident_account_id, created_at desc);

insert into meta (key, value)
values ('schema_version', '4')
on conflict(key) do update set value = excluded.value;
