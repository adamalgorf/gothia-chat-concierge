import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";
import { createOpenAiProvider } from "@/lib/ai-gateway.server";
import { extractTextFromMessage, saveChatMessage, saveLastUserMessage } from "@/lib/chat/chat-history.server";
import { buildChatSystemPrompt } from "@/lib/chat/chat-prompts";
import { detectInHouseServiceRequest } from "@/lib/chat/service-request-detector";
import { saveGuestTransaction, type TransactionType } from "@/lib/transactions.server";


function generateBookingNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `GT-${n}`;
}

function createTextStreamResponse(text: string): Response {
  const chunks = [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "txt-0" },
    { type: "text-delta", id: "txt-0", delta: text },
    { type: "text-end", id: "txt-0" },
    { type: "finish-step" },
    { type: "finish", finishReason: "stop" },
  ];

  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

async function createAiServiceConfirmationResponse(input: {
  apiKey: string;
  roomNumber: string;
  guestMessage: string;
  registeredDetails: string;
}) {
  const openai = createOpenAiProvider(input.apiKey, process.env.OPENAI_BASE_URL);
  const model = openai(process.env.OPENAI_MODEL ?? "gpt-5.2");
  const result = streamText({
    model,
    system: [
      "Du är Gothia Towers virtuella AI-concierge.",
      "Gästens serviceärende är redan registrerat i hotellets interna system.",
      "Svara varmt, tydligt och professionellt på svenska om gästen skrev svenska, annars på gästens språk.",
      "Bekräfta exakt vad som är registrerat, vilket rum det gäller, och att personalen ser ärendet i internal-vyn.",
      "Lova inte en exakt leveranstid. Säg hellre att personalen tar hand om det så snart som möjligt.",
      "Ställ inte följdfrågor för enkla ärenden som handdukar, kuddar, städning eller enklare service.",
    ].join("\n"),
    prompt: [
      `Rum: ${input.roomNumber}`,
      `Gästens meddelande: ${input.guestMessage}`,
      `Registrerat ärende: ${input.registeredDetails}`,
      "",
      "Skriv en kort men utförlig bekräftelse till gästen.",
    ].join("\n"),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      const text = extractTextFromMessage(responseMessage);
      if (!text) return;
      await saveChatMessage({
        roomNumber: input.roomNumber,
        role: "assistant",
        content: text,
      });
    },
  });
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
          console.warn("[Chat API] Rejected bad chat request", {
            hasMessagesArray: Array.isArray(messages),
            rawRoomNumber: raw,
            resolvedRoomNumber: roomNumber,
            isGuest,
          });
          return new Response("Bad request", { status: 400 });
        }

        console.info("[Chat API] Received chat request", {
          roomNumber,
          isGuest,
          messageCount: messages.length,
          hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
          supabaseUrl: process.env.SUPABASE_URL ?? null,
          hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        });

        const key = process.env.OPENAI_API_KEY;

        if (!isGuest) {
          console.info("[Chat API] Saving latest user chat message", { roomNumber });
          await saveLastUserMessage({ roomNumber, messages });

          const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
          const lastUserText = extractTextFromMessage(lastUserMessage);
          console.info("[Chat API] Checking for deterministic service request", {
            roomNumber,
            messagePreview: lastUserText.slice(0, 160),
          });
          const serviceRequest = detectInHouseServiceRequest({
            text: lastUserText,
            roomNumber,
          });

          if (serviceRequest) {
            console.info("[Chat API] Deterministic service request matched", {
              roomNumber,
              transactionType: serviceRequest.transactionType,
              detailsPreview: serviceRequest.details.slice(0, 160),
            });
            const saved = await saveGuestTransaction({
              roomNumber,
              transactionType: serviceRequest.transactionType,
              details: serviceRequest.details,
              status: "pending",
              confirmation: serviceRequest.confirmation,
            });
            const reply = saved.ok
              ? serviceRequest.confirmation
              : "Jag kunde inte registrera ärendet just nu. Försök igen om en stund.";

            if (saved.ok && key) {
              console.info("[Chat API] Returning AI-written service confirmation", {
                roomNumber,
                transactionType: serviceRequest.transactionType,
              });
              return createAiServiceConfirmationResponse({
                apiKey: key,
                roomNumber,
                guestMessage: lastUserText,
                registeredDetails: serviceRequest.details,
              });
            }

            await saveChatMessage({
              roomNumber,
              role: "assistant",
              content: reply,
            });

            console.info("[Chat API] Returning deterministic service response", {
              roomNumber,
              saved: saved.ok,
            });
            return createTextStreamResponse(reply);
          }

          console.info("[Chat API] No deterministic service request, falling through to AI", { roomNumber });
        }

        if (!key) {
          console.warn("[Chat API] Missing OPENAI_API_KEY for non-deterministic chat request", {
            roomNumber,
            isGuest,
          });
          return new Response("AI concierge saknar OPENAI_API_KEY. Lägg till nyckeln i .env och starta om Docker.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
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
