import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";
import { createOpenAiProvider } from "@/lib/ai-gateway.server";
import { extractTextFromMessage, saveChatMessage, saveLastUserMessage } from "@/lib/chat/chat-history.server";
import { buildChatSystemPrompt } from "@/lib/chat/chat-prompts";
import { saveGuestTransaction, type TransactionType } from "@/lib/transactions.server";


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

        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          return new Response("AI concierge saknar OPENAI_API_KEY. Lägg till nyckeln i .env och starta om Docker.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        if (!isGuest) {
          await saveLastUserMessage({ roomNumber, messages });
        }

        const openai = createOpenAiProvider(key, process.env.OPENAI_BASE_URL);
        const model = openai(process.env.OPENAI_MODEL ?? "gpt-5.2");

        const saveTransaction = async (input: {
          transaction_type: TransactionType;
          details: string;
          items?: Array<Record<string, unknown>>;
          status?: string;
        }) =>
          saveGuestTransaction({
            roomNumber,
            transactionType: input.transaction_type,
            details: input.details,
            items: input.items,
            status: input.status,
            confirmation: isGuest ? "Bokning bekräftad" : "Mottaget av hotellet",
          });

        const bookHotelService = tool({
          description: isGuest
            ? "Bekräfta en NY rumsbokning. Kalla detta först när gästen har sett och godkänt sammanfattning med antal rum, pris per natt, tillval och totalpris, och du har samlat in: syfte, datum (ankomst+avresa), antal gäster, samt bokarens namn, e-post och telefon."
            : "Boka eller avboka en hotelltjänst – restaurangbord, spa, taxi, frukost, sen utcheckning m.m.",
          inputSchema: z.object({
            room_number: z.string().describe(isGuest ? "Använd 'guest' när gästen inte checkat in" : "Gästens rumsnummer"),
            service_type: z
              .string()
              .describe("Typ av tjänst, t.ex. 'Rumsbokning', 'restaurangbord Heaven 23', 'taxi', 'spa'"),
            date_time: z
              .string()
              .describe("Datum och tid i klartext, t.ex. '2026-06-10 19:30' eller '2026-07-12 till 2026-07-15'"),
            guest_name: z.string().optional().describe("Bokarens fullständiga namn (obligatoriskt vid rumsbokning pre-check-in)"),
            guest_email: z.string().optional().describe("Bokarens e-postadress (obligatoriskt vid rumsbokning pre-check-in)"),
            guest_phone: z.string().optional().describe("Bokarens mobilnummer (obligatoriskt vid rumsbokning pre-check-in)"),
            guest_count: z.number().int().positive().optional().describe("Antal gäster"),
            purpose: z.string().optional().describe("Syftet med resan"),
          }),
          execute: async ({ service_type, date_time, guest_name, guest_email, guest_phone, guest_count, purpose }) => {
            if (isGuest) {
              const bookingNumber = generateBookingNumber();
              const summary = [
                `${service_type} – ${date_time}`,
                guest_name && `Bokare: ${guest_name}`,
                guest_email && `E-post: ${guest_email}`,
                guest_phone && `Tel: ${guest_phone}`,
                guest_count && `Antal: ${guest_count}`,
                purpose && `Syfte: ${purpose}`,
                `Bokningsnr: ${bookingNumber}`,
              ]
                .filter(Boolean)
                .join(" · ");
              const res = await saveTransaction({
                transaction_type: "HOTEL_SERVICE",
                details: summary,
                items: [
                  {
                    booking_number: bookingNumber,
                    service_type,
                    date_time,
                    guest_name,
                    guest_email,
                    guest_phone,
                    guest_count,
                    purpose,
                  },
                ],
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

        const tools: ToolSet = isGuest
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
              order_room_service: tool({
                description:
                  "Lägg en room service-beställning (mat eller dryck levereras till rummet). Använd menyn i systeminstruktionerna och bekräfta varje rad med gästen innan anrop.",
                inputSchema: z.object({
                  room_number: z.string(),
                  items: z
                    .array(
                      z.object({
                        name: z.string().describe("Rättens/dryckens namn enligt menyn"),
                        qty: z.number().int().positive(),
                        price_sek: z.number().int().nonnegative().describe("Pris per styck i SEK enligt menyn"),
                      }),
                    )
                    .min(1),
                  notes: z.string().optional().describe("Allergier, specialönskemål, önskad leveranstid"),
                }),
                execute: async ({ items, notes }) => {
                  const list = items as Array<{ name: string; qty: number; price_sek: number }>;
                  const total = list.reduce((s, it) => s + it.qty * it.price_sek, 0);
                  const summary = list.map((it) => `${it.qty}× ${it.name}`).join(", ");
                  const details = `Room service: ${summary} · ${total} kr${notes ? ` · ${notes}` : ""}`;
                  return saveTransaction({
                    transaction_type: "HOTEL_SERVICE",
                    details,
                    items: [...list, { total_sek: total, notes: notes ?? null }],
                    status: "kitchen_received",
                  });
                },
              }),
              book_hotel_service: bookHotelService,
            };


        const system = buildChatSystemPrompt({ isGuest, roomNumber });

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
            const text = extractTextFromMessage(responseMessage);
            if (!text) return;
            await saveChatMessage({
              roomNumber,
              role: "assistant",
              content: text,
            });
          },
        });
      },
    },
  },
});
