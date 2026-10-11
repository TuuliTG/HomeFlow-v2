// child-sign-in Edge Function (ADR 0003): a child signs in on their own device with the one-time code an adult gave
// them. It answers with a token the app signs in with. The logic lives in childSignIn.ts.
import { serveJson, supabase } from '../_shared/deno/supabaseAdmin.ts';
import { childSignIn } from './childSignIn.ts';

async function takeCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('take_child_sign_in_code', { code });
  if (error) throw error;
  return data as string | null;
}

// A magic link's token, made without sending anything: the child's address receives no mail anyway.
async function signInTokenFor(childId: string): Promise<string> {
  const child = await supabase.auth.admin.getUserById(childId);
  if (child.error) throw child.error;
  const link = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: child.data.user.email ?? '',
  });
  if (link.error) throw link.error;
  return link.data.properties.hashed_token;
}

serveJson('child-sign-in', async (request) =>
  childSignIn(await request.json().catch(() => null), { takeCode, signInTokenFor }),
);
