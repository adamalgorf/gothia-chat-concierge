import { LogOut } from "lucide-react";

interface HeaderProps {
  roomNumber: string;
  onCheckOut: () => void;
  onNavigateHome?: () => void;
}

export function Header({ roomNumber, onCheckOut, onNavigateHome }: HeaderProps) {
  const isGuest = roomNumber === "guest";

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        {/* Wordmark — matches landing page */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="group flex flex-col items-start text-left"
          title="Till startsidan"
        >
          <span className="font-display text-base font-medium tracking-wide text-foreground sm:text-lg">
            GOTHIA <span className="italic text-gold">Towers</span>
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/50 transition-colors group-hover:text-gold/80">
            Digital concierge
          </span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Room / status pill */}
          <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.3em] text-foreground/55 sm:inline">
              {isGuest ? "Status" : "Rum"}
            </span>
            <span className="font-display text-sm tracking-wider text-gold">
              {isGuest ? "Ej incheckad" : roomNumber}
            </span>
          </div>

          {/* Log out — pill, hairline gold */}
          <button
            onClick={onCheckOut}
            className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-foreground/70 backdrop-blur-md transition-all hover:border-gold/50 hover:bg-foreground/10 hover:text-gold active:scale-[0.97]"
            title="Logga ut / byt rum"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em]">
              Logga ut
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
