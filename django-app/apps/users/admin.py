from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "email", "is_online", "last_seen", "is_staff"]
    list_filter = ["is_online", "is_staff", "is_active"]
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("bio", "avatar", "is_online")}),
    )
