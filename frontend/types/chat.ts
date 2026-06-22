export interface ChatRequest {
  message: string;
  video_id: string;
}

export interface ChatResponse {
  answer: string;
}