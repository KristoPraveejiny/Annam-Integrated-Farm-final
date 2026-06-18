import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_api.settings')
django.setup()

from api.models import ChatSession, ChatMessage, AppUser
import uuid

# Get first user
user = AppUser.objects.first()
if not user:
    print("No users found.")
    exit(1)

print(f"Testing with user: {user.id} ({type(user.id)})")

try:
    session = ChatSession.objects.create(user_id=user.id, title="Test from script")
    print("Successfully created session:", session.id)
    
    # Try fetching history
    history = ChatMessage.objects.filter(chat=session).order_by('timestamp')
    print("History count:", history.count())
    
except Exception as e:
    import traceback
    traceback.print_exc()
