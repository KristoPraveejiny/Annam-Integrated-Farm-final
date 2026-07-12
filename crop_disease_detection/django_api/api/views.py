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

# Removed top-level tensorflow import to prevent init conflicts
# Import recommendations mapping from local app module
from .recommendations import get_recommendation
from .model_loader import get_model_and_classes

def _get_expected_image_size(model, fallback=(224, 224)):
    """
    Read the spatial input size directly from the loaded model.
    This keeps inference aligned with whatever crop-specific model is loaded.
    """
    try:
        _, height, width, _ = model.input_shape
        if height and width:
            return (int(height), int(width))
    except Exception:
        pass
    return fallback


def _get_brinjal_input_size():
    return (224, 224)


def _apply_input_mode(model, img_batch, input_mode="auto"):
    import tensorflow as tf

    if input_mode == "raw":
        return img_batch
    if input_mode == "unit":
        return img_batch / 255.0
    if input_mode == "minus1to1":
        return (img_batch / 127.5) - 1.0

    has_rescaling = any(
        isinstance(layer, tf.keras.layers.Rescaling)
        or "rescaling" in layer.name.lower()
        or "preprocess" in layer.name.lower()
        for layer in model.layers
    )
    if has_rescaling:
        return img_batch

    is_mobilenet = any("expanded_conv" in layer.name for layer in model.layers)
    if is_mobilenet:
        return (img_batch / 127.5) - 1.0
    return img_batch / 255.0


def _predict_single_bundle(bundle, img_batch):
    import tensorflow as tf

    model = bundle["model"]
    class_names = bundle["class_names"]
    input_mode = bundle.get("input_mode", getattr(model, "_codex_input_mode", "auto"))
    img_batch = _apply_input_mode(model, img_batch, input_mode)

    predictions = model.predict(img_batch, verbose=0)[0]
    predicted_idx = int(np.argmax(predictions))
    confidence_score = float(predictions[predicted_idx])
    predicted_class_name = class_names[predicted_idx] if class_names else f"class_{predicted_idx}"

    return {
        "model_name": bundle.get("name", "model"),
        "predicted_class": predicted_class_name,
        "predicted_index": predicted_idx,
        "confidence": round(min(100.0, max(0.0, confidence_score * 100)), 2),
        "raw_confidence": confidence_score,
    }


def _extract_prediction(bundle, img_batch):
    result = _predict_single_bundle(bundle, img_batch)
    result["predicted_label"] = result["predicted_class"]
    return result


def _predict_brinjal_sequential(bundle_results, img_batch):
    primary_bundle = bundle_results[0]
    secondary_bundle = bundle_results[1] if len(bundle_results) > 1 else None

    primary_result = _extract_prediction(primary_bundle, img_batch.copy())
    primary_label = primary_result["predicted_class"]

    if primary_result["confidence"] < 20.0:
        return {
            "error": "The uploaded image could not be identified. Please upload a clearer Brinjal leaf image.",
            "model_results": [primary_result],
        }

    if primary_label != "Healthy Brinjal":
        return {
            "final_result": primary_result,
            "model_results": [primary_result],
        }

    if secondary_bundle is None:
        return {
            "final_result": primary_result,
            "model_results": [primary_result],
        }

    secondary_result = _extract_prediction(secondary_bundle, img_batch.copy())
    model_results = [primary_result, secondary_result]

    if secondary_result["predicted_class"] == "Brinjal Little Leaf" and secondary_result["confidence"] >= 20.0:
        return {
            "final_result": secondary_result,
            "model_results": model_results,
        }

    return {
        "final_result": primary_result,
        "model_results": model_results,
    }

@csrf_exempt
def predict_disease_view(request):
    """
    API view endpoint that accepts an uploaded crop leaf image and predicts
    the disease class along with detailed farmer recommendations.

    Accepts: POST request with 'image' file in multipart/form-data.
    Returns: JSON response containing disease, confidence, and recommendation.
    """
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
    
    # Read crop from request, default to Tomato
    crop = request.POST.get("crop", "Tomato")

    try:
        # 1. Load model and config resources via model_loader
        model, class_names, error_msg = get_model_and_classes(crop)
        
        if error_msg:
            return JsonResponse(
                {"success": False, "message": error_msg},
                status=400
            )

        target_size = _get_expected_image_size(model)
        if isinstance(model, list):
            target_size = _get_brinjal_input_size()

        # 2. Open image in memory using PIL
        img = Image.open(image_file).convert("RGB")
        
        # 3. Resize image to match the loaded model's input shape
        img_resized = img.resize(target_size)
        
        # 4. Convert image to numeric numpy array
        img_array = np.array(img_resized, dtype=np.float32)
        
        # 5. Expand dimensions to create batch shape: (1, H, W, 3)
        img_batch = np.expand_dims(img_array, axis=0)

        # 5.5 Support both single-model and multi-model crop pipelines.
        if isinstance(model, list):
            brinjal_result = _predict_brinjal_sequential(model, img_batch)
            if "error" in brinjal_result:
                return JsonResponse({"error": brinjal_result["error"]}, status=400)

            final_result = brinjal_result["final_result"]
            model_results = brinjal_result["model_results"]
            confidence_percentage = final_result["confidence"]
            disease_name = final_result["predicted_class"]
            if "_" in disease_name:
                disease_name = disease_name.replace("_", " ").title()

            return JsonResponse({
                "success": True,
                "crop": crop,
                "disease": disease_name,
                "confidence": confidence_percentage,
                "selected_model": final_result["model_name"],
                "model_results": model_results
            }, status=200)

        # 6. Execute model inference (rescaling is handled inside the model graph)
        import tensorflow as tf
        input_mode = getattr(model, "_codex_input_mode", "auto")
        img_batch = _apply_input_mode(model, img_batch, input_mode)

        predictions = model.predict(img_batch, verbose=0)
        predictions_normalized = predictions[0]

        predicted_idx = np.argmax(predictions_normalized)
        confidence_score = float(predictions_normalized[predicted_idx])
        
        print(f"DEBUG: model={crop}, preds={predictions_normalized}, max_idx={predicted_idx}, conf={confidence_score}")

        confidence_percentage = round(min(100.0, max(0.0, confidence_score * 100)), 2)
        
        if confidence_percentage < 20.0:
            print(f"DEBUG: Rejected due to low confidence: {confidence_percentage}%")
            return JsonResponse(
                {"error": f"Prediction confidence is low ({confidence_percentage}%)."},
                status=400
            )

        predicted_class_name = class_names[predicted_idx]
        disease_name = predicted_class_name.replace("_", " ").title()
        
        if disease_name.lower() == "healthy":
            disease_name = "Healthy"

        # 10. Return JSON output with required structure
        return JsonResponse({
            "success": True,
            "crop": crop,
            "disease": disease_name,
            "confidence": confidence_percentage
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
