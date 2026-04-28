import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  const { email } = await req.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const user = data.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
  if (!user) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, deleted: user.id }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
});