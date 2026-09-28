-- Harden message creation and make sent messages immutable.
begin;

alter table public.uzenetek
  drop constraint if exists uzenetek_body_length_check;

-- NOT VALID preserves legacy rows while enforcing the rule for every new row.
alter table public.uzenetek
  add constraint uzenetek_body_length_check
  check (char_length(btrim(body)) between 1 and 2000) not valid;

create or replace function public.can_send_message(
  requested_from_user_id uuid,
  requested_to_user_id uuid,
  requested_report_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and requested_from_user_id = auth.uid()
    and requested_to_user_id <> auth.uid()
    and exists (
      select 1
      from public.bejelentesek b
      where b.id = requested_report_id
        and b.user_id = requested_to_user_id
        and (
          b.status = 'aktiv'
          or exists (
            select 1
            from public.uzenetek previous_message
            where previous_message.report_id = requested_report_id
              and previous_message.from_user_id = auth.uid()
              and previous_message.to_user_id = requested_to_user_id
          )
        )
    );
$$;

revoke all on function public.can_send_message(uuid, uuid, bigint) from public;
grant execute on function public.can_send_message(uuid, uuid, bigint) to authenticated;

create or replace function public.enforce_message_insert_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_owner uuid;
  report_status text;
begin
  if auth.uid() is null then
    raise exception using message = 'Az üzenetküldéshez be kell jelentkezni.', errcode = 'P0001';
  end if;

  if new.from_user_id is distinct from auth.uid() then
    raise exception using message = 'A feladó csak a bejelentkezett felhasználó lehet.', errcode = 'P0001';
  end if;

  select b.user_id, b.status into report_owner, report_status
  from public.bejelentesek b
  where b.id = new.report_id;

  if not found then
    raise exception using message = 'A hivatkozott bejelentés nem található.', errcode = 'P0001';
  end if;

  if new.to_user_id is distinct from report_owner then
    raise exception using message = 'A címzettnek a bejelentés tulajdonosának kell lennie.', errcode = 'P0001';
  end if;

  if new.to_user_id = auth.uid() then
    raise exception using message = 'Saját magadnak nem küldhetsz üzenetet.', errcode = 'P0001';
  end if;

  if new.body is null or char_length(btrim(new.body)) = 0 then
    raise exception using message = 'Az üzenet szövege nem lehet üres.', errcode = 'P0001';
  end if;

  if char_length(new.body) > 2000 then
    raise exception using message = 'Az üzenet legfeljebb 2000 karakter lehet.', errcode = 'P0001';
  end if;

  if report_status <> 'aktiv' and not exists (
    select 1 from public.uzenetek previous_message
    where previous_message.report_id = new.report_id
      and previous_message.from_user_id = auth.uid()
      and previous_message.to_user_id = report_owner
  ) then
    raise exception using message = 'Első üzenet csak aktív bejelentéshez küldhető.', errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_message_insert_rules on public.uzenetek;
create trigger trg_enforce_message_insert_rules
before insert on public.uzenetek
for each row execute function public.enforce_message_insert_rules();

drop policy if exists "uzenetek_insert_sender" on public.uzenetek;
drop policy if exists "uzenetek_insert_valid_participant" on public.uzenetek;
create policy "uzenetek_insert_valid_participant"
  on public.uzenetek for insert
  to authenticated
  with check (public.can_send_message(from_user_id, to_user_id, report_id));

-- Sent messages are immutable. In particular their participants, report,
-- timestamp and body cannot be changed; corrections must be a new message.
drop policy if exists "uzenetek_update_sender" on public.uzenetek;
revoke update on public.uzenetek from anon, authenticated;

commit;
