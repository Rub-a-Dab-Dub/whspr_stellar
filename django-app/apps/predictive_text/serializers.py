from rest_framework import serializers
from .models import WordSuggestion, PhraseTemplate


class WordSuggestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordSuggestion
        fields = ["id", "word", "frequency", "language"]


class SuggestionsQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=True, min_length=1)
    limit = serializers.IntegerField(required=False, default=5, min_value=1, max_value=20)


class FeedbackSerializer(serializers.Serializer):
    suggestion = serializers.CharField()
    accepted = serializers.BooleanField()


class PhraseTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhraseTemplate
        fields = ["id", "phrase", "category", "usage_count"]


class LearnSerializer(serializers.Serializer):
    text = serializers.CharField()
