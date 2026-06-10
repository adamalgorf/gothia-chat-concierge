import type { TransactionType } from "@/lib/transactions.server";

export interface DetectedServiceRequest {
  transactionType: TransactionType;
  details: string;
  confirmation: string;
}

const HOUSEKEEPING_PATTERNS = [
  /handduk/i,
  /kudd/i,
  /täcke/i,
  /t[aä]cke/i,
  /lakan/i,
  /st[aä]d/i,
  /toalettpapper/i,
  /tv[åa]l/i,
  /schampo/i,
  /trasig/i,
  /felanm[aä]l/i,
  /fungerar inte/i,
  /l[äa]cker/i,
  /stopp i/i,
  /service[aä]rende/i,
  /skapa.*[aä]rende/i,
  /registrera.*[aä]rende/i,
];

const MINIBAR_PATTERNS = [
  /minibar/i,
  /mini-bar/i,
];

function normalizeDetails(text: string, roomNumber: string): string {
  const cleanText = text.replace(/\s+/g, " ").trim();
  return cleanText.toLowerCase().includes(`rum ${roomNumber}`)
    ? cleanText
    : `Rum ${roomNumber}: ${cleanText}`;
}

export function detectInHouseServiceRequest(input: {
  text: string;
  roomNumber: string;
}): DetectedServiceRequest | null {
  const text = input.text.trim();
  if (!text) return null;

  if (MINIBAR_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      transactionType: "DEBITERA_MINIBAR",
      details: normalizeDetails(text, input.roomNumber),
      confirmation: "Jag har registrerat minibarärendet för rummet. Personalen ser det i internal-vyn.",
    };
  }

  if (HOUSEKEEPING_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      transactionType: "WORK_REQUEST",
      details: normalizeDetails(text, input.roomNumber),
      confirmation: "Jag har skapat ett serviceärende för rummet. Personalen ser det i internal-vyn.",
    };
  }

  return null;
}
