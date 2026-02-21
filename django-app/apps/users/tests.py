from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

User = get_user_model()


class TestUsers(APITestCase):
    def setUp(self):
        self.register_url = reverse("register")
        self.login_url = reverse("login")
        self.logout_url = reverse("logout")
        self.search_url = reverse("user_search")
        self.profile_url = reverse("profile")

        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="SecurePass123!"
        )
        self.user2 = User.objects.create_user(
            username="otheruser", email="other@example.com", password="SecurePass123!"
        )

    def test_user_registration_success(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_user_registration_password_mismatch(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "SecurePass123!",
            "password_confirm": "DifferentPass123!",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newuser").exists())

    def test_user_registration_weak_password(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "123",
            "password_confirm": "123",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_registration_duplicate_username(self):
        data = {
            "username": "testuser",
            "email": "another@example.com",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_registration_missing_fields(self):
        data = {"username": "newuser"}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        data = {"username": "testuser", "password": "SecurePass123!"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_user_login_invalid_password(self):
        data = {"username": "testuser", "password": "WrongPassword123!"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_nonexistent_user(self):
        data = {"username": "nonexistent", "password": "SecurePass123!"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_logout_success(self):
        self.client.force_authenticate(user=self.user)
        login_response = self.client.post(
            self.login_url, {"username": "testuser", "password": "SecurePass123!"}
        )
        refresh_token = login_response.data["refresh"]
        response = self.client.post(self.logout_url, {"refresh": refresh_token})
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_user_logout_invalid_token(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.logout_url, {"refresh": "invalid_token"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_users_by_username(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.search_url, {"search": "other"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["username"], "otheruser")

    def test_search_excludes_current_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.search_url, {"search": "test"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [u["username"] for u in response.data["results"]]
        self.assertNotIn("testuser", usernames)

    def test_search_all_users(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.search_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_search_requires_authentication(self):
        response = self.client.get(self.search_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["email"], "test@example.com")

    def test_update_profile_bio(self):
        self.client.force_authenticate(user=self.user)
        data = {"bio": "Updated bio content"}
        response = self.client.patch(self.profile_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "Updated bio content")

    def test_update_profile_email(self):
        self.client.force_authenticate(user=self.user)
        data = {"email": "newemail@example.com"}
        response = self.client.patch(self.profile_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "newemail@example.com")

    def test_profile_requires_authentication(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_read_only_fields(self):
        self.client.force_authenticate(user=self.user)
        data = {"is_online": True, "last_seen": "2025-01-01T00:00:00Z"}
        response = self.client.patch(self.profile_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_online)
