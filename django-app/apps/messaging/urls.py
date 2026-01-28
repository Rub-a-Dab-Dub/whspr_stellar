from django.urls import path
from .views import ConversationListCreateView, MessageListCreateView, MessageReadView

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
]
