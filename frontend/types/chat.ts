export interface ChatRequest {
  message: string;
  video_id?: string;
  user_id?: number;
  chat_id?: number;
}

export interface ChatResponse {
  answer: string;
}
