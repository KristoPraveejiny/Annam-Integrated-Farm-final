import os
import sys
import json
import numpy as np
from PIL import Image

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

import jwt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer
from .openrouter_service import generate_chat_response

try:
    import tensorflow as tf
    TF_AVAILABLE = True
except Exception as tf_err:
    tf = None
    TF_AVAILABLE = False
    print(f"[WARNING] TensorFlow could not be loaded: {tf_err}")
    print("[WARNING] Disease detection endpoint will be unavailable.")

# Import recommendations mapping from local app module
from .recommendations import get_recommendation


class ModelSingleton:
    """
    Singleton class to load the Keras model and class names config only once.
    This saves CPU/GPU memory and prevents massive latency on API requests.
    """
    _model = None
    _class_names = None

    @classmethod
    def load_resources(cls):
        if cls._model is None:
            model_path = str(settings.MODEL_PATH)
            class_path = str(settings.CLASSES_PATH)

            if not os.path.exists(model_path) or not os.path.exists(class_path):
                raise FileNotFoundError(
                    f"Model resources not found at '{model_path}' or '{class_path}'. "
                    "Make sure to run the training script first: 'python train_model.py'."
                )

            # Load model
            print("Loading TensorFlow Keras model into API memory...")
            cls._model = tf.keras.models.load_model(model_path)
            
            # Load classes list
            with open(class_path, "r") as f:
                cls._class_names = json.load(f)
                
            print("Model loaded successfully. Service is ready for predictions.")
            
        return cls._model, cls._class_names


@csrf_exempt
def predict_disease_view(request):
    """
    API view endpoint that accepts an uploaded crop leaf image and predicts
    the disease class along with detailed farmer recommendations.

    Accepts: POST request with 'image' file in multipart/form-data.
    Returns: JSON response containing disease, confidence, and recommendation.
    """
    if not TF_AVAILABLE:
        return JsonResponse(
            {"error": "Disease detection is temporarily unavailable due to a library conflict. "
                      "The weather chat and advisory endpoints are still operational."},
            status=503,
        )

    if request.method != "POST":
        return JsonResponse(
            {"error": "Method not allowed. Use POST requests."},
            status=405,
        )

    # Validate image presence in multipart form request
    if "image" not in request.FILES:
        return JsonResponse(
            {"error": "No image file provided. Please upload an image with form key 'image'."},
            status=400,
        )

    image_file = request.FILES["image"]

    try:
        # 1. Load model and config resources (cached after first run)
        try:
            model, class_names = ModelSingleton.load_resources()
        except FileNotFoundError as fnf_err:
            return JsonResponse(
                {"error": str(fnf_err)},
                status=503  # Service Unavailable
            )

        # 2. Open image in memory using PIL
        img = Image.open(image_file).convert("RGB")
        
        # 3. Resize image to match input shape expected by the model (224x224)
        img_resized = img.resize((224, 224))
        
        # 4. Convert image to numeric numpy array
        img_array = np.array(img_resized, dtype=np.float32)
        
        # 5. Expand dimensions to create batch shape: (1, 224, 224, 3)
        img_batch = np.expand_dims(img_array, axis=0)

        # 6. Execute model inference (rescaling is handled inside the model graph)
        predictions = model.predict(img_batch, verbose=0)
        
        # 7. Extract the highest probability class
        predicted_idx = np.argmax(predictions[0])
        confidence_score = float(predictions[0][predicted_idx])
        predicted_class_name = class_names[predicted_idx]

        # 8. Fetch recommendations
        rec_data = get_recommendation(predicted_class_name)

        # 9. Return JSON output with recommendation steps list
        recommendation_steps = [step.strip() for step in rec_data["recommendation"].split("\n") if step.strip()]
        return JsonResponse({
            "disease": rec_data["disease"],
            "confidence": f"{confidence_score * 100:.1f}%",
            "recommendation_steps": recommendation_steps
        }, status=200)

    except Exception as e:
        return JsonResponse(
            {"error": f"Internal server error: {str(e)}"}, 
            status=500
        )

class ChatAPIView(APIView):
    def get_user_id(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, os.getenv('JWT_SECRET', getattr(settings, 'JWT_SECRET', 'defaultsecret')), algorithms=['HS256'])
            return payload.get('userId')
        except Exception:
            return None

    def get(self, request):
        user_id = self.get_user_id(request)
        if not user_id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
        
        sessions = ChatSession.objects.filter(user_id=user_id).order_by('-updated_at')
        serializer = ChatSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        user_id = self.get_user_id(request)
        if not user_id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
        
        chat_id = request.data.get('chat_id')
        message = request.data.get('message')
        
        if not message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if chat_id:
                try:
                    session = ChatSession.objects.get(id=chat_id, user_id=user_id)
                except ChatSession.DoesNotExist:
                    return Response({'error': 'Chat not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                title = message[:30] + '...' if len(message) > 30 else message
                session = ChatSession.objects.create(user_id=user_id, title=title)
                
            user_msg = ChatMessage.objects.create(chat=session, sender='USER', message=message)
            
            history = ChatMessage.objects.filter(chat=session).order_by('timestamp')
            
            ai_response_text = generate_chat_response(user_id, message, history)
            
            ai_msg = ChatMessage.objects.create(chat=session, sender='AI', message=ai_response_text)
            
            session.save()
            
            return Response({
                'chat_id': session.id,
                'reply': ai_response_text
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f"Internal Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

