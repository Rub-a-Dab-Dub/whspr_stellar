from django.urls import path
from .views import (
    SuggestionsView,
    SuggestionFeedbackView,
    PhraseTemplatesView,
    LearnView,
)

urlpatterns = [
    path("suggestions/", SuggestionsView.as_view(), name="suggestions"),
    path("suggestions/feedback/", SuggestionFeedbackView.as_view(), name="suggestion_feedback"),
    path("suggestions/phrases/", PhraseTemplatesView.as_view(), name="phrase_templates"),
    path("suggestions/learn/", LearnView.as_view(), name="learn"),
]
