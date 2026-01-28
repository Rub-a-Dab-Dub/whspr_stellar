from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    ConversationCreateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
)

User = get_user_model()


class ConversationListCreateView(generics.ListCreateAPIView):
    """
    Conversation list and creation endpoint.
    
    Lists all conversations for the current user and allows creating
    new conversations with other users.
    
    Methods:
        GET: List user's conversations
        POST: Create new conversation
        
    POST Parameters:
        participant_id (int): User ID to start conversation with
        
    Response:
        200/201: Conversation data with participants and metadata
        404: User not found (when creating)
        401: Authentication required
    """
    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ConversationCreateSerializer
        return ConversationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        participant_id = serializer.validated_data["participant_id"]
        try:
            participant = User.objects.get(id=participant_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Check if conversation already exists
        existing = Conversation.objects.filter(participants=request.user).filter(
            participants=participant
        )

        if existing.exists():
            return Response(
                ConversationSerializer(
                    existing.first(), context={"request": request}
                ).data,
                status=status.HTTP_200_OK,
            )

        # Create new conversation
        conversation = Conversation.objects.create()
        conversation.participants.add(request.user, participant)

        return Response(
            ConversationSerializer(conversation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MessageListCreateView(generics.ListCreateAPIView):
    """
    Message list and creation endpoint.
    
    Lists all messages in a conversation and allows sending new messages.
    User must be a participant in the conversation.
    
    Methods:
        GET: List messages in conversation (paginated)
        POST: Send new message
        
    Path Parameters:
        conversation_id (int): Conversation identifier
        
    POST Parameters:
        content (str): Message text
        
    Response:
        200/201: Message data with sender information
        404: Conversation not found or user not participant
        401: Authentication required
    """
    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        return Message.objects.filter(
            conversation_id=conversation_id,
            conversation__participants=self.request.user,
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MessageCreateSerializer
        return MessageSerializer

    def create(self, request, *args, **kwargs):
        conversation_id = self.kwargs["conversation_id"]
        try:
            conversation = Conversation.objects.get(
                id=conversation_id, participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=serializer.validated_data["content"],
        )

        conversation.save()  # Update updated_at

        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


class MessageReadView(APIView):
    """
    Message read status endpoint.
    
    Marks a message as read. Called when user views a message.
    
    Methods:
        PATCH: Mark message as read
        
    Path Parameters:
        message_id (int): Message identifier
        
    Response:
        200: Message marked as read
        404: Message not found or user not participant
        401: Authentication required
    """
    def patch(self, request, message_id):
        try:
            message = Message.objects.get(
                id=message_id, conversation__participants=request.user
            )
        except Message.DoesNotExist:
            return Response(
                {"error": "Message not found"}, status=status.HTTP_404_NOT_FOUND
            )

        message.is_read = True
        message.save()

        return Response(MessageSerializer(message).data)
