import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Conversation, Message
from django.urls import reverse
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from django.test import TransactionTestCase

User = get_user_model()


class TestMessaging(APITestCase):
    def setUp(self):
        self.conversations_url = reverse("conversation_list")

        self.user1 = User.objects.create_user(
            username="user1", email="user1@example.com", password="SecurePass123!"
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="SecurePass123!"
        )
        self.user3 = User.objects.create_user(
            username="user3", email="user3@example.com", password="SecurePass123!"
        )

        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user1, self.user2)

        self.message = Message.objects.create(
            conversation=self.conversation, sender=self.user2, content="Hello there!"
        )

    def test_list_conversations(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_list_conversations_excludes_non_participant(self):
        self.client.force_authenticate(user=self.user3)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_list_conversations_requires_auth(self):
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_conversation(self):
        self.client.force_authenticate(user=self.user1)
        data = {"participant_id": self.user3.id}
        response = self.client.post(self.conversations_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)

        conversation = Conversation.objects.get(id=response.data["id"])
        self.assertEqual(conversation.participants.count(), 2)
        self.assertIn(self.user1, conversation.participants.all())
        self.assertIn(self.user3, conversation.participants.all())

    def test_create_conversation_returns_existing(self):
        self.client.force_authenticate(user=self.user1)
        data = {"participant_id": self.user2.id}
        response = self.client.post(self.conversations_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.conversation.id)

    def test_create_conversation_nonexistent_user(self):
        self.client.force_authenticate(user=self.user1)
        data = {"participant_id": 9999}
        response = self.client.post(self.conversations_url, data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_conversation_missing_participant(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.conversations_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_conversation_includes_participants(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        participants = response.data["results"][0]["participants"]
        self.assertEqual(len(participants), 2)

    def test_conversation_includes_last_message(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        last_message = response.data["results"][0]["last_message"]
        self.assertEqual(last_message["content"], "Hello there!")

    def test_conversation_unread_count(self):
        Message.objects.create(
            conversation=self.conversation,
            sender=self.user2,
            content="Another message",
            is_read=False,
        )
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["unread_count"], 2)

    def test_conversation_unread_excludes_own_messages(self):
        Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content="My own message",
            is_read=False,
        )
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["unread_count"], 1)

    def test_list_messages(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        response = self.client.get(self.messages_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_list_messages_non_participant(self):
        self.client.force_authenticate(user=self.user3)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        response = self.client.get(self.messages_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_list_messages_nonexistent_conversation(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[999])
        response = self.client.get(self.messages_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_send_message(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        data = {"content": "Test message"}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["content"], "Test message")
        self.assertEqual(response.data["sender"]["id"], self.user1.id)

    def test_send_message_updates_conversation(self):
        self.client.force_authenticate(user=self.user1)
        old_updated_at = self.conversation.updated_at
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        data = {"content": "Test message"}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.conversation.refresh_from_db()
        self.assertGreater(self.conversation.updated_at, old_updated_at)

    def test_send_message_nonexistent_conversation(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[9999])
        data = {"content": "Test message"}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_message_non_participant(self):
        self.client.force_authenticate(user=self.user3)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        data = {"content": "Test message"}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_empty_message(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        data = {"content": ""}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_missing_content(self):
        self.client.force_authenticate(user=self.user1)
        self.messages_url = reverse("message_list", args=[self.conversation.id])
        response = self.client.post(self.messages_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_message_as_read(self):
        self.client.force_authenticate(user=self.user1)
        self.read_messages_url = reverse("message_read", args=[self.message.id])
        response = self.client.patch(self.read_messages_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_read)

    def test_mark_message_as_read_nonexistent(self):
        self.client.force_authenticate(user=self.user1)
        self.read_messages_url = reverse("message_read", args=[9999])
        response = self.client.patch(self.read_messages_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_message_as_read_non_participant(self):
        self.client.force_authenticate(user=self.user3)
        self.read_messages_url = reverse("message_read", args=[self.message.id])
        response = self.client.patch(self.read_messages_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_message_as_read_requires_auth(self):
        self.read_messages_url = reverse("message_read", args=[self.message.id])
        response = self.client.patch(self.read_messages_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_messages_ordered_by_created_at(self):
        Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Second message"
        )
        Message.objects.create(
            conversation=self.conversation, sender=self.user2, content="Third message"
        )
        self.client.force_authenticate(user=self.user1)
        url = f"/api/v1/conversations/{self.conversation.id}/messages/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = response.data["results"]
        self.assertEqual(messages[0]["content"], "Hello there!")
        self.assertEqual(messages[1]["content"], "Second message")
        self.assertEqual(messages[2]["content"], "Third message")

    # Security Tests
    def test_cannot_access_other_users_conversation_messages(self):
        """Verify users cannot read messages from conversations they're not part of"""
        other_conversation = Conversation.objects.create()
        other_conversation.participants.add(self.user2, self.user3)
        Message.objects.create(
            conversation=other_conversation, sender=self.user2, content="Secret message"
        )

        self.client.force_authenticate(user=self.user1)
        url = reverse("message_list", args=[other_conversation.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_cannot_send_message_to_other_users_conversation(self):
        """Verify users cannot send messages to conversations they're not part of"""
        other_conversation = Conversation.objects.create()
        other_conversation.participants.add(self.user2, self.user3)

        self.client.force_authenticate(user=self.user1)
        url = reverse("message_list", args=[other_conversation.id])
        response = self.client.post(url, {"content": "Intrusion attempt"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_jwt_token_required_for_protected_endpoints(self):
        """Verify all messaging endpoints require authentication"""
        endpoints = [
            ("GET", self.conversations_url),
            ("POST", self.conversations_url),
            ("GET", reverse("message_list", args=[self.conversation.id])),
            ("POST", reverse("message_list", args=[self.conversation.id])),
            ("PATCH", reverse("message_read", args=[self.message.id])),
        ]

        for method, url in endpoints:
            if method == "GET":
                response = self.client.get(url)
            elif method == "POST":
                response = self.client.post(url, {})
            elif method == "PATCH":
                response = self.client.patch(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"{method} {url} should require authentication",
            )

    def test_user_can_only_see_own_conversations(self):
        """Verify conversation list only shows user's conversations"""
        # Create conversation that user1 is not part of
        private_conv = Conversation.objects.create()
        private_conv.participants.add(self.user2, self.user3)

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conv_ids = [c["id"] for c in response.data["results"]]
        self.assertIn(self.conversation.id, conv_ids)
        self.assertNotIn(private_conv.id, conv_ids)

    def test_message_content_not_empty_after_strip(self):
        """Verify whitespace-only messages are rejected"""
        self.client.force_authenticate(user=self.user1)
        url = reverse("message_list", args=[self.conversation.id])
        response = self.client.post(url, {"content": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_conversation_participants_info_visible(self):
        """Verify participant info is properly serialized"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.conversations_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        participants = response.data["results"][0]["participants"]

        # Verify participant fields
        for participant in participants:
            self.assertIn("id", participant)
            self.assertIn("username", participant)
            # Verify sensitive fields are not exposed
            self.assertNotIn("password", participant)


class TestWebSocket(TransactionTestCase):
    """WebSocket connection tests for real-time messaging"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="wsuser1", email="wsuser1@example.com", password="SecurePass123!"
        )
        self.user2 = User.objects.create_user(
            username="wsuser2", email="wsuser2@example.com", password="SecurePass123!"
        )
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user1, self.user2)

    @pytest.mark.asyncio
    async def test_websocket_connection_requires_auth(self):
        """Test that unauthenticated WebSocket connections are rejected"""
        from gassless_gossip.asgi import application

        communicator = WebsocketCommunicator(
            application, f"/ws/chat/{self.conversation.id}/"
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    @pytest.mark.asyncio
    async def test_websocket_connection_non_participant_rejected(self):
        """Test that non-participants cannot connect to conversation WebSocket"""
        from gassless_gossip.asgi import application

        # Create a user who is not a participant
        non_participant = await database_sync_to_async(User.objects.create_user)(
            username="nonparticipant",
            email="nonpart@example.com",
            password="SecurePass123!",
        )

        communicator = WebsocketCommunicator(
            application, f"/ws/chat/{self.conversation.id}/"
        )
        communicator.scope["user"] = non_participant
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    def test_message_model_str_representation(self):
        """Test Message model string representation"""
        message = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Test message"
        )
        self.assertIn(str(message.id), str(message))
        self.assertIn(str(self.user1), str(message))

    def test_conversation_model_str_representation(self):
        """Test Conversation model string representation"""
        self.assertIn(str(self.conversation.id), str(self.conversation))

    def test_message_default_is_read_false(self):
        """Test that messages are unread by default"""
        message = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="New message"
        )
        self.assertFalse(message.is_read)

    def test_conversation_ordering_by_updated_at(self):
        """Test conversations are ordered by updated_at descending"""
        conv1 = Conversation.objects.create()
        conv1.participants.add(self.user1)

        conv2 = Conversation.objects.create()
        conv2.participants.add(self.user1)

        # Update conv1 to make it more recent
        Message.objects.create(
            conversation=conv1, sender=self.user1, content="Update conv1"
        )
        conv1.save()

        conversations = list(Conversation.objects.filter(participants=self.user1))
        self.assertEqual(conversations[0].id, conv1.id)
