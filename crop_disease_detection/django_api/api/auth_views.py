import random
import os
# pyrefly: ignore [missing-import]
import bcrypt
# pyrefly: ignore [missing-import]
import jwt
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import OTPVerification

# Helper to get JWT secret from Django settings or env
JWT_SECRET = os.getenv('JWT_SECRET', getattr(settings, 'JWT_SECRET', 'defaultsecret'))
JWT_EXPIRES_IN = 3600  # seconds (1 hour)

def generate_otp():
    return str(random.randint(100000, 999999))

def send_signup_otp_email(email, otp):
    subject = 'Verify Your Email Address'
    message = f'''Hello,

Thank you for registering with the Annam Integrated Farm.

To complete your registration, please use the following One-Time Password (OTP):

OTP Code: {otp}

For the security purpose this OTP is valid for 5 minutes.

Thank you for using Annam Integrated Farm.

Best Regards,
Annam Integrated Farm.
'''
    send_mail(subject, message, settings.EMAIL_HOST_USER, [email], fail_silently=False)


def send_login_otp_email(email, otp):
    subject = 'Login Verification Code'
    message = f'''Hello,

A login request has been received for your Annam Integrated Farm.

Please use the following One-Time Password (OTP) to verify your identity:

OTP Code: {otp}

for the security purpose this OTP is valid for 5 minutes.
Do not share this code with anyone.

Thank you for using Annam Integrated Farm.


Best Regards,
Annam Integrated Farm.
''' 
    send_mail(subject, message, settings.EMAIL_HOST_USER, [email], fail_silently=False)


import logging
logger = logging.getLogger(__name__)

def _normalize_email(email):
    """Trim and lower-case the email for consistent checks."""
    if email:
        return email.strip().lower()
    return email

def _email_exists(email):
    email_norm = _normalize_email(email)
    logger.debug(f"Checking if email exists: {email_norm}")
    # Log connection details for debugging
    logger.debug(f"DB connection settings: {connection.settings_dict}")
    # Use LOWER and TRIM to avoid whitespace/case issues
    email_norm = _normalize_email(email)
    logger.debug(f"Checking if email exists (normalized): {email_norm}")
    with connection.cursor() as cursor:
        cursor.execute('SELECT id FROM app_users WHERE LOWER(TRIM(email)) = %s', [email_norm])
        result = cursor.fetchone()
    exists = result is not None
    logger.debug(f"Email exists result: {exists}")
    return exists


def _delete_user_by_email(email):
    """Delete any existing user with the given email (normalized)."""
    email_norm = _normalize_email(email)
    logger.debug(f"Deleting existing user if any: {email_norm}")
    with connection.cursor() as cursor:
        cursor.execute('DELETE FROM app_users WHERE LOWER(TRIM(email)) = %s', [email_norm])
        # No need to fetch; just execute
    logger.debug("Deletion executed")

def _create_user(name, email, password, role, phone=''):
    """Create a new user after normalising the email and logging details."""
    email_norm = _normalize_email(email)
    logger.debug(f"Creating user: {email_norm}, name: {name}, role: {role}")
    # Hash password with bcrypt to be compatible with Node backend
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    # Log connection settings when creating a user
    logger.debug(f"Creating user with DB settings: {connection.settings_dict}")
    logger.debug(f"Inserting user: {email_norm}, name: {name}, role: {role}")
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO app_users (full_name, email, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING id""",
                [name, email_norm, hashed, role]
            )
            row = cursor.fetchone()
            user_id = row[0] if row else None
    except Exception as e:
        logger.error(f"Failed to create user {email_norm}: {e}")
        raise
    # phone column does not exist in app_users; you may store it elsewhere if needed. Ignored for now.
    return user_id

def _get_user_by_email(email):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT id, full_name, email, password_hash, role FROM app_users WHERE LOWER(TRIM(email)) = %s""",
            [email]
        )
        row = cursor.fetchone()
        if row:
            return {
                'id': str(row[0]),
                'name': row[1],
                'email': row[2],
                'password_hash': row[3],
                'role': row[4]
            }
        return None

def _generate_jwt(user):
    payload = {
        'userId': user['id'],
        'role': user['role'],
        'exp': int(timezone.now().timestamp()) + JWT_EXPIRES_IN
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

@api_view(['POST'])
def send_signup_otp(request):
    email = request.data.get('email')
    # Log incoming payload for debugging
    logger.debug(f"Signup request payload: {request.data}")
    if not email:
        return Response({'error': 'Email required'}, status=status.HTTP_400_BAD_REQUEST)
    email_norm = _normalize_email(email)
    # Check if the email is already registered BEFORE deleting anything
    if _email_exists(email_norm):
        return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)
    # Clean old OTPs for this email
    OTPVerification.objects.filter(email=email_norm, expires_at__lt=timezone.now()).delete()
    otp = generate_otp()
    OTPVerification.objects.create(email=email_norm, otp=otp, expires_at=OTPVerification.generate_expiry())
    send_signup_otp_email(email_norm, otp)
    return Response({'message': 'OTP sent successfully'})

@api_view(['POST'])
def verify_signup_otp(request):
    email = request.data.get('email')
    otp = request.data.get('otp')
    password = request.data.get('password')
    name = request.data.get('name', '')
    phone = request.data.get('phone', '')
    role = request.data.get('role', 'farmer')
    email_norm = _normalize_email(email)
    record = OTPVerification.objects.filter(email=email_norm, is_verified=False).order_by('-created_at').first()
    if not record or record.is_expired():
        return Response({'error': 'OTP expired or invalid'}, status=status.HTTP_400_BAD_REQUEST)
    if record.otp != otp:
        return Response({'error': 'Incorrect OTP'}, status=status.HTTP_400_BAD_REQUEST)
    record.is_verified = True
    record.save()
    try:
        _create_user(name, email_norm, password, role, phone)
    except Exception as e:
        logger.error(f"User creation failed for {email_norm}: {e}")
        return Response({'error': 'Failed to create user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({'message': 'Account created successfully'})

@api_view(['POST'])
def send_login_otp(request):
    email = request.data.get('email')
    password = request.data.get('password')
    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    email_norm = _normalize_email(email)
    user = _get_user_by_email(email_norm)
    if not user:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
    if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    otp = generate_otp()
    OTPVerification.objects.create(email=email_norm, otp=otp, expires_at=OTPVerification.generate_expiry())
    send_login_otp_email(email_norm, otp)
    return Response({'message': 'OTP sent successfully'})

@api_view(['POST'])
def verify_login_otp(request):
    email = request.data.get('email')
    otp = request.data.get('otp')
    if not email or not otp:
        return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)
    email_norm = _normalize_email(email)
    try:
        record = OTPVerification.objects.filter(email=email_norm, is_verified=False).order_by('-created_at').first()
        if not record or record.is_expired() or record.otp != otp:
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)
        record.is_verified = True
        record.save()
        user = _get_user_by_email(email_norm)
        if not user:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        token = _generate_jwt(user)
        return Response({
            'message': 'Login successful',
            'token': token,
            'user': {
                'email': user['email'],
                'id': user['id'],
                'name': user['name'],
                'role': user['role']
            }
        })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f'Error during verify_login_otp for {email_norm}: {tb}')
        return Response({'error': f'Server error: {str(e)}', 'traceback': tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
