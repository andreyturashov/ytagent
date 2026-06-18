import { Video } from "@/types/video";

interface Props {
  videos: Video[];
}

export function VideoSidebar({
  videos,
}: Props) {
  return (
    <div className="w-80 border-r">
      <div className="p-4 font-bold">
        Videos
      </div>

      {videos.map((video) => (
        <div
          key={video.id}
          className="p-4 border-b cursor-pointer"
        >
          <div>{video.title}</div>

          <div className="text-sm text-gray-500">
            {video.summary}
          </div>
        </div>
      ))}
    </div>
  );
}