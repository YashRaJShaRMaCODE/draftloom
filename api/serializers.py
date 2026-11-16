import hashlib
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Workspace, WorkspaceInvitation

User = get_user_model()


def username_for_email(email):
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=12, max_length=128)
    workspace_name = serializers.CharField(max_length=80, trim_whitespace=True, required=False, allow_blank=True)
    invitation_token = serializers.CharField(write_only=True, required=False, max_length=128)
    onboarding_emails = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        email = self.initial_data.get("email", "")
        email = email.strip().lower() if isinstance(email, str) else ""
        validate_password(value, user=User(username=email, email=email))
        return value

    def validate(self, attrs):
        token = attrs.get("invitation_token", "")
        if token:
            invitation = WorkspaceInvitation.objects.filter(
                token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
                accepted_at__isnull=True,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
                email__iexact=attrs["email"],
            ).first()
            if not invitation:
                raise serializers.ValidationError({"invitation_token": "This workspace invitation is invalid or expired."})
        elif not attrs.get("workspace_name", "").strip():
            raise serializers.ValidationError({"workspace_name": "Enter a workspace name."})
        attrs["invitation_token"] = token
        return attrs


class WorkspaceSettingsSerializer(serializers.ModelSerializer):
    snippets = serializers.ListField(
        child=serializers.CharField(max_length=300, trim_whitespace=True),
        max_length=8,
        allow_empty=True,
    )
    protected_terms = serializers.ListField(
        child=serializers.CharField(max_length=80, trim_whitespace=True),
        max_length=20,
        allow_empty=True,
        required=False,
    )
    message_templates = serializers.ListField(
        child=serializers.DictField(), max_length=20, allow_empty=True, required=False,
    )

    class Meta:
        model = Workspace
        fields = ("id", "name", "voice_guidance", "snippets", "protected_terms", "message_templates")
        read_only_fields = ("id",)

    def validate_snippets(self, value):
        return list(dict.fromkeys(item for item in (phrase.strip() for phrase in value) if item))

    def validate_protected_terms(self, value):
        return list(dict.fromkeys(term.strip() for term in value))

    def validate_message_templates(self, value):
        normalized = []
        names = set()
        for item in value:
            if not isinstance(item, dict) or set(item) != {"name", "body"}:
                raise serializers.ValidationError("Each template needs only a name and body.")
            name = item["name"].strip() if isinstance(item["name"], str) else ""
            body = item["body"].strip() if isinstance(item["body"], str) else ""
            if not name or len(name) > 60 or not body or len(body) > 2000:
                raise serializers.ValidationError("Template names must be 1–60 characters and message bodies 1–2,000 characters.")
            if name.casefold() in names:
                raise serializers.ValidationError("Template names must be unique.")
            names.add(name.casefold())
            malformed = re.sub(r"\{\{[a-z][a-z0-9_]{0,39}\}\}", "", body)
            if "{{" in malformed or "}}" in malformed:
                raise serializers.ValidationError("Use placeholders like {{customer_name}} with lowercase letters, numbers, and underscores.")
            normalized.append({"name": name, "body": body})
        return normalized


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop("username", None)
        self.fields["email"] = serializers.EmailField()

    def validate(self, attrs):
        attrs["username"] = username_for_email(attrs.pop("email"))
        return super().validate(attrs)
