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
      body: JSON.stringify({
        "message": payload.message,
        "video_id": "EB7dQv1ALCU" 
      }),
    },
  );

  return response.json();
}