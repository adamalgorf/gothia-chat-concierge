import logo from "@/assets/gothia-logo.png";

interface HeaderProps {
  roomNumber: string;
  onCheckOut: () => void;
}

export function Header({ roomNumber, onCheckOut }: HeaderProps) {
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

        <button
          onClick={onCheckOut}
          className="group flex items-center gap-2 rounded-full border border-gold/30 bg-surface px-3 py-1.5 transition-colors hover:border-gold/60"
          title="Byt rum / checka ut"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            {roomNumber === "guest" ? "Status" : "Rum"}
          </span>
          <span className="font-display text-sm font-medium tracking-wider text-gold">
            {roomNumber === "guest" ? "Ej incheckad" : roomNumber}
          </span>
        </button>
      </div>
    </header>
  );
}
