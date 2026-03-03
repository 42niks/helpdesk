PRAGMA foreign_keys = ON;

delete from sessions;
delete from ticket_reviews;
delete from ticket_comments;
delete from ticket_events;
delete from tickets;
delete from staff_apartment_links;
delete from staff;
delete from admins;
delete from residents;
delete from accounts;
delete from apartments;

insert into apartments (id, name, code, is_active, created_at, updated_at)
values (1, 'Palm Meadows', 'PM', 1, datetime('now'), datetime('now'));

insert into accounts (id, username, password_hash, role, is_active, created_at, updated_at)
values
  (1, 'resident_flat101', '$2b$10$9XJDWn4Lm84wDsHMkLnWN.pYxFjYPud.q7flf1YqJtGewzKO6FFm2', 'resident', 1, datetime('now'), datetime('now')),
  (2, 'resident_flat102', '$2b$10$9XJDWn4Lm84wDsHMkLnWN.pYxFjYPud.q7flf1YqJtGewzKO6FFm2', 'resident', 1, datetime('now'), datetime('now')),
  (3, 'admin_pm', '$2b$10$9XJDWn4Lm84wDsHMkLnWN.pYxFjYPud.q7flf1YqJtGewzKO6FFm2', 'admin', 1, datetime('now'), datetime('now')),
  (4, 'staff_electric_1', '$2b$10$9XJDWn4Lm84wDsHMkLnWN.pYxFjYPud.q7flf1YqJtGewzKO6FFm2', 'staff', 1, datetime('now'), datetime('now')),
  (5, 'staff_plumber_1', '$2b$10$9XJDWn4Lm84wDsHMkLnWN.pYxFjYPud.q7flf1YqJtGewzKO6FFm2', 'staff', 1, datetime('now'), datetime('now'));

insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)
values
  (1, 1, 'Flat 101', '101', '9999999999', datetime('now'), datetime('now')),
  (2, 1, 'Flat 102', '102', '9999999998', datetime('now'), datetime('now'));

insert into admins (account_id, apartment_id, display_name, mobile_number, is_shared_account, created_at, updated_at)
values (3, 1, 'Palm Meadows Admin', '8888888888', 1, datetime('now'), datetime('now'));

insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at)
values
  (4, 'Electric Staff', '7777777777', 'electrician', datetime('now'), datetime('now')),
  (5, 'Plumber Staff', '7777777776', 'plumber', datetime('now'), datetime('now'));

insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)
values
  (4, 1, 1, datetime('now'), null),
  (5, 1, 1, datetime('now'), null);
