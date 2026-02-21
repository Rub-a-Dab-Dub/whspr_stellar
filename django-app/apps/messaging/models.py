from django.db import models
from django.conf import settings


class Conversation(models.Model):
    """
    Represents a conversation between two or more users.
    
    A conversation is a collection of messages between participants.
    Automatically tracks creation and modification timestamps.
    
    Fields:
        participants (ManyToMany): Users involved in conversation
        created_at (datetime): When conversation was created
        updated_at (datetime): Last message timestamp
        
    Meta:
        ordering: By most recent activity
        
    Methods:
        __str__: Returns conversation ID
    """
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="conversations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conversations"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Conversation {self.id}"


class Message(models.Model):
    """
    Represents a single message in a conversation.
    
    Each message belongs to exactly one conversation and is sent by one user.
    Tracks read status for unread message indicators.
    
    Fields:
        conversation (FK): Parent conversation
        sender (FK): User who sent the message
        content (str): Message text content
        is_read (bool): Whether recipient has read message
        created_at (datetime): When message was sent
        updated_at (datetime): Last modification timestamp
        
    Meta:
        ordering: By creation time (oldest first)
        
    Methods:
        __str__: Returns message identifier and sender
    """
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"Message {self.id} from {self.sender}"

class Flag(models.Model):
    TYPE_CHOICES = (
        ('room', 'Room'),
        ('message', 'Message'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    )
    
    flag_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    room = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='flags', null=True, blank=True)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='flags', null=True, blank=True)
    
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='flags_created')
    reason = models.TextField(blank=True)
    note = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "flags"
        ordering = ["-created_at"]
        
    def __str__(self):
        return f"Flag {self.id} on {self.flag_type}"


class ModerationLog(models.Model):
    flag = models.ForeignKey(Flag, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=50)
    note = models.TextField(blank=True)
    moderator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='moderation_actions')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "moderation_logs"
        ordering = ["-created_at"]
        
    def __str__(self):
        return f"Log for flag {self.flag_id} by {self.moderator}"
