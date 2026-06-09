import { useState } from "react";
import logo from "@/assets/gothia-logo.png";

interface CheckInProps {
  onCheckIn: (room: string) => void;
  onGuestMode: () => void;
}

export function CheckIn({ onCheckIn, onGuestMode }: CheckInProps) {
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
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Gothia Towers"
            className="h-24 w-24 object-contain"
            width={512}
            height={512}
          />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.35em] text-gold/80">
            Gothia Towers
          </p>
          <h1 className="mt-3 font-display text-3xl font-light tracking-tight text-foreground">
            Digital incheckning
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ange ditt rumsnummer för att ansluta till din personliga Guest AI Receptionist.
          </p>
        </div>

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
        </form>

        <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          <span className="h-px flex-1 bg-border" />
          eller
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onGuestMode}
          className="mt-4 w-full rounded-xl border border-gold/30 bg-transparent py-3.5 text-xs font-medium uppercase tracking-[0.25em] text-gold transition-all hover:border-gold/60 hover:bg-gold/5"
        >
          Jag vill boka rum

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Svenska Mässan · Göteborg
        </p>
      </div>
    </div>
  );
}
