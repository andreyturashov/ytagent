"use client";

import { useState } from "react";
import { sendMessage } from "@/lib/chat-api";
import { Message } from "@/types/message";
import { ChatInput } from "@/components/chat-input";
import { ChatWindow } from "@/components/chat-window";
import { VideoSidebar } from "@/components/video-sidebar";
import { videos } from "@/mock/videos";
import { Video } from "@/types/video";

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("EB7dQv1ALCU"); // Default ID
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (text: string) => {
    // 1. Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 2. Call API with selected video ID
      const response = await sendMessage({
        message: text,
        video_id: selectedVideoId,
      });

      // 3. Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Add error message if API fails
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: Failed to fetch response. (${error instanceof Error ? error.message : "Unknown error"})`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = (video: Video) => {
    setSelectedVideoId(video.id);
    // Add system notification to chat when video changes
    const systemMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `System: Changed target video to "${video.title}" (ID: ${video.id})`,
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar on left */}
      <VideoSidebar
        videos={videos}
        selectedVideoId={selectedVideoId}
        onSelectVideo={handleSelectVideo}
      />

      {/* Main chat workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
