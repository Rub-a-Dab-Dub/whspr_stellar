from django.db import models
from django.conf import settings


class WordSuggestion(models.Model):
    word = models.CharField(max_length=100, db_index=True)
    frequency = models.IntegerField(default=1)
    context_words = models.JSONField(default=list)
    language = models.CharField(max_length=10, default="en")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "word_suggestions"
        indexes = [
            models.Index(fields=["word", "frequency"]),
            models.Index(fields=["language", "frequency"]),
        ]
        ordering = ["-frequency"]

    def __str__(self):
        return f"{self.word} ({self.frequency})"


class UserTypingPattern(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="typing_patterns",
    )
    word = models.CharField(max_length=100)
    frequency = models.IntegerField(default=1)
    last_used = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_typing_patterns"
        unique_together = ("user", "word")
        indexes = [
            models.Index(fields=["user", "frequency"]),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.word} ({self.frequency})"


class PhraseTemplate(models.Model):
    phrase = models.CharField(max_length=200)
    category = models.CharField(max_length=50)
    usage_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "phrase_templates"
        ordering = ["-usage_count"]

    def __str__(self):
        return f"{self.phrase} ({self.category})"
