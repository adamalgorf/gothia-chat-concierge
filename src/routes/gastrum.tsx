import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, DoorOpen } from "lucide-react";
import type { UIMessage } from "ai";
import { QRCodeSVG } from "qrcode.react";
import { GuestChat } from "@/components/GuestChat";
import { getMessagesForRoom } from "@/lib/chat.functions";

export const Route = createFileRoute("/gastrum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gästrum · Gothia Towers" },
      {
        name: "description",
        content:
          "In-room concierge för gäster på Gothia Towers — beställ room service, städning och spa direkt från rummet.",
      },
      { property: "og:title", content: "Gästrum · Gothia Towers" },
      {
        property: "og:description",
        content: "In-room concierge för gäster på Gothia Towers.",
      },
    ],
  }),
  component: Gastrum,
});

function Gastrum() {
  const [room, setRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Read ?room= from URL on mount; otherwise show the connect form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room");
    if (fromUrl && /^[0-9]{2,6}$/.test(fromUrl)) {
      setRoom(fromUrl);
    }
    setReady(true);
  }, []);

  const historyQuery = useQuery({
    queryKey: ["chat-history", room],
    queryFn: () => getMessagesForRoom({ data: { roomNumber: room! } }),
    enabled: !!room,
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!/^[0-9]{2,6}$/.test(trimmed)) {
      setError("Ange ett giltigt rumsnummer (2–6 siffror).");
      return;
    }
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("room", trimmed);
    window.history.replaceState({}, "", url.toString());
    setRoom(trimmed);
  };

  const handleDisconnect = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
    setRoom(null);
    setInput("");
  };

  if (!ready) return <div className="min-h-dvh bg-background" />;

  // Connect view — no room yet.
  if (!room) {
    return (
      <div className="relative min-h-dvh w-full overflow-hidden bg-background">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/80" />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
          <Link to="/" className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-foreground/60 hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tillbaka
          </Link>
          <div className="font-display text-lg font-medium tracking-wide text-foreground sm:text-xl">
            GOTHIA <span className="text-gold">TOWERS</span>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-96px)] max-w-2xl flex-col justify-center px-6 pb-12 sm:px-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">
            Gästrum
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[0.95] tracking-tight text-foreground sm:text-6xl">
            Concierge <span className="italic text-gold">direkt</span> från rummet.
          </h1>
          <p className="mt-6 max-w-md text-base text-foreground/75">
            Skanna QR-koden på skrivbordet eller TV:n i ditt rum — eller ange rumsnumret nedan — för att
            beställa room service, städning, spa och taxi utan att lyfta luren.
          </p>

          <form onSubmit={handleConnect} className="mt-10 max-w-md space-y-4">
            <label
              htmlFor="room-number"
              className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
            >
              Rumsnummer
            </label>
            <div className="flex gap-3">
              <input
                id="room-number"
                type="text"
                inputMode="numeric"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
                placeholder="1204"
                className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-6 py-4 font-display text-2xl tracking-[0.3em] text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-gold px-7 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
              >
                Anslut
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        </main>
      </div>
    );
  }

  // Connected view — show chat for the room.
  const initialMessages: UIMessage[] = (historyQuery.data ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
  }));

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/gastrum?room=${room}`
      : `/gastrum?room=${room}`;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="group flex flex-col items-start text-left">
            <span className="font-display text-base font-medium tracking-wide text-foreground sm:text-lg">
              GOTHIA <span className="italic text-gold">Towers</span>
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/50 transition-colors group-hover:text-gold/80">
              Gästrum
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 backdrop-blur-md">
              <DoorOpen className="h-3.5 w-3.5 text-gold" strokeWidth={1.75} />
              <span className="hidden text-[9px] font-medium uppercase tracking-[0.3em] text-foreground/55 sm:inline">
                Rum
              </span>
              <span className="font-display text-sm tracking-wider text-gold">{room}</span>
            </div>

            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-foreground/70 backdrop-blur-md transition-all hover:border-gold/50 hover:bg-foreground/10 hover:text-gold active:scale-[0.97]"
              title="Byt rum"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.3em]">Byt rum</span>
            </button>
          </div>
        </div>
      </header>

      {historyQuery.isLoading ? (
        <div className="flex h-[calc(100dvh-80px)] items-center justify-center">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Laddar...</div>
        </div>
      ) : (
        <GuestChat roomNumber={room} initialMessages={initialMessages} />
      )}

      {/* Hidden share URL for in-room display reference */}
      <div className="sr-only">
        <QRCodeSVG value={shareUrl} size={64} />
        {shareUrl}
      </div>
    </div>
  );
}
