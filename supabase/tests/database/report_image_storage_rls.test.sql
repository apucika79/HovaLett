begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('report-images', '10000000-0000-0000-0000-000000000001/own.jpg',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg"}')$$,
  'upload to own UUID folder is allowed'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('report-images', '20000000-0000-0000-0000-000000000002/foreign.jpg',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg"}')$$,
  '42501', null, 'upload to another UUID folder is denied'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('report-images', '10000000-0000-0000-0000-000000000001/not-image.jpg',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"text/plain"}')$$,
  '42501', null, 'non-image MIME type is denied'
);

reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('report-images', '20000000-0000-0000-0000-000000000002/theirs.jpg',
  '20000000-0000-0000-0000-000000000002', '{"mimetype":"image/jpeg"}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

delete from storage.objects where bucket_id = 'report-images' and name like '20000000-0000-0000-0000-000000000002/%';
select is((select count(*)::integer from storage.objects where name like '20000000-0000-0000-0000-000000000002/%'), 1, 'deleting another user image is denied');

delete from storage.objects where bucket_id = 'report-images' and name = '10000000-0000-0000-0000-000000000001/own.jpg';
reset role;
select is((select count(*)::integer from storage.objects where name = '10000000-0000-0000-0000-000000000001/own.jpg'), 0, 'deleting own image is allowed');

select * from finish();
rollback;
