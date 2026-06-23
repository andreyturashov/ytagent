from sqladmin import ModelView

from db.models.video import Video


class VideoAdmin(ModelView, model=Video):
    name = "Video"
    name_plural = "Videos"

    column_list = [
        Video.id,
        Video.youtube_video_id,
        Video.created_at,
    ]
