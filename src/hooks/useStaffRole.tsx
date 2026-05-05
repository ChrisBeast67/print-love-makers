import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StaffRole = "owner" | "admin" | "moderator" | null;
// deputy has same powers as owner (except owner can ban them)

export function useStaffRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<StaffRole>(null);
  const [isActualOwner, setIsActualOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r) => r.role as string);
        if (roles.includes("owner")) { setRole("owner"); setIsActualOwner(true); }
        else if (roles.includes("deputy")) { setRole("owner"); setIsActualOwner(false); } // deputies act as owners in UI
        else if (roles.includes("admin")) setRole("owner"); // legacy admins act as owners
        else if (roles.includes("moderator")) setRole("moderator");
        else setRole(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isStaff = role === "owner" || role === "moderator";
  const isOwner = role === "owner";
  return { role, isStaff, isOwner, isActualOwner, loading };
}
