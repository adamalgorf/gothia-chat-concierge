import { useState } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, KeyRound, LogOut, Smartphone, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-towers.jpg";

const KEY_BASE_URL = "https://key.gothiatowers.app/unlock";

function derivePin(room: string): string {
  const hash = Array.from(room).reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  return String(Math.abs(hash) % 10000).padStart(4, "0");
}

interface CheckInProps {
  storedRoom: string | null;
  onCheckIn: (room: string) => void;
  onGuestMode: () => void;
  onContinue: () => void;
  onCheckOut: () => void;
}

type Mode = "choose" | "checkin" | "checkin-success" | "checkout" | "checkout-confirm" | "booking-payment";

export function CheckIn({ storedRoom, onCheckIn, onGuestMode, onContinue, onCheckOut }: CheckInProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [booking, setBooking] = useState("");
  const [assignedRoom, setAssignedRoom] = useState("");
  const [checkOutRoom, setCheckOutRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = booking.trim();
    if (trimmed.length < 3) {
      setError("Ange ditt bokningsnummer eller efternamn (minst 3 tecken).");
      return;
    }
    setError(null);
    // Assign a room (demo: deterministic from input, floors 10–18)
    const hash = Array.from(trimmed.toLowerCase()).reduce((a, c) => a + c.charCodeAt(0), 0);
    const floor = 10 + (hash % 9);
    const number = String(((hash * 7) % 24) + 1).padStart(2, "0");
    const room = `${floor}${number}`;
    setAssignedRoom(room);
    setMode("checkin-success");
    toast.success(`Incheckad i rum ${room}`, {
      description: "Välkommen till Gothia Towers. Din mobila nyckel är redo.",
    });
  };

  const handleEnterRoom = () => {
    onCheckIn(assignedRoom);
    setMode("choose");
    setBooking("");
    setAssignedRoom("");
  };

  const handleCheckOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = checkOutRoom.trim();
    if (!/^[0-9]{2,6}$/.test(trimmed)) {
      setError("Ange ett giltigt rumsnummer (2–6 siffror).");
      return;
    }
    setError(null);
    setMode("checkout-confirm");
  };

  const handleConfirmCheckOut = () => {
    toast.success(`Utcheckad från rum ${checkOutRoom}`, {
      description: "Tack för din vistelse. Vi ser fram emot att välkomna dig igen.",
    });
    onCheckOut();
    setMode("choose");
    setCheckOutRoom("");
  };

  const handleBookRoom = () => {
    setError(null);
    setMode("booking-payment");
  };

  const handleBookingPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cardNumber.replace(/\s/g, "");
    if (cardName.trim().length < 2) {
      setError("Ange kortinnehavarens namn.");
      return;
    }
    if (!/^[0-9]{13,19}$/.test(digits)) {
      setError("Ange ett giltigt kortnummer (13–19 siffror).");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
      setError("Utgångsdatum måste vara MM/ÅÅ.");
      return;
    }
    if (!/^[0-9]{3,4}$/.test(cardCvc)) {
      setError("CVC måste vara 3–4 siffror.");
      return;
    }
    setError(null);
    toast.success("Betalkort registrerat", {
      description: `Kort ····${digits.slice(-4)} sparat. Concierge hjälper dig att slutföra bokningen.`,
    });
    setMode("choose");
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    onGuestMode();
  };

  const resetToChoose = () => {
    setMode("choose");
    setError(null);
    setBooking("");
    setCheckOutRoom("");
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

          {mode === "choose" && (
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-3">
              {storedRoom && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full bg-gold px-5 py-4 text-left transition-all hover:bg-gold-bright active:scale-[0.98] sm:max-w-[200px]"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold uppercase tracking-wider text-gold-foreground">
                      Fortsätt
                    </span>
                    <span className="text-[10px] font-medium tracking-wider text-gold-foreground/70">
                      Rum {storedRoom}
                    </span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-gold-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              )}

              {!storedRoom && (
                <button
                  type="button"
                  onClick={() => setMode("checkin")}
                  className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full bg-gold px-5 py-4 text-left shadow-[0_10px_40px_-12px_rgba(202,168,99,0.6)] ring-1 ring-gold/40 transition-all hover:bg-gold-bright active:scale-[0.98] sm:max-w-[200px]"
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-gold-foreground" strokeWidth={2} />
                    <span className="text-sm font-semibold uppercase tracking-wider text-gold-foreground">
                      Checka in
                    </span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-gold-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              )}

              {storedRoom && (
                <button
                  type="button"
                  onClick={() => setMode("checkin")}
                  className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full border border-foreground/25 bg-foreground/5 px-5 py-4 text-left backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98] sm:max-w-[200px]"
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-gold" strokeWidth={2} />
                    <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
                      Checka in
                    </span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" />
                </button>
              )}

              <button
                type="button"
                onClick={handleBookRoom}
                className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full border border-foreground/25 bg-foreground/5 px-5 py-4 text-left backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98] sm:max-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-gold" strokeWidth={2} />
                  <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Boka rum
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (storedRoom) setGuestRoomInput(storedRoom);
                  setMode("guestroom");
                }}
                className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full border border-foreground/25 bg-foreground/5 px-5 py-4 text-left backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98] sm:max-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  <DoorOpen className="h-5 w-5 text-gold" strokeWidth={2} />
                  <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Gästrum
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" />
              </button>


              <button
                type="button"
                onClick={() => {
                  setMode("checkout");
                  if (storedRoom) setCheckOutRoom(storedRoom);
                }}
                className="group relative flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-full border border-foreground/25 bg-foreground/5 px-5 py-4 text-left backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98] sm:max-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5 text-gold" strokeWidth={2} />
                  <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Checka ut
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 text-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" />
              </button>
            </div>
          )}

          {mode === "checkin" && (
            <form onSubmit={handleCheckInSubmit} className="mt-10 max-w-md space-y-4">
              <label
                htmlFor="booking"
                className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
              >
                Bokningsnummer eller efternamn
              </label>
              <div className="flex gap-3">
                <input
                  id="booking"
                  type="text"
                  autoFocus
                  value={booking}
                  onChange={(e) => setBooking(e.target.value)}
                  placeholder="GT-48201 / Andersson"
                  className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-6 py-4 font-display text-lg text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-gold px-7 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Checka in
                </button>
              </div>
              <p className="text-xs text-foreground/50">
                Vi tilldelar ditt rum direkt efter incheckning.
              </p>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <button
                type="button"
                onClick={resetToChoose}
                className="text-[11px] uppercase tracking-[0.3em] text-foreground/60 hover:text-gold"
              >
                ← Tillbaka
              </button>
            </form>
          )}

          {mode === "checkin-success" && (() => {
            const pin = derivePin(assignedRoom);
            const keyUrl = `${KEY_BASE_URL}?room=${assignedRoom}&pin=${pin}`;
            return (
              <div className="mt-10 max-w-md space-y-6">
                <div className="rounded-2xl border border-gold/30 bg-foreground/5 p-6 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-gold" strokeWidth={2} />
                    <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                      Incheckning klar
                    </h2>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.3em] text-foreground/50">
                    Ditt rum
                  </p>
                  <p className="font-display text-6xl font-light tracking-tight text-gold">
                    {assignedRoom}
                  </p>
                  <p className="mt-3 text-sm text-foreground/70">
                    Våning {assignedRoom.slice(0, 2)}. Din mobila nyckel är aktiverad nedan.
                  </p>
                </div>

                <div className="rounded-2xl border border-gold/30 bg-foreground/5 p-6 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-6 w-6 text-gold" strokeWidth={2} />
                    <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                      Digital nyckel
                    </h2>
                  </div>
                  <p className="mt-2 text-xs text-foreground/60">
                    Håll QR-koden mot låsläsaren — eller knappa in PIN-koden på dörrpanelen.
                  </p>

                  <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                    <div className="rounded-xl bg-white p-3 shadow-[0_8px_30px_-12px_rgba(202,168,99,0.5)]">
                      <QRCodeSVG
                        value={keyUrl}
                        size={148}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0a0a0a"
                      />
                    </div>
                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                          PIN-kod
                        </p>
                        <p className="font-display text-4xl font-light tracking-[0.4em] text-gold">
                          {pin}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                          Giltig till
                        </p>
                        <p className="text-sm text-foreground/80">
                          Utcheckning kl 11:00
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEnterRoom}
                  className="w-full rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Fortsätt till concierge
                </button>
              </div>
            );
          })()}



          {mode === "checkout" && (
            <form onSubmit={handleCheckOutSubmit} className="mt-10 max-w-md space-y-4">
              <label
                htmlFor="checkout-room"
                className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
              >
                Rumsnummer för utcheckning
              </label>
              <div className="flex gap-3">
                <input
                  id="checkout-room"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={checkOutRoom}
                  onChange={(e) => setCheckOutRoom(e.target.value.replace(/\D/g, ""))}
                  placeholder="1204"
                  className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-6 py-4 font-display text-2xl tracking-[0.3em] text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-gold px-7 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Nästa
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <button
                type="button"
                onClick={resetToChoose}
                className="text-[11px] uppercase tracking-[0.3em] text-foreground/60 hover:text-gold"
              >
                ← Tillbaka
              </button>
            </form>
          )}

          {mode === "checkout-confirm" && (
            <div className="mt-10 max-w-md space-y-6">
              <div className="rounded-2xl border border-gold/30 bg-foreground/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-gold" strokeWidth={2} />
                  <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                    Bekräfta utcheckning
                  </h2>
                </div>
                <p className="mt-3 text-sm text-foreground/70">
                  Är du säker på att du vill checka ut från rum{" "}
                  <span className="font-display font-medium text-gold">{checkOutRoom}</span>?
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  Tack för din vistelse på Gothia Towers. Vi hoppas du haft det bra!
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleConfirmCheckOut}
                  className="flex-1 rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Checka ut
                </button>
                <button
                  type="button"
                  onClick={resetToChoose}
                  className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-7 py-4 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98]"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {mode === "booking-payment" && (
            <form onSubmit={handleBookingPaymentSubmit} className="mt-10 max-w-md space-y-5">
              <div className="rounded-2xl border border-gold/30 bg-foreground/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-gold" strokeWidth={2} />
                  <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                    Betalkort för bokning
                  </h2>
                </div>
                <p className="mt-2 text-xs text-foreground/60">
                  Vi reserverar kortet för att säkra din bokning. Inga pengar dras förrän rummet är bekräftat.
                </p>

                <div className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="card-name" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Kortinnehavare
                    </label>
                    <input
                      id="card-name"
                      type="text"
                      autoComplete="cc-name"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Anna Andersson"
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-base text-foreground placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="card-number" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Kortnummer
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={23}
                      value={cardNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 19);
                        setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
                      }}
                      placeholder="4242 4242 4242 4242"
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 font-display tracking-[0.15em] text-foreground placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="card-expiry" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                        Utgång (MM/ÅÅ)
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                        }}
                        placeholder="07/27"
                        className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-cvc" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Fortsätt till concierge
                </button>
                <button
                  type="button"
                  onClick={resetToChoose}
                  className="flex-1 rounded-full border border-foreground/25 bg-foreground/5 px-7 py-4 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10 active:scale-[0.98]"
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}

          {mode === "guestroom" && (
            <form onSubmit={handleGuestRoomSubmit} className="mt-10 max-w-md space-y-4">
              <div className="flex items-center gap-3">
                <DoorOpen className="h-6 w-6 text-gold" strokeWidth={2} />
                <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                  Chatta från ditt rum
                </h2>
              </div>
              <p className="text-xs text-foreground/60">
                Ange rumsnumret som står på din nyckelkortshållare eller på TV:n. Du får direkt tillgång till
                room service, städning och concierge — utan att checka in på nytt.
              </p>
              <label
                htmlFor="guestroom-number"
                className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
              >
                Rumsnummer
              </label>
              <div className="flex gap-3">
                <input
                  id="guestroom-number"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={guestRoomInput}
                  onChange={(e) => setGuestRoomInput(e.target.value.replace(/\D/g, ""))}
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
              <button
                type="button"
                onClick={resetToChoose}
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
