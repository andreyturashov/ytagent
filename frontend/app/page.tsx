import { videos } from "@/mock/videos";
import { messages } from "@/mock/messages";

import { VideoSidebar } from "@/components/video-sidebar";
import { ChatWindow } from "@/components/chat-window";
import { ChatInput } from "@/components/chat-input";

export default function HomePage() {
  return (
    <div className="h-screen flex">
      <VideoSidebar videos={videos} />

      <div className="flex flex-1 flex-col">
        <ChatWindow messages={messages} />

        <ChatInput />
      </div>
    </div>
  );
}