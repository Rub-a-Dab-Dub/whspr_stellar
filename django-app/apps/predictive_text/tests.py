import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from .models import WordSuggestion, UserTypingPattern, PhraseTemplate

User = get_user_model()


class TestSuggestionsView(APITestCase):
    """Tests for the predictive text suggestions endpoint."""

    def setUp(self):
        self.suggestions_url = reverse("suggestions")

        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="SecurePass123!"
        )

        # Create global word suggestions
        WordSuggestion.objects.create(word="hello", frequency=100)
        WordSuggestion.objects.create(word="help", frequency=80)
        WordSuggestion.objects.create(word="helicopter", frequency=50)
        WordSuggestion.objects.create(word="world", frequency=200)

        # Create phrase templates
        PhraseTemplate.objects.create(
            phrase="hello world", category="greeting", usage_count=150, is_active=True
        )
        PhraseTemplate.objects.create(
            phrase="how are you", category="greeting", usage_count=100, is_active=True
        )
        PhraseTemplate.objects.create(
            phrase="help me", category="request", usage_count=80, is_active=True
        )

        # Create user typing patterns
        UserTypingPattern.objects.create(user=self.user, word="hey", frequency=50)
        UserTypingPattern.objects.create(user=self.user, word="hello", frequency=30)

    def test_suggestions_returns_global_words(self):
        """Test that suggestions endpoint returns global word suggestions."""
        response = self.client.get(self.suggestions_url, {"q": "hel"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggestions", response.data)
        self.assertIn("query", response.data)
        self.assertEqual(response.data["query"], "hel")

        suggestions = response.data["suggestions"]
        texts = [s["text"] for s in suggestions]
        self.assertIn("hello", texts)
        self.assertIn("help", texts)

    def test_suggestions_requires_query_param(self):
        """Test that the q parameter is required."""
        response = self.client.get(self.suggestions_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_suggestions_with_authenticated_user_includes_personal(self):
        """Test that authenticated users get personal suggestions first."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.suggestions_url, {"q": "he"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        suggestions = response.data["suggestions"]
        # Personal suggestions should be included
        texts = [s["text"] for s in suggestions]
        self.assertIn("hey", texts)

        # Check that personal suggestions have correct source
        personal_suggestions = [s for s in suggestions if s["source"] == "personal"]
        self.assertTrue(len(personal_suggestions) > 0)

    def test_suggestions_respects_limit(self):
        """Test that the limit parameter is respected."""
        response = self.client.get(self.suggestions_url, {"q": "he", "limit": 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data["suggestions"]), 2)

    def test_suggestions_includes_phrases(self):
        """Test that phrase templates are included in suggestions."""
        response = self.client.get(self.suggestions_url, {"q": "hel"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        suggestions = response.data["suggestions"]
        phrase_suggestions = [s for s in suggestions if s["type"] == "phrase"]
        self.assertTrue(len(phrase_suggestions) > 0)

    def test_suggestions_case_insensitive(self):
        """Test that suggestions search is case insensitive."""
        response = self.client.get(self.suggestions_url, {"q": "HEL"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        suggestions = response.data["suggestions"]
        texts = [s["text"] for s in suggestions]
        self.assertIn("hello", texts)

    def test_suggestions_returns_empty_for_no_match(self):
        """Test that no suggestions are returned for non-matching query."""
        response = self.client.get(self.suggestions_url, {"q": "xyz123"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["suggestions"]), 0)

    def test_suggestions_confidence_values(self):
        """Test that confidence values are between 0 and 1."""
        response = self.client.get(self.suggestions_url, {"q": "hel"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for suggestion in response.data["suggestions"]:
            self.assertGreaterEqual(suggestion["confidence"], 0.0)
            self.assertLessEqual(suggestion["confidence"], 1.0)


class TestSuggestionFeedbackView(APITestCase):
    """Tests for the suggestion feedback endpoint."""

    def setUp(self):
        self.feedback_url = reverse("suggestion_feedback")

        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="SecurePass123!"
        )

    def test_feedback_requires_authentication(self):
        """Test that feedback endpoint requires authentication."""
        response = self.client.post(
            self.feedback_url, {"suggestion": "hello", "accepted": True}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_feedback_creates_typing_pattern(self):
        """Test that accepting a suggestion creates a typing pattern."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.feedback_url, {"suggestion": "awesome", "accepted": True}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        pattern = UserTypingPattern.objects.get(user=self.user, word="awesome")
        self.assertEqual(pattern.frequency, 1)

    def test_feedback_increments_frequency(self):
        """Test that repeated acceptance increments frequency."""
        self.client.force_authenticate(user=self.user)

        # First acceptance
        self.client.post(
            self.feedback_url, {"suggestion": "awesome", "accepted": True}
        )

        # Second acceptance
        self.client.post(
            self.feedback_url, {"suggestion": "awesome", "accepted": True}
        )

        pattern = UserTypingPattern.objects.get(user=self.user, word="awesome")
        pattern.refresh_from_db()
        self.assertEqual(pattern.frequency, 2)

    def test_feedback_rejected_does_not_create_pattern(self):
        """Test that rejecting a suggestion does not create a pattern."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.feedback_url, {"suggestion": "rejected_word", "accepted": False}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        exists = UserTypingPattern.objects.filter(
            user=self.user, word="rejected_word"
        ).exists()
        self.assertFalse(exists)

    def test_feedback_missing_suggestion(self):
        """Test that suggestion field is required."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.feedback_url, {"accepted": True})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_feedback_missing_accepted_defaults_to_false(self):
        """Test that missing accepted field defaults to false."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.feedback_url, {"suggestion": "hello"})
        # BooleanField defaults to False when not provided
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # No pattern should be created since accepted defaults to False
        exists = UserTypingPattern.objects.filter(
            user=self.user, word="hello"
        ).exists()
        self.assertFalse(exists)


class TestPhraseTemplatesView(APITestCase):
    """Tests for the phrase templates endpoint."""

    def setUp(self):
        self.phrases_url = reverse("phrase_templates")

        PhraseTemplate.objects.create(
            phrase="hello world", category="greeting", usage_count=150, is_active=True
        )
        PhraseTemplate.objects.create(
            phrase="good morning", category="greeting", usage_count=100, is_active=True
        )
        PhraseTemplate.objects.create(
            phrase="thank you", category="gratitude", usage_count=200, is_active=True
        )
        PhraseTemplate.objects.create(
            phrase="deprecated phrase",
            category="old",
            usage_count=50,
            is_active=False,
        )

    def test_phrases_returns_active_templates(self):
        """Test that only active phrase templates are returned."""
        response = self.client.get(self.phrases_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("phrases", response.data)

        phrases = response.data["phrases"]
        self.assertEqual(len(phrases), 3)

        # Ensure inactive phrase is not included
        texts = [p["phrase"] for p in phrases]
        self.assertNotIn("deprecated phrase", texts)

    def test_phrases_filter_by_category(self):
        """Test that phrases can be filtered by category."""
        response = self.client.get(self.phrases_url, {"category": "greeting"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        phrases = response.data["phrases"]
        self.assertEqual(len(phrases), 2)
        for phrase in phrases:
            self.assertEqual(phrase["category"], "greeting")

    def test_phrases_ordered_by_usage_count(self):
        """Test that phrases are ordered by usage count descending."""
        response = self.client.get(self.phrases_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        phrases = response.data["phrases"]
        usage_counts = [p["usage_count"] for p in phrases]
        self.assertEqual(usage_counts, sorted(usage_counts, reverse=True))

    def test_phrases_does_not_require_auth(self):
        """Test that phrases endpoint is publicly accessible."""
        response = self.client.get(self.phrases_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestLearnView(APITestCase):
    """Tests for the learning endpoint."""

    def setUp(self):
        self.learn_url = reverse("learn")

        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="SecurePass123!"
        )

    def test_learn_requires_authentication(self):
        """Test that learn endpoint requires authentication."""
        response = self.client.post(self.learn_url, {"text": "hello world"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_learn_creates_word_suggestions(self):
        """Test that learning creates global word suggestions."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.learn_url, {"text": "hello world testing"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["words_count"], 3)

        self.assertTrue(WordSuggestion.objects.filter(word="hello").exists())
        self.assertTrue(WordSuggestion.objects.filter(word="world").exists())
        self.assertTrue(WordSuggestion.objects.filter(word="testing").exists())

    def test_learn_creates_user_patterns(self):
        """Test that learning creates user typing patterns."""
        self.client.force_authenticate(user=self.user)
        self.client.post(self.learn_url, {"text": "hello world"})

        pattern = UserTypingPattern.objects.get(user=self.user, word="hello")
        self.assertEqual(pattern.frequency, 1)

    def test_learn_increments_frequencies(self):
        """Test that repeated learning increments frequencies."""
        self.client.force_authenticate(user=self.user)

        self.client.post(self.learn_url, {"text": "hello"})
        self.client.post(self.learn_url, {"text": "hello"})

        suggestion = WordSuggestion.objects.get(word="hello")
        suggestion.refresh_from_db()
        self.assertEqual(suggestion.frequency, 2)

        pattern = UserTypingPattern.objects.get(user=self.user, word="hello")
        pattern.refresh_from_db()
        self.assertEqual(pattern.frequency, 2)

    def test_learn_filters_short_words(self):
        """Test that words shorter than 2 characters are filtered out."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.learn_url, {"text": "I a am testing"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Only "am" and "testing" should be learned (words >= 2 chars)
        self.assertEqual(response.data["words_count"], 2)
        self.assertFalse(WordSuggestion.objects.filter(word="i").exists())
        self.assertFalse(WordSuggestion.objects.filter(word="a").exists())

    def test_learn_missing_text(self):
        """Test that text field is required."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.learn_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_learn_converts_to_lowercase(self):
        """Test that words are converted to lowercase."""
        self.client.force_authenticate(user=self.user)
        self.client.post(self.learn_url, {"text": "HELLO World"})

        self.assertTrue(WordSuggestion.objects.filter(word="hello").exists())
        self.assertTrue(WordSuggestion.objects.filter(word="world").exists())
        self.assertFalse(WordSuggestion.objects.filter(word="HELLO").exists())


class TestWordSuggestionModel(APITestCase):
    """Tests for the WordSuggestion model."""

    def test_word_suggestion_str(self):
        """Test WordSuggestion string representation."""
        suggestion = WordSuggestion.objects.create(word="test", frequency=10)
        self.assertEqual(str(suggestion), "test (10)")

    def test_word_suggestion_default_values(self):
        """Test WordSuggestion default values."""
        suggestion = WordSuggestion.objects.create(word="test")
        self.assertEqual(suggestion.frequency, 1)
        self.assertEqual(suggestion.language, "en")
        self.assertEqual(suggestion.context_words, [])

    def test_word_suggestion_ordering(self):
        """Test WordSuggestion default ordering by frequency."""
        WordSuggestion.objects.create(word="low", frequency=10)
        WordSuggestion.objects.create(word="high", frequency=100)
        WordSuggestion.objects.create(word="medium", frequency=50)

        suggestions = list(WordSuggestion.objects.all())
        self.assertEqual(suggestions[0].word, "high")
        self.assertEqual(suggestions[1].word, "medium")
        self.assertEqual(suggestions[2].word, "low")


class TestUserTypingPatternModel(APITestCase):
    """Tests for the UserTypingPattern model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="SecurePass123!"
        )

    def test_user_typing_pattern_str(self):
        """Test UserTypingPattern string representation."""
        pattern = UserTypingPattern.objects.create(
            user=self.user, word="hello", frequency=5
        )
        self.assertEqual(str(pattern), "testuser: hello (5)")

    def test_user_typing_pattern_unique_together(self):
        """Test that user-word combination is unique."""
        UserTypingPattern.objects.create(user=self.user, word="hello")

        with self.assertRaises(Exception):
            UserTypingPattern.objects.create(user=self.user, word="hello")


class TestPhraseTemplateModel(APITestCase):
    """Tests for the PhraseTemplate model."""

    def test_phrase_template_str(self):
        """Test PhraseTemplate string representation."""
        phrase = PhraseTemplate.objects.create(
            phrase="hello world", category="greeting"
        )
        self.assertEqual(str(phrase), "hello world (greeting)")

    def test_phrase_template_default_values(self):
        """Test PhraseTemplate default values."""
        phrase = PhraseTemplate.objects.create(
            phrase="test phrase", category="test"
        )
        self.assertEqual(phrase.usage_count, 0)
        self.assertTrue(phrase.is_active)

    def test_phrase_template_ordering(self):
        """Test PhraseTemplate default ordering by usage count."""
        PhraseTemplate.objects.create(
            phrase="low", category="test", usage_count=10
        )
        PhraseTemplate.objects.create(
            phrase="high", category="test", usage_count=100
        )
        PhraseTemplate.objects.create(
            phrase="medium", category="test", usage_count=50
        )

        phrases = list(PhraseTemplate.objects.all())
        self.assertEqual(phrases[0].phrase, "high")
        self.assertEqual(phrases[1].phrase, "medium")
        self.assertEqual(phrases[2].phrase, "low")
