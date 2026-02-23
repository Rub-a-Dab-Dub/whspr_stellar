from django.urls import path
from .views import (
    ConversationListCreateView,
    MessageListCreateView,
    MessageReadView,
    AdminFlagListView,
    AdminFlagResolveView,
    AdminRoomFlagCreateView,
    AdminMessageFlagCreateView,
)

urlpatterns = [
    path(
        "conversations/", ConversationListCreateView.as_view(), name="conversation_list"
    ),
    path(
        "conversations/<int:conversation_id>/messages/",
        MessageListCreateView.as_view(),
        name="message_list",
    ),
    path(
        "messages/<int:message_id>/read/",
        MessageReadView.as_view(),
        name="message_read",
    ),
    
    # Moderation Endpoints
    path(
        "admin/moderation/flags/",
        AdminFlagListView.as_view(),
        name="admin_flag_list"
    ),
    path(
        "admin/moderation/flags/<int:flag_id>/resolve/",
        AdminFlagResolveView.as_view(),
        name="admin_flag_resolve"
    ),
    path(
        "admin/rooms/<int:room_id>/flag/",
        AdminRoomFlagCreateView.as_view(),
        name="admin_room_flag"
    ),
    path(
        "admin/rooms/<int:room_id>/messages/<int:message_id>/flag/",
        AdminMessageFlagCreateView.as_view(),
        name="admin_message_flag"
    ),
]
