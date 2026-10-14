import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StaffRole = "owner" | "deputy" | "admin" | "moderator" | "teacher" | null;

export function useStaffRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<StaffRole>(null);
  const [isActualOwner, setIsActualOwner] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      setIsActualOwner(false);
      setLoadedFor(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r) => r.role as string);
        setIsActualOwner(roles.includes("owner"));
        if (roles.includes("owner")) setRole("owner");
        else if (roles.includes("deputy") || roles.includes("admin")) setRole("deputy"); // legacy admins act as deputies
        else if (roles.includes("moderator")) setRole("moderator");
        else if (roles.includes("teacher")) setRole("teacher");
        else setRole(null);
        setLoadedFor(user.id);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Still loading until roles are fetched for the current user (avoids early redirects).
  const loading = loadedFor !== (user?.id ?? null);
  const isStaff = role === "owner" || role === "deputy" || role === "moderator" || role === "teacher";
  const isTeacher = role === "teacher";
  const isOwner = role === "owner";
  const isDeputy = role === "deputy" || role === "owner";
  return { role, isStaff, isOwner, isActualOwner, isDeputy, isTeacher, loading };
}
