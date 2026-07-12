# crop_disease_detection/django_api/api/apps.py

from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        try:
            from .model_loader import get_model_and_classes
            get_model_and_classes("Brinjal")
            get_model_and_classes("Mango")
        except Exception as exc:
            print(f"Model preload skipped: {exc}")
