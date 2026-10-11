// add-child Edge Function (ADR 0003): an adult adds a child without email to their household. It creates the child's
// login and answers with a one-time sign-in code. The logic lives in addChild.ts.
import { serveJson, supabase } from '../_shared/deno/supabaseAdmin.ts';
import { addChild, NotAnAdultError, type SignInCode } from './addChild.ts';

/** Child logins get an address that can't receive mail (RFC 2606): children sign in with codes only. */
const CHILD_EMAIL_DOMAIN = 'child.homeflow.invalid';

async function userIdFromToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user.id;
}

async function isAdult(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('household_members')
    .select('is_child')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { is_child: boolean } | null)?.is_child === false;
}

async function createChildLogin(): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${crypto.randomUUID()}@${CHILD_EMAIL_DOMAIN}`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function deleteLogin(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

async function addChildToHousehold(
  adultId: string,
  childId: string,
  displayName: string,
): Promise<SignInCode> {
  const { data, error } = await supabase
    .rpc('add_child', { adult_id: adultId, child_id: childId, display_name: displayName })
    .single();
  if (error?.code === '42501') throw new NotAnAdultError();
  if (error) throw error;
  const row = data as { code: string; expires_at: string };
  return { code: row.code, expiresAt: row.expires_at };
}

serveJson('add-child', async (request) =>
  addChild(request.headers.get('authorization'), await request.json().catch(() => null), {
    userIdFromToken,
    isAdult,
    createChildLogin,
    deleteLogin,
    addChild: addChildToHousehold,
  }),
);
