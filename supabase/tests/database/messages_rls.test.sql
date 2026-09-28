begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sender@example.test', '', now()),
  ('30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'stranger@example.test', '', now());

insert into public.profiles (id, role)
values ('10000000-0000-0000-0000-000000000001', 'admin')
on conflict (id) do update set role = excluded.role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.bejelentesek (id, user_id, tipus, kategoria, lat, lng, status)
values (900001, '10000000-0000-0000-0000-000000000001', 'talalt', 'egyeb', 47.5, 19.0, 'aktiv');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.uzenetek (from_user_id, to_user_id, report_id, body)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 900001, 'Megtaláltam.')$$,
  'sender can message the report owner'
);

select throws_ok(
  $$insert into public.uzenetek (from_user_id, to_user_id, report_id, body)
    values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 900001, 'wrong recipient')$$,
  'P0001', 'A címzettnek a bejelentés tulajdonosának kell lennie.', 'fake recipient is rejected'
);

select throws_ok(
  $$insert into public.uzenetek (from_user_id, to_user_id, report_id, body)
    values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 900001, 'fake sender')$$,
  'P0001', 'A feladó csak a bejelentkezett felhasználó lehet.', 'fake sender is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$insert into public.uzenetek (from_user_id, to_user_id, report_id, body)
    values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 900001, 'self')$$,
  'P0001', 'Saját magadnak nem küldhetsz üzenetet.', 'self messaging is rejected'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.uzenetek where report_id = 900001), 0, 'unrelated user cannot read the message');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.uzenetek where report_id = 900001), 1, 'participant can read the message');

select * from finish();
rollback;
