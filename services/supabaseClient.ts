import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wkjveonvvhmqiprwvtqf.supabase.co';
const supabaseKey = 'sb_publishable_zItamiDQMkVqSdCTKTOpOA_XBiazchf';

export const supabase = createClient(supabaseUrl, supabaseKey);