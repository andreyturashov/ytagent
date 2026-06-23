import { Message } from "@/types/message";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`mb-6 flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-500/20"
            : "bg-zinc-800 text-zinc-200 border border-zinc-700"
        }`}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble Container */}
      <div
        className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-sm ${
            isUser
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500/20 rounded-tr-none"
              : "bg-zinc-900/50 backdrop-blur-sm text-zinc-100 border-zinc-800/80 rounded-tl-none"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-zinc-500 mt-1.5 px-1 font-medium tracking-wide">
          {isUser ? "You" : "Assistant"}
        </span>
      </div>
    </div>
  );
}
