# crop_disease_detection/django_api/api/urls.py

from django.urls import path
from . import views
from . import auth_views

urlpatterns = [
    path('predict/', views.predict_disease_view, name='predict_disease'),
    path('send-signup-otp/', auth_views.send_signup_otp, name='send_signup_otp'),
    path('verify-signup-otp/', auth_views.verify_signup_otp, name='verify_signup_otp'),
    path('send-login-otp/', auth_views.send_login_otp, name='send_login_otp'),
    path('verify-login-otp/', auth_views.verify_login_otp, name='verify_login_otp'),
    path('chat/', views.ChatAPIView.as_view(), name='chat'),
]
