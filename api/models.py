from django.conf import settings
from django.db import models


class Workspace(models.Model):
    name = models.CharField(max_length=80)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_workspaces")
    voice_guidance = models.CharField(max_length=500, blank=True)
    snippets = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class WorkspaceMembership(models.Model):
    OWNER = "owner"
    MEMBER = "member"
    ROLE_CHOICES = ((OWNER, "Owner"), (MEMBER, "Member"))

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workspace_memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = (
            models.UniqueConstraint(fields=("workspace", "user"), name="unique_workspace_member"),
            models.UniqueConstraint(fields=("workspace",), condition=models.Q(role="owner"), name="unique_workspace_owner"),
        )


class WorkspaceUsage(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="monthly_usage")
    period = models.DateField()
    requests_used = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = (models.UniqueConstraint(fields=("workspace", "period"), name="unique_workspace_usage_period"),)


class WorkspaceInvitation(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="invitations")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_workspace_invitations")
    email = models.EmailField(max_length=254)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = (models.Index(fields=("workspace", "email", "accepted_at"), name="workspace_invite_lookup_idx"),)


class WorkspaceSubscription(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="subscription")
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    price_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, default="free")
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    last_event_created = models.PositiveBigIntegerField(default=0)


class StripeWebhookEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
