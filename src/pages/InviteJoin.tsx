import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const InviteJoin = () => {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Joining…");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/auth?redirect=/invite/${token}`, { replace: true });
      return;
    }
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("join_chat_with_invite", { _token: token });
      if (error) {
        setStatus(error.message);
        toast.error(error.message);
        return;
      }
      toast.success("Joined chat!");
      navigate(`/chat/${data}`, { replace: true });
    })();
  }, [user, loading, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {status}
    </div>
  );
};

export default InviteJoin;
