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
  const [storedRoom, setStoredRoom] = useState<string | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);
  const [autoPrompt, setAutoPrompt] = useState<string | undefined>(undefined);

  // Resolve room from URL param, but keep stored room for landing page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room");
    if (fromUrl && /^[0-9]{2,6}$/.test(fromUrl)) {
      setRoom(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && /^[0-9]{2,6}$/.test(stored)) {
        setStoredRoom(stored);
      }
    }
    setReady(true);
  }, []);

  const isGuest = room === "guest";

  const historyQuery = useQuery({
    queryKey: ["chat-history", room],
    queryFn: () => getMessagesForRoom({ data: { roomNumber: room! } }),
    enabled: !!room && !isGuest,
  });

  const handleCheckIn = (r: string) => {
    localStorage.setItem(STORAGE_KEY, r);
    setAutoPrompt(undefined);
    setStoredRoom(r);
    setRoom(r);
  };

  const handleGuestMode = () => {
    setAutoPrompt("Hej! Jag vill boka ett rum.");
    setRoom("guest");
  };

  const handleContinue = () => {
    if (storedRoom) setRoom(storedRoom);
  };

  const handleCheckOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRoom(null);
    setStoredRoom(null);
    setCheckInNotice(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  };

  const handleBookingConfirmed = (bookingNumber: string) => {
    if (room !== "guest") return;
    const assigned = "814";
    setRoom(assigned);
    setStoredRoom(assigned);
    setCheckInNotice(`Digital incheckning slutförd · Rum ${assigned} · ${bookingNumber}`);
    setTimeout(() => setCheckInNotice(null), 8000);
  };

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (!room) {
    return (
      <CheckIn
        storedRoom={storedRoom}
        onCheckIn={handleCheckIn}
        onGuestMode={handleGuestMode}
        onContinue={handleContinue}
        onCheckOut={handleCheckOut}
      />
    );
  }

  const initialMessages: UIMessage[] = isGuest
    ? []
    : (historyQuery.data ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text", text: m.content }],
      }));

  return (
    <div className="min-h-dvh bg-background">
      <Header roomNumber={room} onCheckOut={handleCheckOut} onNavigateHome={handleCheckOut} />
      {checkInNotice && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-xs font-medium tracking-wide text-emerald-300 animate-fade-in">
          ✓ {checkInNotice}
        </div>
      )}
      {!isGuest && historyQuery.isLoading ? (
        <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Laddar...
          </div>
        </div>
      ) : (
        <GuestChat
          roomNumber={room}
          initialMessages={initialMessages}
          onBookingConfirmed={handleBookingConfirmed}
          autoPrompt={isGuest ? autoPrompt : undefined}
        />
      )}
    </div>
  );
}

