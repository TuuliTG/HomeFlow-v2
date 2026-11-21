-- Removing a child without email (ADR 0003), e.g. one added twice by mistake. Their login exists only for this
-- household, so it goes with them, and with it everything that cascades from auth.users: membership, profile,
-- sign-in code, reminders, likes and the rest. Their private tasks would be left without a creator, which nobody can
-- see, so they go first; open tasks they picked up are put back for others.

-- Raises insufficient_privilege (42501) for a child, and no_data_found (P0002) for anyone but a child without email
-- in the adult's household.
create function public.remove_child(child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.adult_household_id(auth.uid());
begin
  if household is null then
    raise exception 'Only an adult in the household can remove a child' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members m
      where m.user_id = remove_child.child_id and m.household_id = household and m.signs_in_with_code
  ) then
    raise exception 'No child with this id signs in with a code in your household' using errcode = 'P0002';
  end if;
  delete from public.tasks t where t.created_by = remove_child.child_id and t.is_private;
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.picked_up_by = remove_child.child_id and t.completed_at is null;
  delete from auth.users u where u.id = remove_child.child_id;
end;
$$;
revoke execute on function public.remove_child(uuid) from public, anon;
grant execute on function public.remove_child(uuid) to authenticated;
