import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BOT_ID = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(authHeader.slice(7));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.message_id === "string" ? body.message_id : null;
    if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: "Bad request" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: msg } = await admin.from("messages").select("id, chat_id, user_id, content").eq("id", messageId).maybeSingle();
    if (!msg || msg.user_id !== user.id) return json({ error: "Not found" }, 404);
    if (!msg.content || msg.content.startsWith("__img__:") || msg.content.startsWith("__vid__:")) return json({ mean: false });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!,
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "You are the safety system of a school chat for kids. Decide if the message is bullying, harassment, or mean teasing. Bullying = attacking, insulting, threatening, excluding or ganging up on someone. Harassment = repeated or unwanted targeting, pressuring, or making someone uncomfortable. Mean teasing = mocking, name-calling, or joking at someone's expense in a hurtful way. Friendly jokes between friends and normal talk are NOT a problem. Reply in JSON with the category." },
          { role: "user", content: msg.content.slice(0, 2000) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "verdict", strict: true,
            schema: { type: "object", additionalProperties: false, required: ["mean", "category", "reason"],
              properties: { mean: { type: "boolean" },
                category: { type: "string", enum: ["bullying", "harassment", "teasing", "none"] },
                reason: { type: "string" } } },
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return json({ error: "AI unavailable" }, res.status === 429 || res.status === 402 ? res.status : 502);
    }
    const data = await res.json();
    const verdict = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    if (!verdict.mean) return json({ mean: false });

    const { data: prof } = await admin.from("profiles").select("username").eq("id", msg.user_id).maybeSingle();
    await admin.from("message_reports").insert({
      message_id: msg.id, chat_id: msg.chat_id, content: msg.content, author_id: msg.user_id,
      author_username: prof?.username ?? null, reported_by: BOT_ID, reporter_username: "🛡️ Safety Bot",
      reason: `${verdict.category && verdict.category !== "none" ? `[${verdict.category}] ` : ""}${String(verdict.reason ?? "Mean message")}`.slice(0, 300),
    });
    return json({ mean: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
});
