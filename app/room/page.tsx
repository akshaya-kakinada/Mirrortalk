"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type MessageRow = {
  id?: string;
  room_id: string;
  sender: string;
  content: string;
  created_at?: string;
};

export default function RoomPage() {
  const params = useParams();
  const roomCode = String(params.code || "");

  const supabase = useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);

  // Load last messages once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomCode)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) setMessages(data as MessageRow[]);
    })();
  }, [supabase, roomCode]);

  // Realtime subscribe
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.room_id === roomCode) setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomCode]);

  const send = async () => {
    if (!name.trim() || !message.trim()) return;

    await supabase.from("messages").insert({
      room_id: roomCode,
      sender: name.trim(),
      content: message.trim(),
    });

    setMessage("");
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">MirrorTalk</h1>
        <p className="text-sm text-white/70 mb-6">
          Room: <span className="font-mono">{roomCode}</span>
        </p>

        <div className="flex gap-3 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-48 rounded border border-white/20 bg-white/5 px-3 py-2 outline-none"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded border border-white/20 bg-white/5 px-3 py-2 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            onClick={send}
            className="rounded bg-green-600 px-4 py-2 font-semibold"
          >
            Send
          </button>
        </div>

        <div className="h-[60vh] overflow-y-auto rounded border border-white/10 bg-white/5 p-4 space-y-2">
          {messages.map((m, idx) => (
            <div key={m.id ?? idx}>
              <span className="font-semibold">{m.sender}:</span>{" "}
              <span className="text-white/90">{m.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
