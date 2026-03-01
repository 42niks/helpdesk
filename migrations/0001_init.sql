-- Minimal starting point. We'll expand this schema as we implement the MVP.
create table if not exists meta (
  key text primary key,
  value text not null
);

insert or ignore into meta (key, value) values ('schema_version', '1');

