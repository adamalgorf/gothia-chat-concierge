import { LogOut, QrCode } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface HeaderProps {
  roomNumber: string;
  onCheckOut: () => void;
  onNavigateHome?: () => void;
}

export function Header({ roomNumber, onCheckOut, onNavigateHome }: HeaderProps) {
  const isGuest = roomNumber === "guest";
  const [qrOpen, setQrOpen] = useState(false);

  const chatUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/gastrum?room=${roomNumber}`
      : `/gastrum?room=${roomNumber}`;

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

          {/* QR — only when checked in */}
          {!isGuest && (
            <button
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-foreground/70 backdrop-blur-md transition-all hover:border-gold/50 hover:bg-foreground/10 hover:text-gold active:scale-[0.97]"
              title="Visa QR-kod för rummet"
            >
              <QrCode className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.3em] sm:inline">
                QR
              </span>
            </button>
          )}

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

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm border-gold/30 bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-light tracking-wide">
              Concierge i rum <span className="text-gold">{roomNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground/60">
              Skanna QR-koden — finns på skrivbordet och på TV:n i rummet — för att öppna chatten direkt på din mobil.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl bg-white p-4 shadow-[0_8px_30px_-12px_rgba(202,168,99,0.5)]">
              <QRCodeSVG value={chatUrl} size={208} level="M" bgColor="#ffffff" fgColor="#0a0a0a" />
            </div>
            <p className="text-center text-[10px] uppercase tracking-[0.3em] text-foreground/50 break-all">
              {chatUrl}
            </p>
            <p className="text-center text-xs text-foreground/70">
              Beställ room service, frukost, städning eller boka spa — direkt från sängen.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
