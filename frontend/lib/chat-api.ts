import {
  ChatRequest,
  ChatResponse,
} from "@/types/chat";

export async function sendMessage(
  payload: ChatRequest,
): Promise<ChatResponse> {
  const response = await fetch(
    "http://localhost:8000/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return response.json();
}