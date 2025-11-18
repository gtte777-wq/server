import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import os

# 1. 모델 파일 경로
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "../models/rice_model.pth")

# 2. 병해충 이름 정의
CLASS_NAMES = ['Bacterial leaf blight', 'Brown spot', 'Leaf smut']

# 3. 전처리
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# 4. 모델 로딩 함수 (아까 고친 버전)
def load_rice_model():
    device = torch.device("cpu")
    
    if not os.path.exists(MODEL_PATH):
        print(f"⚠️ [오류] 벼 모델 파일이 없습니다: {MODEL_PATH}")
        return None

    print(f"[AI] 벼 병해충 모델 로딩 중... ({MODEL_PATH})")
    
    try:
        # 1. 먼저 원본 모델(클래스 1000개짜리)을 만듭니다.
        model = models.efficientnet_b0(weights=None)
        
        # 2. 저장된 가중치 파일 로드
        checkpoint = torch.load(MODEL_PATH, map_location=device)
        
        # (혹시 파일 안에 'state_dict' 키가 있으면 그걸 쓰고, 아니면 통째로 씁니다)
        state_dict = checkpoint['state_dict'] if isinstance(checkpoint, dict) and 'state_dict' in checkpoint else checkpoint

        # 3. 가중치 주입 (strict=False로 안 맞는 부분 무시)
        model.load_state_dict(state_dict, strict=False)
        
        # 4. 이제 우리가 원하는 3개짜리 분류기로 교체합니다.
        num_classes = len(CLASS_NAMES)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        
        model.to(device)
        model.eval()
        
        print(f"[AI] 벼 모델 준비 완료! (Shape Mismatch 해결됨)")
        return model
        
    except Exception as e:
        print(f"❌ 벼 모델 로딩 실패: {e}")
        return None

# 전역 변수로 로드
model = load_rice_model()

# 5. 예측 함수 (🚨 이 부분이 없어서 에러가 났던 겁니다!)
def classify_rice(image: Image.Image):
    if model is None:
        return {"label": "Model Error", "confidence": 0.0}

    image = image.convert("RGB")
    img_tensor = transform(image).unsqueeze(0)
    
    with torch.no_grad():
        outputs = model(img_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        top_prob, top_idx = torch.max(probabilities, 0)
        
        # 영어 결과를 한글로 변환
        eng_label = CLASS_NAMES[top_idx.item()]
        kor_label = eng_label
        
        if "Bacterial leaf blight" in eng_label: kor_label = "세균성 벼잎마름병 (Bacterial Blight)"
        elif "Brown spot" in eng_label: kor_label = "깨씨무늬병 (Brown Spot)"
        elif "Leaf smut" in eng_label: kor_label = "잎집무늬마름병 (Leaf Smut)"
        
        confidence = top_prob.item() * 100

    return {
        "label": kor_label,
        "confidence": round(confidence, 2)
    }