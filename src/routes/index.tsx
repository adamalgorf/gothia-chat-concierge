import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { CheckIn } from "@/components/CheckIn";
import { Header } from "@/components/Header";
import { GuestChat } from "@/components/GuestChat";
import { getMessagesForRoom } from "@/lib/chat.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gothia Towers · Guest AI Receptionist" },
      {
        name: "description",
        content:
          "Din personliga digitala concierge på Gothia Towers vid Svenska Mässan i Göteborg.",
      },
      { property: "og:title", content: "Gothia Towers · Guest AI Receptionist" },
      {
        property: "og:description",
        content: "Lyxig digital concierge för hotellgäster på Gothia Towers.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "gothia.room";

function Index() {
  const [room, setRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Resolve room: URL param > localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room");
    if (fromUrl && /^[0-9]{2,6}$/.test(fromUrl)) {
      setRoom(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && /^[0-9]{2,6}$/.test(stored)) setRoom(stored);
    }
    setReady(true);
  }, []);

  const historyQuery = useQuery({
    queryKey: ["chat-history", room],
    queryFn: () => getMessagesForRoom({ data: { roomNumber: room! } }),
    enabled: !!room,
  });

  const handleCheckIn = (r: string) => {
    localStorage.setItem(STORAGE_KEY, r);
    setRoom(r);
  };

  const handleCheckOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRoom(null);
    // Strip ?room= from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  };

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (!room) {
    return <CheckIn onCheckIn={handleCheckIn} />;
  }

  const initialMessages: UIMessage[] = (historyQuery.data ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
  }));

  return (
    <div className="min-h-dvh bg-background">
      <Header roomNumber={room} onCheckOut={handleCheckOut} />
      {historyQuery.isLoading ? (
        <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Laddar...
          </div>
        </div>
      ) : (
        <GuestChat
          key={room}
          roomNumber={room}
          initialMessages={initialMessages}
        />
      )}
    </div>
  );
}
