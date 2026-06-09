import type { UIMessage } from "ai";

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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("chat_messages").insert({
    room_number: input.roomNumber,
    role: input.role,
    content: input.content,
  });
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
