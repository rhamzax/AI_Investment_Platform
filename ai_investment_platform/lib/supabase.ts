import { createClient } from "@supabase/supabase-js";

// Single-user demo: RLS is permissive, so the publishable (anon) key is safe
// to use directly in both Server and Client Components — no auth needed.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
