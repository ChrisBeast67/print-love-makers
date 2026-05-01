import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser(token);
    if (callerErr || !caller) return json({ error: "Unauthorized" }, 401);
    const callerId = caller.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isStaff, error: roleErr } = await admin.rpc("is_staff", { _user_id: callerId });
    if (roleErr || !isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const targetId = body?.user_id;
    if (typeof targetId !== "string" || targetId.length < 10) {
      return json({ error: "Invalid user_id" }, 400);
    }
    if (targetId === callerId) return json({ error: "Cannot delete your own account" }, 400);

    // Wipe app data first (also enforces role checks).
    const { error: wipeErr } = await admin.rpc("admin_delete_user_data", { _target: targetId });
    if (wipeErr) return json({ error: wipeErr.message }, 400);

    // Delete the auth user.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: "Auth delete failed" }, 500);

    return json({ ok: true, deleted: targetId });
  } catch (_e) {
    return json({ error: "Internal error" }, 500);
  }
});