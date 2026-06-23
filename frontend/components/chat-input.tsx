import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, isLoading }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-md p-4 shrink-0">
      <div className="max-w-4xl mx-auto flex items-center gap-3 relative">
        <input
          value={value}
          disabled={isLoading}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something, or include 'video_id: EB7dQv1ALCU'..."
          className="flex-1 bg-zinc-900/60 text-zinc-100 placeholder-zinc-500 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all duration-200 disabled:opacity-55"
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl p-3 text-sm font-semibold transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-violet-600/10 hover:shadow-violet-600/20 shrink-0"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.53 60.53 0 0 0 18.258-7.763.75.75 0 0 0 0-1.228 60.532 60.532 0 0 0-18.258-7.76Z" />
          </svg>
        </button>
      </div>
      <p className="max-w-4xl mx-auto text-[10px] text-zinc-600 mt-2 px-1 text-center">
        Tip: Paste a YouTube Video ID using `video_id: &lt;id&gt;` format to
        fetch and chat about that specific video.
      </p>
    </div>
  );
}
