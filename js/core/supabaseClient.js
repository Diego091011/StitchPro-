import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const sb = createClient(
  'https://hiyxzsirjrlchsoiwfot.supabase.co',
  'sb_publishable_ZBl40K6xblh9Nu_F7Ywnmw_EB7b9Aal' // clave pública (segura con RLS)
);
