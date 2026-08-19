import random
import os
# pyrefly: ignore [missing-import]
import bcrypt
# pyrefly: ignore [missing-import]
import jwt
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db import connection, IntegrityError
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
    try:
        send_mail(subject, message, settings.EMAIL_HOST_USER, [email], fail_silently=False)
    except Exception as e:
        print(f"\n[DEVELOPMENT WARNING] Failed to send email to {email}. Error: {e}")
        print(f"👉 YOUR SIGNUP OTP IS: {otp}\n")
        logger.error(f"Failed to send email to {email}. Error: {e}")


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
    try:
        send_mail(subject, message, settings.EMAIL_HOST_USER, [email], fail_silently=False)
    except Exception as e:
        print(f"\n[DEVELOPMENT WARNING] Failed to send email to {email}. Error: {e}")
        print(f"👉 YOUR LOGIN OTP IS: {otp}\n")
        logger.error(f"Failed to send email to {email}. Error: {e}")


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
                """INSERT INTO app_users (full_name, email, phone, password_hash, role)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                [name, email_norm, phone.strip() if phone else None, hashed, role]
            )
            row = cursor.fetchone()
            user_id = row[0] if row else None
    except Exception as e:
        logger.error(f"Failed to create user {email_norm}: {e}")
        raise
    return user_id

# Incoming role labels (UI text, aliases, legacy values) -> user_role enum values.
# The enum only accepts: super_admin, farm_manager, worker, customer, guest.
ROLE_ALIASES = {
    'super_admin': 'super_admin',
    'super admin': 'super_admin',
    'superadmin': 'super_admin',
    'admin': 'super_admin',
    'farm_manager': 'farm_manager',
    'farm manager': 'farm_manager',
    'manager': 'farm_manager',
    'worker': 'worker',
    'farmer': 'worker',
    'customer': 'customer',
    'guest': 'guest',
}

# bcrypt refuses anything longer than this.
MAX_PASSWORD_BYTES = 72

# Roles a visitor may choose when signing up. Privileged roles (farm_manager,
# super_admin) are assigned by an administrator, never self-selected.
SELF_REGISTERABLE_ROLES = {'worker', 'customer'}


def _normalize_role(role):
    """Map an incoming role label to a valid user_role enum value, or None."""
    key = str(role or '').strip().lower().replace('-', '_')
    return ROLE_ALIASES.get(key)


def _get_user_by_email(email):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT id, full_name, email, phone, password_hash, role, status FROM app_users WHERE LOWER(TRIM(email)) = %s""",
            [email]
        )
        row = cursor.fetchone()
        if row:
            return {
                'id': str(row[0]),
                'name': row[1],
                'email': row[2],
                'phone': row[3],
                'password_hash': row[4],
                'role': row[5],
                'status': row[6]
            }
        return None


# Only accounts an administrator has activated may sign in.
ACCOUNT_STATUS_MESSAGES = {
    'pending': (
        'Your account is awaiting administrator approval. '
        'You will be able to sign in once an administrator activates your account.'
    ),
    'suspended': (
        'Your account has been suspended. Please contact the farm administrator for assistance.'
    ),
    'disabled': (
        'Your account has been disabled. Please contact the farm administrator for assistance.'
    ),
}


def _account_access_error(user):
    """Return a human-readable reason if this account may not sign in, else None."""
    account_status = str(user.get('status') or '').strip().lower()
    if account_status == 'active':
        return None
    return ACCOUNT_STATUS_MESSAGES.get(
        account_status,
        'Your account is not active. Please contact the farm administrator for assistance.',
    )

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

    if not email_norm or not otp:
        return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate the account details *before* consuming the OTP, so a bad payload
    # never leaves the user holding a spent code.
    if not password:
        return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(str(password).encode('utf-8')) > MAX_PASSWORD_BYTES:
        return Response(
            {'error': f'Password is too long (maximum {MAX_PASSWORD_BYTES} characters).'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not str(name).strip():
        return Response({'error': 'Full name is required'}, status=status.HTTP_400_BAD_REQUEST)

    normalized_role = _normalize_role(role)
    if not normalized_role:
        return Response(
            {'error': f'Unsupported user role: {role}'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if normalized_role not in SELF_REGISTERABLE_ROLES:
        return Response(
            {'error': 'This role cannot be selected during sign-up. Please contact the farm administrator.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    record = OTPVerification.objects.filter(email=email_norm, is_verified=False).order_by('-created_at').first()
    if not record or record.is_expired():
        return Response({'error': 'OTP expired or invalid'}, status=status.HTTP_400_BAD_REQUEST)
    if record.otp != otp:
        return Response({'error': 'Incorrect OTP'}, status=status.HTTP_400_BAD_REQUEST)

    if _email_exists(email_norm):
        record.is_verified = True
        record.save()
        return Response(
            {'error': 'This email is already registered. Please sign in instead.'},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        _create_user(str(name).strip(), email_norm, password, normalized_role, phone)
    except IntegrityError:
        # Someone finished registering this address between the check and the insert.
        record.is_verified = True
        record.save()
        logger.warning(f"Duplicate registration attempt for {email_norm}")
        return Response(
            {'error': 'This email is already registered. Please sign in instead.'},
            status=status.HTTP_409_CONFLICT,
        )
    except Exception as e:
        # Leave the OTP unconsumed so the user can retry without starting over.
        logger.error(f"User creation failed for {email_norm}: {type(e).__name__}: {e}")
        return Response(
            {'error': 'We could not create your account. Please try again or contact support.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    record.is_verified = True
    record.save()
    # New accounts are created with status 'pending' and stay locked out until an
    # administrator activates them from the User Management dashboard.
    return Response({
        'message': 'Account created successfully',
        'requiresApproval': True,
        'notice': (
            'Your account has been created and sent to the administrator for approval. '
            'You will be able to sign in once it has been activated.'
        ),
    })

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
    # Block inactive accounts before an OTP is ever issued.
    access_error = _account_access_error(user)
    if access_error:
        return Response({'error': access_error}, status=status.HTTP_403_FORBIDDEN)
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
        # Re-check here too: status may have changed between sending and verifying the OTP.
        access_error = _account_access_error(user)
        if access_error:
            return Response({'error': access_error}, status=status.HTTP_403_FORBIDDEN)
        token = _generate_jwt(user)
        return Response({
            'message': 'Login successful',
            'token': token,
            'user': {
                'email': user['email'],
                'id': user['id'],
                'name': user['name'],
                'phone': user['phone'],
                'role': user['role']
            }
        })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f'Error during verify_login_otp for {email_norm}: {tb}')
        return Response({'error': f'Server error: {str(e)}', 'traceback': tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
