import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Du är Gothia Towers virtuella AI-receptionist. Din roll är att ge service i världsklass, hantera bokningsförfrågningar och proaktivt hjälpa gästen.

DINA RIKTLINJER:

1. BEHOVSANALYS & UPSELL: När en gäst uttrycker intresse för att boka ett rum eller ett bord på någon av våra restauranger (Heaven 23, Upper House Dining), slå inte bara fast ett svar. Ställ 1-2 korta, personliga frågor för att förstå deras behov (t.ex. reser de i arbetet, eller firar de något speciellt under helgen?). Om lämpligt, erbjud proaktivt uppgraderingar till premiumrum i Tower 2 eller att förboka frukost på Upper House.

2. TON: Professionell, exklusiv, välkomnande och effektiv. Svara alltid på samma språk som gästen använder (t.ex. svenska, engelska, spanska).

3. SYSTEMÅTGÄRDER: Du har kännedom om vårt interna driftssystem, Samfex. Du kan ta emot beställningar om städning, extra handdukar samt minibar-påfyllning/konsumtion. När gästen ber om detta, bekräfta artigt att du registrerar det i Samfex.

Använd gärna kort markdown (fet text, listor) för läsbarhet, men håll svaren koncisa.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: UIMessage[];
          roomNumber?: string;
        };
        const messages = body.messages;
        const roomNumber = body.roomNumber?.trim();

        if (!Array.isArray(messages) || !roomNumber || !/^[0-9]{2,6}$/.test(roomNumber)) {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Persist the latest user message (last in array) before streaming
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

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const saveTransaction = async (input: {
          transaction_type: "WORK_REQUEST" | "DEBITERA_MINIBAR" | "HOTEL_SERVICE";
          details: string;
          items?: Array<Record<string, unknown>>;
        }) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("guest_transactions")
            .insert({
              room_number: roomNumber,
              transaction_type: input.transaction_type,
              details: input.details,
              items: (input.items ?? []) as unknown as never,
              status: "pending",
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
            confirmation: "Mottaget av hotellet",
          };
        };

        const tools = {
          request_housekeeping: tool({
            description:
              "Skapa en städ-/felanmälan eller begäran om extra utrustning (handdukar, kuddar, städning, reparation). Använd när gästen ber om något som rör städning eller rummets skick.",
            inputSchema: z.object({
              room_number: z.string().describe("Gästens rumsnummer"),
              details: z
                .string()
                .describe("Tydlig sammanfattning på svenska av vad gästen önskar"),
            }),
            execute: async ({ details }) =>
              saveTransaction({ transaction_type: "WORK_REQUEST", details }),
          }),
          refill_minibar: tool({
            description:
              "Rapportera minibar-konsumtion eller begär påfyllning. Items beskriver vad som ska påfyllas eller debiteras.",
            inputSchema: z.object({
              room_number: z.string(),
              items: z
                .array(
                  z.object({
                    name: z.string().describe("Produktnamn, t.ex. 'Coca-Cola'"),
                    qty: z.number().int().positive().describe("Antal"),
                  }),
                )
                .min(1),
            }),
            execute: async ({ items }) => {
              const summary = items
                .map((it) => `${it.qty}× ${it.name}`)
                .join(", ");
              return saveTransaction({
                transaction_type: "DEBITERA_MINIBAR",
                details: `Minibar: ${summary}`,
                items,
              });
            },
          }),
          book_hotel_service: tool({
            description:
              "Boka eller avboka en hotelltjänst – restaurangbord, spa, taxi, frukost, sen utcheckning m.m.",
            inputSchema: z.object({
              room_number: z.string(),
              service_type: z
                .string()
                .describe("Typ av tjänst, t.ex. 'restaurangbord Heaven 23', 'taxi', 'spa'"),
              date_time: z
                .string()
                .describe("Datum och tid i klartext, t.ex. '2026-06-10 19:30'"),
            }),
            execute: async ({ service_type, date_time }) =>
              saveTransaction({
                transaction_type: "HOTEL_SERVICE",
                details: `${service_type} – ${date_time}`,
              }),
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM_PROMPT + `\n\nGästens rumsnummer: ${roomNumber}. Använd alltid detta rumsnummer när du anropar verktyg.`,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
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
