from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Extended Django User model with additional fields for messaging application.
    
    Fields:
        bio (str): User biography/description
        avatar (ImageField): User profile picture
        is_online (bool): Real-time online status
        last_seen (datetime): Timestamp of last activity
        role (str): User role (user, moderator, admin)
    
    Methods:
        __str__: Returns username
    """
    ROLE_CHOICES = (
        ('user', 'User'),
        ('moderator', 'Moderator'),
        ('admin', 'Admin'),
    )

    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username
