import { LogOut } from "lucide-react";
import logo from "@/assets/gothia-logo.png";

interface HeaderProps {
  roomNumber: string;
  onCheckOut: () => void;
}

export function Header({ roomNumber, onCheckOut }: HeaderProps) {
  const isGuest = roomNumber === "guest";

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Gothia Towers"
            className="h-9 w-9 object-contain"
            width={512}
            height={512}
          />
          <div className="leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold/80">
              Gothia Towers
            </p>
            <p className="font-display text-sm text-foreground">Guest AI Receptionist</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Room / status badge */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {isGuest ? "Status" : "Rum"}
            </span>
            <span className="font-display text-sm font-medium tracking-wider text-gold">
              {isGuest ? "Ej incheckad" : roomNumber}
            </span>
          </div>

          {/* Log out button */}
          <button
            onClick={onCheckOut}
            className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-gold transition-all hover:bg-gold/20 active:scale-[0.97]"
            title="Logga ut / byt rum"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
              Logga ut
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
