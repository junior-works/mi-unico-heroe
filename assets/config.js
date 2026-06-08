/* Config pública de Mi único héroe.
   La anon publishable key es segura para el front (la RLS la limita).
   El service role key NUNCA va acá; solo en edge functions / scripts privados. */
window.MUH_CONFIG = {
  SUPABASE_URL: "https://cflmfhgklerbugtuszjz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_1cxNnv3RLoFe6le4h8cb8g_aRrea1i8",
  VERSION: "0.2.3",
  