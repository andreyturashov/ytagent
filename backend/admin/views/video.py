from sqladmin import ModelView

from db.models.video import Video


class VideoAdmin(ModelView, model=Video):
    name = "Video"
    name_plural = "Videos"

    column_list = [
        Video.id,
        Video.youtube_video_id,
        Video.title,
        Video.channel_title,
        Video.created_at,
    ]

    form_excluded_columns = [
        "embedding",
        "search_vector",
        "knowledge_items",
        "created_at",
        "updated_at",
    ]
