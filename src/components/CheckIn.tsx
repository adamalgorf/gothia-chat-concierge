import { useState } from "react";
import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import logo from "@/assets/gothia-logo.png";

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
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Gothia Towers"
            className="h-20 w-20 object-contain"
            width={512}
            height={512}
          />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.35em] text-gold/80">
            Gothia Towers
          </p>
          <h1 className="mt-3 font-display text-3xl font-light tracking-tight text-foreground">
            Välkommen
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Hur vill du börja din upplevelse hos oss?
          </p>
        </div>

        {mode === "choose" ? (
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("room")}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:border-gold/50 hover:bg-surface-elevated sm:flex-col sm:items-start sm:gap-3 sm:p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold sm:h-11 sm:w-11">
                <KeyRound className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  Jag har redan ett rum
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Logga in med rumsnummer
                </div>
              </div>
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-gold sm:block" />
            </button>

            <button
              type="button"
              onClick={onGuestMode}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:border-gold/50 hover:bg-surface-elevated sm:flex-col sm:items-start sm:gap-3 sm:p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold sm:h-11 sm:w-11">
                <Sparkles className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  Jag vill boka rum
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Utforska & chatta med AI
                </div>
              </div>
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-gold sm:block" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-4">
            <div>
              <label
                htmlFor="room"
                className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground"
              >
                Rumsnummer
              </label>
              <input
                id="room"
                type="text"
                inputMode="numeric"
                autoFocus
                value={room}
                onChange={(e) => setRoom(e.target.value.replace(/\D/g, ""))}
                placeholder="t.ex. 1204"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-5 py-4 text-center font-display text-2xl tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              {error && (
                <p className="mt-2 text-center text-xs text-destructive">{error}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gold py-4 text-sm font-medium uppercase tracking-[0.25em] text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
            >
              Checka in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError(null);
                setRoom("");
              }}
              className="w-full text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70 hover:text-gold"
            >
              ← Tillbaka
            </button>
          </form>
        )}

        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Svenska Mässan · Göteborg
        </p>
      </div>
    </div>
  );
}
