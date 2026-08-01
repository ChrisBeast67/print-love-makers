import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CallKind = "audio" | "video";

export interface CallInfo {
  id: string;
  chat_id: string;
  started_by: string;
  kind: CallKind;
  status: string;
}

interface CallContextValue {
  incomingCall: CallInfo | null;
  activeCall: CallInfo | null;
  connecting: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  micOn: boolean;
  camOn: boolean;
  startCall: (chatId: string, kind: CallKind) => Promise<void>;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  hangUp: () => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const peers = useRef<Record<string, RTCPeerConnection>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signalRef = useRef<any>(null);
  const localRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<CallInfo | null>(null);
  activeRef.current = activeCall;

  const cleanup = useCallback(() => {
    Object.values(peers.current).forEach((pc) => {
      try { pc.close(); } catch { /* noop */ }
    });
    peers.current = {};
    if (signalRef.current) {
      supabase.removeChannel(signalRef.current);
      signalRef.current = null;
    }
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setActiveCall(null);
    setConnecting(false);
    setMicOn(true);
    setCamOn(true);
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video" ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    setCamOn(kind === "video");
    return stream;
  }, []);

  const createPeer = useCallback((peerId: string, callId: string) => {
    if (peers.current[peerId]) return peers.current[peerId];
    const pc = new RTCPeerConnection(ICE);
    peers.current[peerId] = pc;

    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate && signalRef.current) {
        signalRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { to: peerId, from: user?.id, kind: "ice", data: e.candidate.toJSON(), callId },
        });
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    return pc;
  }, [user?.id]);

  const joinSignalling = useCallback(async (call: CallInfo) => {
    if (!user) return;
    const channel = supabase.channel(`call:${call.id}`, {
      config: { presence: { key: user.id } },
    });
    signalRef.current = channel;

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = payload as any;
      if (!p || p.to !== user.id) return;
      const pc = createPeer(p.from, call.id);
      try {
        if (p.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(p.data));
          const answerDesc = await pc.createAnswer();
          await pc.setLocalDescription(answerDesc);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { to: p.from, from: user.id, kind: "answer", data: answerDesc, callId: call.id },
          });
        } else if (p.kind === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(p.data));
        } else if (p.kind === "ice") {
          await pc.addIceCandidate(new RTCIceCandidate(p.data));
        }
      } catch (err) {
        console.error("signal error", err);
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      Object.keys(state).forEach(async (peerId) => {
        if (peerId === user.id || peers.current[peerId]) return;
        // Deterministic initiator: lower uuid creates the offer
        if (user.id < peerId) {
          const pc = createPeer(peerId, call.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { to: peerId, from: user.id, kind: "offer", data: offer, callId: call.id },
          });
        }
      });
    });

    channel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      peers.current[key]?.close();
      delete peers.current[key];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, at: Date.now() });
      }
    });
  }, [createPeer, user]);

  const startCall = useCallback(async (chatId: string, kind: CallKind) => {
    if (!user || activeCall) return;
    setConnecting(true);
    try {
      await getMedia(kind);
    } catch {
      setConnecting(false);
      toast.error("Microphone/camera access is required to call");
      return;
    }
    const { data, error } = await sb.rpc("start_call", { _chat_id: chatId, _kind: kind });
    if (error) {
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
      setConnecting(false);
      toast.error(error.message);
      return;
    }
    const call: CallInfo = { id: data as string, chat_id: chatId, started_by: user.id, kind, status: "ringing" };
    setActiveCall(call);
    setConnecting(false);
    await joinSignalling(call);
  }, [activeCall, getMedia, joinSignalling, user]);

  const answer = useCallback(async () => {
    const call = incomingCall;
    if (!call) return;
    setIncomingCall(null);
    setConnecting(true);
    try {
      await getMedia(call.kind);
    } catch {
      setConnecting(false);
      toast.error("Microphone/camera access is required to answer");
      await sb.rpc("decline_call", { _call_id: call.id });
      return;
    }
    const { error } = await sb.rpc("answer_call", { _call_id: call.id });
    if (error) {
      cleanup();
      toast.error(error.message);
      return;
    }
    setActiveCall({ ...call, status: "active" });
    setConnecting(false);
    await joinSignalling(call);
  }, [cleanup, getMedia, incomingCall, joinSignalling]);

  const decline = useCallback(async () => {
    const call = incomingCall;
    setIncomingCall(null);
    if (call) await sb.rpc("decline_call", { _call_id: call.id });
  }, [incomingCall]);

  const hangUp = useCallback(async () => {
    const call = activeRef.current;
    cleanup();
    if (call) await sb.rpc("leave_call", { _call_id: call.id });
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  // Listen for incoming call invites
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("call-invites")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_participants", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (row.state !== "invited") return;
          const { data } = await sb.from("calls").select("*").eq("id", row.call_id).maybeSingle();
          if (!data || data.status !== "ringing") return;
          if (activeRef.current) return;
          setIncomingCall(data as CallInfo);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Watch call status changes (ended)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("call-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls" }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = payload.new as any;
        if (row.status !== "ended") {
          if (activeRef.current && row.id === activeRef.current.id) {
            setActiveCall((prev) => (prev ? { ...prev, status: row.status } : prev));
          }
          return;
        }
        if (activeRef.current?.id === row.id) {
          cleanup();
          toast("Call ended");
        }
        setIncomingCall((prev) => (prev?.id === row.id ? null : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cleanup, user]);

  // Auto-cancel unanswered calls after 45s
  useEffect(() => {
    if (!activeCall || activeCall.status !== "ringing") return;
    const t = setTimeout(async () => {
      if (activeRef.current?.id === activeCall.id && activeRef.current.status === "ringing") {
        toast("No answer");
        await hangUp();
      }
    }, 45000);
    return () => clearTimeout(t);
  }, [activeCall, hangUp]);

  useEffect(() => {
    if (!incomingCall) return;
    const t = setTimeout(() => setIncomingCall(null), 45000);
    return () => clearTimeout(t);
  }, [incomingCall]);

  // Release media on unload
  useEffect(() => {
    const onUnload = () => { localRef.current?.getTracks().forEach((t) => t.stop()); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return (
    <CallContext.Provider
      value={{ incomingCall, activeCall, connecting, localStream, remoteStreams, micOn, camOn, startCall, answer, decline, hangUp, toggleMic, toggleCam }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCalls = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCalls must be used within CallProvider");
  return ctx;
};
