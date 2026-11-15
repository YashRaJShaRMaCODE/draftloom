from django.urls import path

from .views import (
    accept_workspace_invitation,
    create_billing_portal_session,
    create_checkout_session,
    remove_workspace_member,
    revoke_workspace_invitation,
    rewrite_text,
    stripe_webhook,
    transfer_workspace_ownership,
    workspace_invitations,
    workspace_settings,
    workspace_team,
)

urlpatterns = [
    path("rewrite/", rewrite_text),
    path("billing/checkout/", create_checkout_session, name="billing-checkout"),
    path("billing/portal/", create_billing_portal_session, name="billing-portal"),
    path("billing/webhook/", stripe_webhook, name="billing-webhook"),
    path("workspace/", workspace_settings, name="workspace-settings"),
    path("workspace/invitations/", workspace_invitations, name="workspace-invitations"),
    path("workspace/invitations/accept/", accept_workspace_invitation, name="accept-workspace-invitation"),
    path("workspace/invitations/<int:invitation_id>/", revoke_workspace_invitation, name="revoke-workspace-invitation"),
    path("workspace/team/", workspace_team, name="workspace-team"),
    path("workspace/team/ownership/", transfer_workspace_ownership, name="transfer-workspace-ownership"),
    path("workspace/team/<int:member_id>/", remove_workspace_member, name="remove-workspace-member"),
]
