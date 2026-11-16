from datetime import date

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from api.models import WorkspaceInvitation, WorkspaceMembership, WorkspaceUsage


def team_plan_active(workspace):
    subscription = getattr(workspace, "subscription", None)
    return bool(
        settings.BILLING_ENABLED and subscription
        and subscription.status in ("active", "trialing")
        and subscription.price_id == settings.STRIPE_TEAM_PRICE_ID
    )


def workspace_limits(workspace):
    is_team = team_plan_active(workspace)
    return {
        "plan": "team" if is_team else "free",
        "limit": settings.TEAM_MONTHLY_REQUEST_LIMIT if is_team else settings.FREE_MONTHLY_REQUEST_LIMIT,
        "seats": settings.TEAM_WORKSPACE_SEAT_LIMIT if is_team else settings.FREE_WORKSPACE_SEAT_LIMIT,
    }


def usage_for_workspace(workspace):
    period = timezone.localdate().replace(day=1)
    usage = WorkspaceUsage.objects.filter(workspace=workspace, period=period).first()
    return {"period": period.isoformat(), "used": usage.requests_used if usage else 0, **workspace_limits(workspace)}


def workspace_has_seat(workspace):
    limits = workspace_limits(workspace)
    members = WorkspaceMembership.objects.filter(workspace=workspace).count()
    invitations = WorkspaceInvitation.objects.filter(
        workspace=workspace, accepted_at__isnull=True, revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).count()
    return members + invitations < limits["seats"]


def reserve_workspace_request(workspace):
    period = timezone.localdate().replace(day=1)
    with transaction.atomic():
        usage, _ = WorkspaceUsage.objects.select_for_update().get_or_create(workspace=workspace, period=period)
        if usage.requests_used >= workspace_limits(workspace)["limit"]:
            return None
        usage.requests_used += 1
        usage.save(update_fields=("requests_used",))
        return {"period": period.isoformat(), "used": usage.requests_used, **workspace_limits(workspace)}


def release_workspace_request(workspace, period):
    try:
        period = date.fromisoformat(period)
    except (TypeError, ValueError):
        return
    with transaction.atomic():
        usage = WorkspaceUsage.objects.select_for_update().filter(workspace=workspace, period=period).first()
        if not usage or usage.requests_used == 0:
            return
        usage.requests_used -= 1
        usage.save(update_fields=("requests_used",))
