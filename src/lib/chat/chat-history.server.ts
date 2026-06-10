import type { UIMessage } from "ai";
import { ensureCoreHotelSchema, postgres } from "@/lib/db/postgres.server";

export function extractTextFromMessage(message: UIMessage | undefined): string {
  if (!message) return "";

  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export async function saveChatMessage(input: {
  roomNumber: string;
  role: "user" | "assistant";
  content: string;
}) {
  if (!input.content.trim()) return;

  try {
    await ensureCoreHotelSchema();
    const sql = postgres();
    await sql`
      INSERT INTO public.chat_messages (room_number, role, content)
      VALUES (${input.roomNumber}, ${input.role}, ${input.content})
    `;

    console.info("[ChatHistory] Saved chat message", {
      roomNumber: input.roomNumber,
      role: input.role,
    });
  } catch (error) {
    console.error("[ChatHistory] Failed to save chat message", {
      roomNumber: input.roomNumber,
      role: input.role,
      error,
    });
  }
}

export async function saveLastUserMessage(input: { roomNumber: string; messages: UIMessage[] }) {
  const lastMessage = input.messages[input.messages.length - 1];
  if (lastMessage?.role !== "user") return;

  await saveChatMessage({
    roomNumber: input.roomNumber,
    role: "user",
    content: extractTextFromMessage(lastMessage),
  });
}
