from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .serializers import UserSerializer, RegisterSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.
    
    Allows new users to create an account with username, email, and password.
    Password must meet Django's validation requirements.
    
    Methods:
        POST: Create new user account
        
    Response:
        201: User successfully created
        400: Validation error (missing fields, weak password, etc.)
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    """
    User logout endpoint.
    
    Blacklists the refresh token to prevent reuse.
    Required to invalidate JWT tokens.
    
    Methods:
        POST: Logout user
        
    Request:
        refresh (str): Refresh token to blacklist
        
    Response:
        205: Successfully logged out
        400: Invalid token
    """
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class UserSearchView(generics.ListAPIView):
    """
    User search endpoint.
    
    Searches for users by username, excluding the current user.
    Limited to 20 results for performance.
    
    Query Parameters:
        search (str): Username to search (case-insensitive)
        
    Response:
        200: List of matching users (max 20)
        401: Authentication required
    """
    serializer_class = UserSerializer

    def get_queryset(self):
        queryset = User.objects.all()
        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset.exclude(id=self.request.user.id)[:20]


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    User profile endpoint.
    
    Retrieve or update current user's profile information.
    Read-only fields (is_online, last_seen) are auto-managed.
    
    Methods:
        GET: Retrieve profile
        PATCH: Update profile (bio, email, etc.)
        
    Response:
        200: Profile retrieved/updated successfully
        401: Authentication required
    """
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
