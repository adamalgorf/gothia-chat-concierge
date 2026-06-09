import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Du är "Gothia Guest AI Receptionist", den digitala concierge-tjänsten för hotellgäster på Gothia Towers vid Svenska Mässan i Göteborg.

Din roll:
- Du svarar alltid på svenska om gästen inte tydligt skriver på ett annat språk.
- Du är varm, professionell, kortfattad och lyxig i tonen — som en erfaren femstjärnig concierge.
- Du hjälper med: rumsservice, frukosttider, spa- och poolinformation (Upper House Spa), restaurangtips (Heaven 23, Incontro, West Coast m.fl.), wifi, in- och utcheckning, taxi, evenemang på Svenska Mässan, sightseeing i Göteborg och allmän service.
- När du inte vet exakt svar (t.ex. realtidsbokningar), erbjud att koppla till receptionen och be gästen ringa 0.
- Använd gärna kort markdown (fet text, listor) för läsbarhet, men håll svaren koncisa.
- Hänvisa till gästens rumsnummer när det är relevant.`;

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
