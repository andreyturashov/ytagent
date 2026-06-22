"use client";

import { useState } from "react";

import { sendMessage } from "@/lib/chat-api";

import { Message } from "@/types/message";
import { ChatInput } from "@/components/chat-input";
import { ChatWindow } from "@/components/chat-window";

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = async (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);

    const response = await sendMessage({
      message: text,
    });

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.answer,
    };

    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <>
      <ChatWindow messages={messages} />

      <ChatInput onSend={handleSend} />
    </>
  );
}
