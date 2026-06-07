from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User

class AppUser(models.Model):
    id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'app_users'
        managed = True

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} Profile"

class OTPVerification(models.Model):
    email = models.EmailField(db_index=True)
    otp = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resend_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'otp_verifications'
        ordering = ['-created_at']

    def is_expired(self):
        now = timezone.now()
        expires_at = self.expires_at
        if timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at)
        return now > expires_at
    
    @classmethod
    def generate_expiry(cls):
        return timezone.now() + timedelta(minutes=5)
