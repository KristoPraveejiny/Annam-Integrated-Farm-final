import os
import dj_database_url
from dotenv import load_dotenv

# Trigger reload to load new EMAIL_HOST_PASSWORD from .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'annam-farm-dev-secret-key-change-in-prod')
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    # Third-party Apps
    'corsheaders',
    'rest_framework',
    # Local Apps
    'api.apps.ApiConfig',
    'django_api.weather_advisory',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'django_api.urls'

# Allow all origins for development (restrict in production)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_HEADERS = [
    'content-type',
    'authorization',
    'accept',
    'origin',
    'x-requested-with',
]

# Django and the Node backend MUST share one database. Django owns login/signup and
# writes app_users.password_hash; Node owns the profile/password-change endpoints and
# reads the same table. When these point at different databases, a password changed in
# the app is written to one database while login verifies against the other, so the new
# password silently never takes effect.
#
# DATABASE_URL is the single source of truth (same value as Backend/.env); the hardcoded
# local block is only a fallback for working offline.
DATABASES = {
    "default": dj_database_url.config(
        default=os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:Kristo%4018@localhost:5432/annam_integrated_farm",
        ),
        conn_max_age=600,
    )
}

import os
# Model is stored in crop_disease_detection/models/
MODEL_DIR = os.path.join(os.path.dirname(BASE_DIR), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'tomato_disease_model.keras')
CLASSES_PATH = os.path.join(MODEL_DIR, 'class_names.json')

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Static files (not used in API mode but required by Django)
STATIC_URL = '/static/'

WSGI_APPLICATION = 'django_api.wsgi.application'

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[%(asctime)s] %(levelname)s %(name)s %(message)s'
        },
        'simple': {
            'format': '%(levelname)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'django_debug.log'),
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
        '__main__': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
