const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
