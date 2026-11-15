
from django.contrib import admin
from django.urls import include, path

from api.views import (
    AccountTokenRefreshView,
    EmailTokenObtainPairView,
    confirm_password_reset,
    delete_account,
    healthz,
    logout,
    register,
    request_password_reset,
    resend_verification,
    verify_email,
)

urlpatterns = [
    path('healthz/', healthz),
    path('api/auth/register/', register, name='register'),
    path('api/auth/verify-email/', verify_email, name='verify-email'),
    path('api/auth/verify-resend/', resend_verification, name='verify-resend'),
    path('api/auth/token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', AccountTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', logout, name='logout'),
    path('api/auth/account/', delete_account, name='delete-account'),
    path('api/auth/password-reset/', request_password_reset, name='password-reset'),
    path('api/auth/password-reset/confirm/', confirm_password_reset, name='password-reset-confirm'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
