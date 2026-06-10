export interface CheckInFormInput {
  roomOrBookingReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
}

export interface PaymentCardInput {
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}

export function deriveRoomPin(roomNumber: string): string {
  const hash = Array.from(roomNumber).reduce((total, char) => total * 31 + char.charCodeAt(0), 7);
  return String(Math.abs(hash) % 10000).padStart(4, "0");
}

export function assignDemoRoom(bookingReference: string): string {
  const hash = Array.from(bookingReference.toLowerCase()).reduce((total, char) => total + char.charCodeAt(0), 0);
  const floor = 10 + (hash % 9);
  const number = String(((hash * 7) % 24) + 1).padStart(2, "0");

  return `${floor}${number}`;
}

export function resolveCheckInRoom(roomOrBookingReference: string): string {
  return /^[0-9]{2,6}$/.test(roomOrBookingReference)
    ? roomOrBookingReference
    : assignDemoRoom(roomOrBookingReference);
}

export function validateCheckInForm(input: CheckInFormInput): string | null {
  const isRoomNumber = /^[0-9]{2,6}$/.test(input.roomOrBookingReference);
  const isBookingReference = /^(?=.*[0-9])[A-Za-z0-9-]{3,64}$/.test(input.roomOrBookingReference);

  if (!isRoomNumber && !isBookingReference) {
    return "Ange rumsnummer (2–6 siffror) eller bokningsnummer.";
  }

  if (input.guestName.length < 2) {
    return "Ange för- och efternamn.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.guestEmail)) {
    return "Ange en giltig e-postadress.";
  }

  if (!/^[0-9+()\-\s]{6,32}$/.test(input.guestPhone)) {
    return "Ange ett giltigt telefonnummer.";
  }

  return null;
}

export function validateRoomNumber(roomNumber: string): string | null {
  return /^[0-9]{2,6}$/.test(roomNumber) ? null : "Ange ett giltigt rumsnummer (2–6 siffror).";
}

export function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s/g, "");
}

export function formatCardNumberInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

export function formatCardExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function validatePaymentCard(input: PaymentCardInput): string | null {
  const digits = normalizeCardNumber(input.cardNumber);

  if (input.cardName.trim().length < 2) {
    return "Ange kortinnehavarens namn.";
  }

  if (!/^[0-9]{13,19}$/.test(digits)) {
    return "Ange ett giltigt kortnummer (13–19 siffror).";
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(input.cardExpiry)) {
    return "Utgångsdatum måste vara MM/ÅÅ.";
  }

  if (!/^[0-9]{3,4}$/.test(input.cardCvc)) {
    return "CVC måste vara 3–4 siffror.";
  }

  return null;
}
