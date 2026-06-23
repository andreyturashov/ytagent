import { Video } from "@/types/video";

interface Props {
  videos: Video[];
  selectedVideoId?: string;
  onSelectVideo?: (video: Video) => void;
}

export function VideoSidebar({
  videos,
  selectedVideoId,
  onSelectVideo,
}: Props) {
  return (
    <div className="w-80 border-r border-zinc-800 bg-zinc-950/70 backdrop-blur-md flex flex-col h-full text-zinc-100">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-wide bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          YouTube Videos
        </h2>
        <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded-full font-medium">
          {videos.length} loaded
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {videos.map((video) => {
          const isSelected = selectedVideoId === video.id;
          return (
            <div
              key={video.id}
              onClick={() => onSelectVideo?.(video)}
              className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                isSelected
                  ? "bg-violet-950/40 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                  : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3
                  className={`font-medium text-sm transition-colors duration-200 ${
                    isSelected ? "text-violet-300" : "text-zinc-200"
                  }`}
                >
                  {video.title}
                </h3>
              </div>
              <p className="mt-2 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {video.summary}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  ID: {video.id}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
