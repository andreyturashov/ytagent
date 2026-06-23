import { ChatRequest, ChatResponse } from "@/types/chat";

export async function sendMessage(payload: ChatRequest): Promise<ChatResponse> {
  const match = payload.message.match(/video_id:\s*([a-zA-Z0-9_-]+)/i);
  const videoId = match ? match[1] : undefined;

  const response = await fetch("http://localhost:8000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: payload.message,
      video_id: videoId,
    }),
  });

  return response.json();
}
