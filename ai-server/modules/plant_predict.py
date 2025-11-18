import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import os

# 1. 모델 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 🚨 파일명이 맞는지 꼭 확인하세요!
MODEL_PATH = os.path.join(BASE_DIR, "../models/efficientnet_b0_plantdisease.pt")

# 2. 전처리 (학습할 때 사용한 설정과 맞춰야 함)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# 3. 모델 로드 함수
def load_plant_model():
    device = torch.device("cpu")
    
    if not os.path.exists(MODEL_PATH):
        print(f"⚠️ [오류] 식물 모델 파일이 없습니다: {MODEL_PATH}")
        return None, []

    print(f"[AI] 식물 병해충 모델 로딩 중... ({MODEL_PATH})")
    
    try:
        checkpoint = torch.load(MODEL_PATH, map_location=device)
        
        # 클래스 이름(정답지) 꺼내기
        # (만약 checkpoint가 딕셔너리가 아니라면 구조 확인 필요, 보통은 이 방식)
        class_names = checkpoint.get('class_names', []) 
        
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(class_names))
        
        model.load_state_dict(checkpoint['state_dict'])
        model.to(device)
        model.eval()
        
        print(f"[AI] 식물 모델 로딩 완료! 클래스 개수: {len(class_names)}")
        return model, class_names
        
    except Exception as e:
        print(f"❌ 식물 모델 로딩 실패: {e}")
        return None, []

# 전역 변수 로드
model, class_names = load_plant_model()

# 4. 예측 함수
def classify_plant(image: Image.Image):
    if model is None:
        return {"label": "Model Error", "confidence": 0.0}

    image = image.convert("RGB")
    img_tensor = transform(image).unsqueeze(0)
    
    with torch.no_grad():
        outputs = model(img_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        top_prob, top_idx = torch.max(probabilities, 0)
        
        predicted_class = class_names[top_idx.item()]
        confidence = top_prob.item() * 100

    return {
        "label": predicted_class,       # 병명 (영어)
        "confidence": round(confidence, 2) # 확률
    }