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

        const result = streamText({
          model,
          system: SYSTEM_PROMPT.replace("{ROOM}", roomNumber) +
            `\n\nGästens rumsnummer: ${roomNumber}.`,
          messages: await convertToModelMessages(messages),
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
