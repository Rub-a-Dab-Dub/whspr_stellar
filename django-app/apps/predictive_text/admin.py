from django.contrib import admin
from .models import WordSuggestion, UserTypingPattern, PhraseTemplate


@admin.register(WordSuggestion)
class WordSuggestionAdmin(admin.ModelAdmin):
    list_display = ["word", "frequency", "language", "updated_at"]
    list_filter = ["language"]
    search_fields = ["word"]


@admin.register(UserTypingPattern)
class UserTypingPatternAdmin(admin.ModelAdmin):
    list_display = ["user", "word", "frequency", "last_used"]
    list_filter = ["user"]
    search_fields = ["word", "user__username"]


@admin.register(PhraseTemplate)
class PhraseTemplateAdmin(admin.ModelAdmin):
    list_display = ["phrase", "category", "usage_count", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["phrase"]
