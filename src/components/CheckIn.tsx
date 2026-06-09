import { useState } from "react";
import { ArrowUpRight, KeyRound, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-towers.jpg";

interface CheckInProps {
  onCheckIn: (room: string) => void;
  onGuestMode: () => void;
}

export function CheckIn({ onCheckIn, onGuestMode }: CheckInProps) {
  const [mode, setMode] = useState<"choose" | "room">("choose");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = room.trim();
    if (!/^[0-9]{2,6}$/.test(trimmed)) {
      setError("Ange ett giltigt rumsnummer (2–6 siffror).");
      return;
    }
    setError(null);
    onCheckIn(trimmed);
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-background">
      {/* Hero image */}
      <img
        src={heroImage}
        alt="Gothia Towers vid solnedgång över Göteborg"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Gradient overlays for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <div className="font-display text-lg font-medium tracking-wide text-foreground sm:text-xl">
          GOTHIA <span className="text-gold">TOWERS</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/70 sm:text-xs">
          Svenska Mässan · Göteborg
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex min-h-[calc(100dvh-96px)] items-end px-6 pb-12 sm:items-center sm:px-12 sm:pb-20 lg:px-20">
        <div className="w-full max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">
            Digital concierge
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[0.95] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Välkommen till <br />
            <span className="italic text-gold">en högre</span> våning.
          </h1>
          <p className="mt-6 max-w-md text-base text-foreground/75 sm:text-lg">
            Hotell, spa och möten mitt i Göteborg. Din vistelse börjar här.
          </p>

          {mode === "choose" ? (
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={() => setMode("room")}
                className="group relative flex flex-1 items-center justify-between gap-4 overflow-hidden rounded-full bg-gold px-7 py-5 text-left transition-all hover:bg-gold-bright active:scale-[0.98] sm:max-w-xs"
              >
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-gold-foreground" strokeWidth={2} />
                  <span className="text-sm font-semibold uppercase tracking-wider text-gold-foreground">
                    Checka in
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gold-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>

              <button
                type="button"
                onClick={onGuestMode}
                className="group relative flex flex-1 items-center justify-between gap-4 overflow-hidden rounded-full border border-foreground/25 bg-foreground/5 px-7 py-5 text-left backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98] sm:max-w-xs"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-gold" strokeWidth={2} />
                  <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Boka rum
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 max-w-md space-y-4">
              <label
                htmlFor="room"
                className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
              >
                Rumsnummer
              </label>
              <div className="flex gap-3">
                <input
                  id="room"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={room}
                  onChange={(e) => setRoom(e.target.value.replace(/\D/g, ""))}
                  placeholder="1204"
                  className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-6 py-4 font-display text-2xl tracking-[0.3em] text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-gold px-7 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Logga in
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode("choose");
                  setError(null);
                  setRoom("");
                }}
                className="text-[11px] uppercase tracking-[0.3em] text-foreground/60 hover:text-gold"
              >
                ← Tillbaka
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
