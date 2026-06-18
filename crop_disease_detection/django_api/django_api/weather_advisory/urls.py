from django.urls import path
from .views import WeatherAdvisoryAPIView, WeatherChatAPIView

urlpatterns = [
    path('weather-advisory/', WeatherAdvisoryAPIView.as_view(), name='weather_advisory'),
]
