import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCalls } from "@/hooks/useCalls";
import { IncomingCallDialog } from "./IncomingCallDialog";
import { CallOverlay } from "./CallOverlay";

export const CallLayer = () => {
  const { incomingCall, activeCall, remoteStreams } = useCalls();
  const [names, setNames] = useState<Record<string, string>>({});

  const ids = [
    ...(incomingCall ? [incomingCall.started_by] : []),
    ...Object.keys(remoteStreams),
  ];
  const missing = ids.filter((id) => !names[id]);

  useEffect(() => {
    if (missing.length === 0) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, username")
      .in("id", missing)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setNames((prev) => {
          const next = { ...prev };
          data.forEach((p) => { next[p.id] = p.username; });
          return next;
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.join(",")]);

  const nameFor = useCallback((id: string) => names[id] ?? "Peer", [names]);

  return (
    <>
      {incomingCall && <IncomingCallDialog callerName={names[incomingCall.started_by]} />}
      {activeCall && <CallOverlay nameFor={nameFor} />}
    </>
  );
};
