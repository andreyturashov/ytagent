import { useEffect, useRef } from "react";
import { Message } from "@/types/message";
import { MessageBubble } from "./message-buble";

interface Props {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatWindow({ messages, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Premium Chat Header */}
      <div className="p-5 border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-zinc-200">
            YouTube Agent Chat
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Powered by LangGraph & Ollama
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-xs text-zinc-400 font-medium">Agent Ready</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-2 scroll-smooth custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mb-4 text-2xl shadow-inner">
              🤖
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">
              No messages yet
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Start chatting or specify a video to analyze using `video_id:
              &lt;id&gt;` in your prompt.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3.5 flex-row mb-6">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-zinc-800 text-zinc-200 border border-zinc-700 shrink-0">
              AI
            </div>
            <div className="flex flex-col items-start">
              <div className="px-4 py-3 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/80 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1.5 px-1 font-medium tracking-wide">
                Assistant is thinking...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
