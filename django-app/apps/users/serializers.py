from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model.
    
    Provides read-only access to user information including profile data
    and online status. Used for user listings and profile retrieval.
    """
    class Meta:
        model = User
        fields = ["id", "username", "email", "bio", "avatar", "is_online", "last_seen"]
        read_only_fields = ["id", "is_online", "last_seen"]


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    
    Validates password strength and confirms password match.
    Creates new user account with provided credentials.
    
    Fields:
        username (str): Unique username
        email (str): User email address
        password (str): Password (write-only, validated)
        password_confirm (str): Password confirmation (write-only)
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "password_confirm"]

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match"})
        return attrs

    def create(self, validated_data):
        """Create and return new user instance."""
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        return user
