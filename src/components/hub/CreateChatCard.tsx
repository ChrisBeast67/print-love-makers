import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Link2 } from "lucide-react";
import { toast } from "sonner";

export const CreateChatCard = () => {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group_chat", { _name: name });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Group created");
    navigate(`/chat/${data}`);
  };

  const createAndInvite = async () => {
    setBusy(true);
    const { data: chatId, error } = await supabase.rpc("create_group_chat", { _name: name });
    if (error || !chatId) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed");
    }
    const { data: invite, error: e2 } = await supabase
      .from("chat_invites")
      .insert({ chat_id: chatId, created_by: (await supabase.auth.getUser()).data.user!.id })
      .select("token")
      .single();
    setBusy(false);
    if (e2) return toast.error(e2.message);
    const url = `${window.location.origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Group created — invite link copied!");
    navigate(`/chat/${chatId}`);
  };

  return (
    <Card className="p-6 glow-box border-primary/20">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Plus className="h-4 w-4 text-primary" /> Create a group chat
      </h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name (optional)"
        />
        <Button onClick={create} disabled={busy}>Create</Button>
        <Button onClick={createAndInvite} disabled={busy} variant="secondary">
          <Link2 className="h-4 w-4 mr-1" /> Create + copy invite
        </Button>
      </div>
    </Card>
  );
};
