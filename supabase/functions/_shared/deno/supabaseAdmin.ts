// The Supabase service-role client for the Edge Functions' index.ts files. Type-checked with `deno check`.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { corsHeaders, type JsonAnswer } from '../http.ts';
import { reportError } from './monitoring.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

// The service role bypasses Row Level Security. It is injected by Supabase and never leaves the server.
export const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

/** Serves a function the app calls from the browser: answers its CORS preflight and errors as 500. */
export function serveJson(name: string, answer: (request: Request) => Promise<JsonAnswer>) {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      const { status, body } = await answer(request);
      return Response.json(body, { status, headers: corsHeaders });
    } catch (error) {
      await reportError(`${name} failed`, error);
      return Response.json({ error: 'failed' }, { status: 500, headers: corsHeaders });
    }
  });
}
