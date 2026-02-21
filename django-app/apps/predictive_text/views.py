from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import F

from .models import WordSuggestion, UserTypingPattern, PhraseTemplate
from .serializers import (
    SuggestionsQuerySerializer,
    FeedbackSerializer,
    PhraseTemplateSerializer,
    LearnSerializer,
)


class SuggestionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query_serializer = SuggestionsQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        query = query_serializer.validated_data["q"].lower()
        limit = query_serializer.validated_data["limit"]

        suggestions = []

        # Personal suggestions
        if request.user.is_authenticated:
            personal = UserTypingPattern.objects.filter(
                user=request.user, word__istartswith=query
            ).order_by("-frequency")[:limit]

            for pattern in personal:
                suggestions.append({
                    "text": pattern.word,
                    "confidence": min(pattern.frequency / 100, 1.0),
                    "type": "word",
                    "source": "personal",
                })

        # Global suggestions
        remaining = limit - len(suggestions)
        if remaining > 0:
            global_words = WordSuggestion.objects.filter(
                word__istartswith=query
            ).order_by("-frequency")[:remaining]

            for word in global_words:
                suggestions.append({
                    "text": word.word,
                    "confidence": min(word.frequency / 1000, 1.0),
                    "type": "word",
                    "source": "global",
                })

        # Phrase suggestions
        remaining = limit - len(suggestions)
        if remaining > 0:
            phrases = PhraseTemplate.objects.filter(
                phrase__istartswith=query, is_active=True
            ).order_by("-usage_count")[:remaining]

            for phrase in phrases:
                suggestions.append({
                    "text": phrase.phrase,
                    "confidence": min(phrase.usage_count / 500, 1.0),
                    "type": "phrase",
                    "source": "template",
                })

        return Response({"suggestions": suggestions[:limit], "query": query})


class SuggestionFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        suggestion = serializer.validated_data["suggestion"]
        accepted = serializer.validated_data["accepted"]

        if accepted:
            pattern, created = UserTypingPattern.objects.get_or_create(
                user=request.user,
                word=suggestion.lower(),
                defaults={"frequency": 1},
            )
            if not created:
                pattern.frequency = F("frequency") + 1
                pattern.save()

        return Response({"status": "recorded"}, status=status.HTTP_201_CREATED)


class PhraseTemplatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get("category")
        queryset = PhraseTemplate.objects.filter(is_active=True)

        if category:
            queryset = queryset.filter(category=category)

        phrases = queryset.order_by("-usage_count")[:20]
        serializer = PhraseTemplateSerializer(phrases, many=True)

        return Response({"phrases": serializer.data})


class LearnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LearnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        words = [w.lower() for w in text.split() if len(w) >= 2]

        for word in words:
            suggestion, created = WordSuggestion.objects.get_or_create(
                word=word, defaults={"frequency": 1}
            )
            if not created:
                suggestion.frequency = F("frequency") + 1
                suggestion.save()

            pattern, created = UserTypingPattern.objects.get_or_create(
                user=request.user, word=word, defaults={"frequency": 1}
            )
            if not created:
                pattern.frequency = F("frequency") + 1
                pattern.save()

        return Response({"status": "learned", "words_count": len(words)})
