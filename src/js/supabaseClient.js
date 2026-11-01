import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL = 'https://hiyxzsirjrlchsoiwfot.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZBl40K6xblh9Nu_F7Ywnmw_EB7b9Aal'; // clave pública (segura con RLS)

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
