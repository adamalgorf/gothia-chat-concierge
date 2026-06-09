export const ROOM_TYPES = [
  { id: "standard", label: "Standard", pricePerNightSek: 1890 },
  { id: "deluxe", label: "Deluxe", pricePerNightSek: 2490 },
  { id: "premium", label: "Tower 2 Premium", pricePerNightSek: 3190 },
  { id: "suite", label: "Svit", pricePerNightSek: 5490 },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]["id"];

export interface BookingQuoteInput {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  roomTypeId: RoomTypeId;
  includeBreakfast: boolean;
}

export interface BookingQuote {
  roomType: (typeof ROOM_TYPES)[number];
  nights: number;
  roomSubtotalSek: number;
  breakfastSubtotalSek: number;
  totalSek: number;
}

export const BREAKFAST_PRICE_PER_GUEST_NIGHT_SEK = 195;
export const DEFAULT_BOOKING_QUOTE_INPUT: BookingQuoteInput = {
  checkIn: "",
  checkOut: "",
  guests: 2,
  rooms: 1,
  roomTypeId: "standard",
  includeBreakfast: true,
};

export function getRoomType(roomTypeId: RoomTypeId) {
  return ROOM_TYPES.find((type) => type.id === roomTypeId) ?? ROOM_TYPES[0];
}

export function formatSek(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diffMs = end.getTime() - start.getTime();

  return diffMs > 0 ? Math.round(diffMs / 86_400_000) : 0;
}

export function calculateBookingQuote(input: BookingQuoteInput): BookingQuote {
  const roomType = getRoomType(input.roomTypeId);
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const roomSubtotalSek = roomType.pricePerNightSek * input.rooms * nights;
  const breakfastSubtotalSek = input.includeBreakfast
    ? BREAKFAST_PRICE_PER_GUEST_NIGHT_SEK * input.guests * nights
    : 0;

  return {
    roomType,
    nights,
    roomSubtotalSek,
    breakfastSubtotalSek,
    totalSek: roomSubtotalSek + breakfastSubtotalSek,
  };
}

export function validateBookingQuoteInput(input: BookingQuoteInput): string | null {
  if (nightsBetween(input.checkIn, input.checkOut) < 1) {
    return "Välj ankomst- och avresedatum. Avresa måste vara efter ankomst.";
  }

  if (input.guests < 1 || input.guests > 8) {
    return "Välj 1-8 gäster.";
  }

  if (input.rooms < 1 || input.rooms > 4) {
    return "Välj 1-4 rum.";
  }

  return null;
}

export function buildBookingConciergePrompt(input: BookingQuoteInput, quote: BookingQuote): string {
  return [
    `Hej! Jag vill boka ${input.rooms} rum (${quote.roomType.label}) för ${input.guests} gäster.`,
    `Datum: ${input.checkIn} till ${input.checkOut}, ${quote.nights} nätter.`,
    `Frukost: ${input.includeBreakfast ? "ja" : "nej"}.`,
    `Visat totalpris före kort: ${formatSek(quote.totalSek)}.`,
  ].join(" ");
}
