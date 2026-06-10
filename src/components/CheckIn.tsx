import { useState } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, KeyRound, LogOut, Smartphone, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveGuestProfile, checkOutGuest } from "@/lib/guests.functions";
import {
  BREAKFAST_PRICE_PER_GUEST_NIGHT_SEK,
  DEFAULT_BOOKING_QUOTE_INPUT,
  ROOM_TYPES,
  buildBookingConciergePrompt,
  calculateBookingQuote,
  formatSek,
  validateBookingQuoteInput,
  type RoomTypeId,
} from "@/lib/booking/booking-pricing";
import {
  deriveRoomPin,
  formatCardExpiryInput,
  formatCardNumberInput,
  normalizeCardNumber,
  resolveCheckInRoom,
  validateCheckInForm,
  validatePaymentCard,
  validateRoomNumber,
} from "@/lib/check-in/check-in-flow";
import heroImage from "@/assets/hero-towers.jpg";

const KEY_BASE_URL = "https://key.gothiatowers.app/unlock";

interface CheckInProps {
  storedRoom: string | null;
  onCheckIn: (room: string) => void;
  onGuestMode: (prompt?: string) => void;
  onContinue: () => void;
  onCheckOut: () => void;
}

type Mode = "choose" | "checkin" | "checkin-success" | "checkout" | "checkout-confirm" | "booking-details" | "booking-payment";

export function CheckIn({ storedRoom, onCheckIn, onGuestMode, onContinue, onCheckOut }: CheckInProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [booking, setBooking] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [assignedRoom, setAssignedRoom] = useState("");
  const [checkOutRoom, setCheckOutRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [bookingQuoteInput, setBookingQuoteInput] = useState(DEFAULT_BOOKING_QUOTE_INPUT);

  const saveProfileFn = useServerFn(saveGuestProfile);
  const checkOutFn = useServerFn(checkOutGuest);
  const bookingQuote = calculateBookingQuote(bookingQuoteInput);

  const updateBookingQuoteInput = <Key extends keyof typeof bookingQuoteInput>(
    key: Key,
    value: (typeof bookingQuoteInput)[Key],
  ) => {
    setError(null);
    setBookingQuoteInput((current) => ({ ...current, [key]: value }));
  };

  const resetBookingQuoteInput = () => {
    setBookingQuoteInput(DEFAULT_BOOKING_QUOTE_INPUT);
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBooking = booking.trim();
    const trimmedName = guestName.trim();
    const trimmedEmail = guestEmail.trim();
    const trimmedPhone = guestPhone.trim();

    const validationError = validateCheckInForm({
      roomOrBookingReference: trimmedBooking,
      guestName: trimmedName,
      guestEmail: trimmedEmail,
      guestPhone: trimmedPhone,
    });

    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    const room = resolveCheckInRoom(trimmedBooking);

    setIsSaving(true);
    try {
      await saveProfileFn({
        data: {
          room_number: room,
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          booking_reference: trimmedBooking,
        },
      });
      setAssignedRoom(room);
      setMode("checkin-success");
      toast.success(`Incheckad i rum ${room}`, {
        description: "Välkommen till Gothia Towers. Din mobila nyckel är redo.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara incheckningen.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnterRoom = () => {
    onCheckIn(assignedRoom);
    setMode("choose");
    setBooking("");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setAssignedRoom("");
  };

  const handleCheckOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = checkOutRoom.trim();
    const validationError = validateRoomNumber(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setMode("checkout-confirm");
  };

  const handleConfirmCheckOut = async () => {
    try {
      await checkOutFn({ data: { room_number: checkOutRoom } });
    } catch {
      // Non-blocking: still complete the UI flow even if record cleanup fails.
    }
    toast.success(`Utcheckad från rum ${checkOutRoom}`, {
      description: "Tack för din vistelse. Vi ser fram emot att välkomna dig igen.",
    });
    onCheckOut();
    setMode("choose");
    setCheckOutRoom("");
  };

  const handleBookRoom = () => {
    setError(null);
    setMode("booking-details");
  };

  const handleBookingDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateBookingQuoteInput(bookingQuoteInput);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setMode("booking-payment");
  };


  const handleBookingPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePaymentCard({ cardName, cardNumber, cardExpiry, cardCvc });
    if (validationError) {
      setError(validationError);
      return;
    }
    const digits = normalizeCardNumber(cardNumber);
    setError(null);
    toast.success("Betalkort registrerat", {
      description: `Kort ····${digits.slice(-4)} sparat. Concierge hjälper dig att slutföra bokningen.`,
    });
    setMode("choose");
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    resetBookingQuoteInput();
    onGuestMode(buildBookingConciergePrompt(bookingQuoteInput, bookingQuote));
  };

  const resetToChoose = () => {
    setMode("choose");
    setError(null);
    setBooking("");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setCheckOutRoom("");
    resetBookingQuoteInput();
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
            <form onSubmit={handleCheckInSubmit} className="mt-10 max-w-md space-y-5">
              <div>
                <label
                  htmlFor="booking"
                  className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60"
                >
                  Rumsnummer eller bokningsnummer
                </label>
                <input
                  id="booking"
                  type="text"
                  autoFocus
                  value={booking}
                  onChange={(e) => {
                    setError(null);
                    setBooking(e.target.value);
                  }}
                  placeholder="1204 / GT-48201"
                  className="mt-2 w-full rounded-xl border border-foreground/25 bg-foreground/5 px-5 py-3.5 font-display text-base text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="guest-name" className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60">
                    Fullständigt namn
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    autoComplete="name"
                    value={guestName}
                    onChange={(e) => {
                      setError(null);
                      setGuestName(e.target.value);
                    }}
                    placeholder="Anna Andersson"
                    className="mt-2 w-full rounded-xl border border-foreground/25 bg-foreground/5 px-5 py-3.5 text-base text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="guest-email" className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60">
                    E-post
                  </label>
                  <input
                    id="guest-email"
                    type="email"
                    autoComplete="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setError(null);
                      setGuestEmail(e.target.value);
                    }}
                    placeholder="anna@exempel.se"
                    className="mt-2 w-full rounded-xl border border-foreground/25 bg-foreground/5 px-5 py-3.5 text-base text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="guest-phone" className="block text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/60">
                    Telefon
                  </label>
                  <input
                    id="guest-phone"
                    type="tel"
                    autoComplete="tel"
                    value={guestPhone}
                    onChange={(e) => {
                      setError(null);
                      setGuestPhone(e.target.value);
                    }}
                    placeholder="+46 70 123 45 67"
                    className="mt-2 w-full rounded-xl border border-foreground/25 bg-foreground/5 px-5 py-3.5 text-base text-foreground backdrop-blur-md placeholder:text-foreground/30 focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-xs text-foreground/50">
                Dina uppgifter kopplas till ditt rum så vår personal kan hjälpa dig snabbare.
              </p>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98] disabled:opacity-60"
                >
                  {isSaving ? "Checkar in..." : "Checka in"}
                </button>
                <button
                  type="button"
                  onClick={resetToChoose}
                  className="rounded-full border border-foreground/25 bg-foreground/5 px-7 py-4 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur-md transition-all hover:border-gold/60 hover:bg-foreground/10"
                >
                  ← Tillbaka
                </button>
              </div>
            </form>
          )}

          {mode === "checkin-success" && (() => {
            const pin = deriveRoomPin(assignedRoom);
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
                  onChange={(e) => {
                    setError(null);
                    setCheckOutRoom(e.target.value.replace(/\D/g, ""));
                  }}
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

          {mode === "booking-details" && (
            <form onSubmit={handleBookingDetailsSubmit} className="mt-10 max-w-xl space-y-5">
              <div className="rounded-2xl border border-gold/30 bg-foreground/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-gold" strokeWidth={2} />
                  <h2 className="font-display text-lg font-medium tracking-wide text-foreground">
                    Boka rum
                  </h2>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="booking-check-in" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Ankomst
                    </label>
                    <input
                      id="booking-check-in"
                      type="date"
                      value={bookingQuoteInput.checkIn}
                      onChange={(e) => updateBookingQuoteInput("checkIn", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-check-out" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Avresa
                    </label>
                    <input
                      id="booking-check-out"
                      type="date"
                      value={bookingQuoteInput.checkOut}
                      onChange={(e) => updateBookingQuoteInput("checkOut", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-guests" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Gäster
                    </label>
                    <input
                      id="booking-guests"
                      type="number"
                      min={1}
                      max={8}
                      value={bookingQuoteInput.guests}
                      onChange={(e) => updateBookingQuoteInput("guests", Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-rooms" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Antal rum
                    </label>
                    <input
                      id="booking-rooms"
                      type="number"
                      min={1}
                      max={4}
                      value={bookingQuoteInput.rooms}
                      onChange={(e) => updateBookingQuoteInput("rooms", Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="booking-room-type" className="block text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
                      Rumstyp
                    </label>
                    <select
                      id="booking-room-type"
                      value={bookingQuoteInput.roomTypeId}
                      onChange={(e) => updateBookingQuoteInput("roomTypeId", e.target.value as RoomTypeId)}
                      className="mt-1 w-full rounded-xl border border-foreground/25 bg-background/40 px-4 py-3 text-foreground focus:border-gold focus:outline-none"
                    >
                      {ROOM_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label} - från {formatSek(type.pricePerNightSek)} / natt
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="mt-5 flex items-center gap-3 text-sm text-foreground/75">
                  <input
                    type="checkbox"
                    checked={bookingQuoteInput.includeBreakfast}
                    onChange={(e) => updateBookingQuoteInput("includeBreakfast", e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  Lägg till frukost, {formatSek(BREAKFAST_PRICE_PER_GUEST_NIGHT_SEK)} per gäst och natt
                </label>

                <div className="mt-6 space-y-2 border-t border-foreground/15 pt-5 text-sm text-foreground/75">
                  <div className="flex justify-between gap-4">
                    <span>
                      {bookingQuote.roomType.label} · {bookingQuoteInput.rooms} rum · {bookingQuote.nights || 0} nätter
                    </span>
                    <span className="text-foreground">{formatSek(bookingQuote.roomSubtotalSek)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Frukost</span>
                    <span className="text-foreground">{formatSek(bookingQuote.breakfastSubtotalSek)}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-3 font-display text-2xl text-gold">
                    <span>Totalt</span>
                    <span>{formatSek(bookingQuote.totalSek)}</span>
                  </div>
                  <p className="text-xs text-foreground/50">
                    Kortuppgifter efterfrågas först i nästa steg, efter att du sett rum, antal och totalpris.
                  </p>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-wider text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.98]"
                >
                  Fortsätt till kort
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

                <div className="mt-5 rounded-xl border border-foreground/15 bg-background/35 p-4 text-sm text-foreground/75">
                  <div className="flex justify-between gap-4">
                    <span>{bookingQuoteInput.rooms} rum · {bookingQuoteInput.guests} gäster · {bookingQuote.nights} nätter</span>
                    <span className="text-gold">{formatSek(bookingQuote.totalSek)}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/50">
                    {bookingQuote.roomType.label}, {bookingQuoteInput.checkIn} till {bookingQuoteInput.checkOut}
                  </p>
                </div>

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
                      onChange={(e) => {
                        setError(null);
                        setCardName(e.target.value);
                      }}
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
                        setError(null);
                        setCardNumber(formatCardNumberInput(e.target.value));
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
                          setError(null);
                          setCardExpiry(formatCardExpiryInput(e.target.value));
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
                        onChange={(e) => {
                          setError(null);
                          setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
                        }}
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


        </div>

      </main>
    </div>
  );
}
