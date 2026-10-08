-- Tasks are published to Supabase Realtime. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select results_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  $$ values ('tasks') $$,
  'only tasks are streamed to open apps'
);

select * from finish();
rollback;
