import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const BASE_PROMPT = `Du är Gothia Towers virtuella AI-receptionist. Din roll är att ge service i världsklass, hantera bokningsförfrågningar och proaktivt hjälpa gästen.

DINA RIKTLINJER:

1. BEHOVSANALYS & UPSELL: När en gäst uttrycker intresse för att boka ett rum eller ett bord på någon av våra restauranger (Heaven 23, Upper House Dining), slå inte bara fast ett svar. Ställ 1-2 korta, personliga frågor för att förstå deras behov (t.ex. reser de i arbetet, eller firar de något speciellt under helgen?). Om lämpligt, erbjud proaktivt uppgraderingar till premiumrum i Tower 2 eller att förboka frukost på Upper House.

2. TON: Professionell, exklusiv, välkomnande och effektiv. Svara alltid på samma språk som gästen använder (t.ex. svenska, engelska, spanska).

3. SYSTEMÅTGÄRDER: Du har kännedom om vårt interna driftssystem, Samfex. Du kan ta emot beställningar om städning, extra handdukar samt minibar-påfyllning/konsumtion. När gästen ber om detta, bekräfta artigt att du registrerar det i Samfex.

Använd gärna kort markdown (fet text, listor) för läsbarhet, men håll svaren koncisa.`;

const GUEST_PROMPT = `\n\nLÄGE: PRE-CHECK-IN (gästen har inget rumsnummer ännu).
- Hälsa varmt välkommen till Gothia Towers och fråga hur du kan hjälpa till.
- Du har INTE tillgång till in-house-tjänster (städning, minibar). Erbjud dem inte.
- Om gästen vill boka rum: gör en kort behovsanalys (anledning till resa, datum, antal personer) innan du bekräftar.
- När du har tillräcklig information, anropa verktyget book_hotel_service med service_type "Rumsbokning" och date_time = ankomstdatum (och gärna avresedatum). Vänta INTE på att gästen ska be om bekräftelse.
- Verktyget returnerar ett bokningsnummer (booking_number). Visa detta tydligt i ditt svar i fetstil, t.ex. "**Bokningsnummer: GT-482910**", och tacka gästen.`;

const ROOM_PROMPT = (room: string) => `\n\nLÄGE: IN-HOUSE (gästen är incheckad på rum ${room}).
- Använd alltid rumsnummer ${room} när du anropar verktyg.
- Du har full tillgång till Samfex-verktygen: request_housekeeping och refill_minibar.
- Du kan även boka in-house-tjänster (restaurang, spa, taxi) via book_hotel_service.`;

function generateBookingNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `GT-${n}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: UIMessage[];
          roomNumber?: string;
        };
        const messages = body.messages;
        const raw = body.roomNumber?.trim() ?? "";
        const isGuest = raw === "guest" || raw === "";
        const roomNumber = isGuest ? "guest" : raw;

        if (!Array.isArray(messages) || (!isGuest && !/^[0-9]{2,6}$/.test(roomNumber))) {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Persist user message only for checked-in guests
        if (!isGuest) {
          const last = messages[messages.length - 1];
          if (last?.role === "user") {
            const text = last.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim();
            if (text) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin.from("chat_messages").insert({
                room_number: roomNumber,
                role: "user",
                content: text,
              });
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const saveTransaction = async (input: {
          transaction_type: "WORK_REQUEST" | "DEBITERA_MINIBAR" | "HOTEL_SERVICE";
          details: string;
          items?: Array<Record<string, unknown>>;
          status?: string;
        }) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("guest_transactions")
            .insert({
              room_number: roomNumber,
              transaction_type: input.transaction_type,
              details: input.details,
              items: (input.items ?? []) as unknown as never,
              status: input.status ?? "pending",
            })
            .select("id")
            .single();
          if (error) {
            return { ok: false as const, message: "Kunde inte registrera." };
          }
          return {
            ok: true as const,
            id: data.id,
            transaction_type: input.transaction_type,
            details: input.details,
            items: input.items ?? [],
            confirmation: isGuest ? "Bokning bekräftad" : "Mottaget av hotellet",
          };
        };

        const bookHotelService = tool({
          description: isGuest
            ? "Bekräfta en NY rumsbokning för en gäst som ännu inte checkat in. Kalla detta först när du har samlat in syfte, datum och antal personer."
            : "Boka eller avboka en hotelltjänst – restaurangbord, spa, taxi, frukost, sen utcheckning m.m.",
          inputSchema: z.object({
            room_number: z.string().describe(isGuest ? "Använd 'guest' när gästen inte checkat in" : "Gästens rumsnummer"),
            service_type: z
              .string()
              .describe("Typ av tjänst, t.ex. 'Rumsbokning', 'restaurangbord Heaven 23', 'taxi', 'spa'"),
            date_time: z
              .string()
              .describe("Datum och tid i klartext, t.ex. '2026-06-10 19:30' eller '2026-07-12 till 2026-07-15'"),
          }),
          execute: async ({ service_type, date_time }) => {
            if (isGuest) {
              const bookingNumber = generateBookingNumber();
              const res = await saveTransaction({
                transaction_type: "HOTEL_SERVICE",
                details: `${service_type} – ${date_time} (bokningsnr ${bookingNumber})`,
                items: [{ booking_number: bookingNumber, service_type, date_time }],
                status: "confirmed_booking",
              });
              return res.ok ? { ...res, booking_number: bookingNumber } : res;
            }
            return saveTransaction({
              transaction_type: "HOTEL_SERVICE",
              details: `${service_type} – ${date_time}`,
            });
          },
        });

        const tools: Record<string, ReturnType<typeof tool>> = isGuest
          ? { book_hotel_service: bookHotelService }
          : {
              request_housekeeping: tool({
                description:
                  "Skapa en städ-/felanmälan eller begäran om extra utrustning (handdukar, kuddar, städning, reparation).",
                inputSchema: z.object({
                  room_number: z.string(),
                  details: z.string().describe("Tydlig sammanfattning på svenska"),
                }),
                execute: async ({ details }) =>
                  saveTransaction({ transaction_type: "WORK_REQUEST", details: details as string }),
              }),
              refill_minibar: tool({
                description: "Rapportera minibar-konsumtion eller begär påfyllning.",
                inputSchema: z.object({
                  room_number: z.string(),
                  items: z
                    .array(
                      z.object({
                        name: z.string(),
                        qty: z.number().int().positive(),
                      }),
                    )
                    .min(1),
                }),
                execute: async ({ items }) => {
                  const list = items as Array<{ name: string; qty: number }>;
                  const summary = list.map((it) => `${it.qty}× ${it.name}`).join(", ");
                  return saveTransaction({
                    transaction_type: "DEBITERA_MINIBAR",
                    details: `Minibar: ${summary}`,
                    items: list,
                  });
                },
              }),
              book_hotel_service: bookHotelService,
            };

        const system = BASE_PROMPT + (isGuest ? GUEST_PROMPT : ROOM_PROMPT(roomNumber));

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            if (isGuest) return;
            const text = responseMessage.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim();
            if (!text) return;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("chat_messages").insert({
              room_number: roomNumber,
              role: "assistant",
              content: text,
            });
          },
        });
      },
    },
  },
});
