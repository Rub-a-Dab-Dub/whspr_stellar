from rest_framework import serializers
from .models import Conversation, Message
from apps.users.serializers import UserSerializer


class MessageSerializer(serializers.ModelSerializer):
    """
    Serializer for Message model with nested sender information.
    
    Provides full message details including sender profile data.
    Used for message listings and retrieval.
    
    Fields:
        id (int): Message identifier
        conversation (int): Parent conversation ID
        sender (object): Nested user information
        content (str): Message text
        is_read (bool): Read status
        created_at (datetime): Creation timestamp
    """
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "conversation", "sender", "content", "is_read", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]


class MessageCreateSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for message creation.
    
    Only accepts content field; conversation and sender are set by view.
    Reduces payload size for sending messages.
    """
    class Meta:
        model = Message
        fields = ["content"]


class ConversationSerializer(serializers.ModelSerializer):
    """
    Serializer for Conversation model with metadata.
    
    Includes participants list, last message preview, and unread count.
    Used for conversation listings and details.
    
    Fields:
        id (int): Conversation identifier
        participants (list): Nested user objects
        last_message (object): Most recent message in conversation
        unread_count (int): Number of unread messages from others
        created_at (datetime): Conversation creation time
        updated_at (datetime): Last activity time
    """
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "participants",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        ]

    def get_last_message(self, obj):
        message = obj.messages.last()
        if message:
            return MessageSerializer(message).data
        return None

    def get_unread_count(self, obj):
        user = self.context.get("request").user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class ConversationCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating conversations.
    
    Only requires participant ID; current user is added automatically.
    
    Fields:
        participant_id (int): User ID to create conversation with
    """
    participant_id = serializers.IntegerField()
