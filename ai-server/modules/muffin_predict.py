import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import os

# 1. 설정
# 🚨 모델 파일 경로 (파일명이 다르면 수정하세요)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../models/efficientnet_b0_chihuahua_muffin.pt")

# 2. 전처리 정의 (학습할 때 썼던 'val_tf'와 똑같이 맞춰야 성능이 잘 나옵니다)
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# 3. 모델 로드 함수 (서버 켜질 때 한 번만 실행됨)
def load_model():
    device = torch.device("cpu") # 서버에서는 보통 CPU로 돌립니다 (GPU 없어도 됨)
    
    print("[AI] 머핀 모델 로딩 중...")
    
    # 저장된 파일 불러오기
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"모델 파일이 없습니다: {MODEL_PATH}")
        
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    
    # 모델 껍데기 만들기 (EfficientNet B0)
    model = models.efficientnet_b0(weights=None) # 껍데기만 생성
    
    # 분류기(마지막 층) 교체 (클래스 개수에 맞춰)
    class_names = checkpoint['class_names']
    num_classes = len(class_names)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    
    # 학습된 가중치(지능) 주입
    model.load_state_dict(checkpoint['state_dict'])
    model.to(device)
    model.eval() # 평가 모드로 전환 (중요!)
    
    print(f"[AI] 모델 로딩 완료! (클래스: {class_names})")
    return model, class_names

# 전역 변수로 모델 로드 (최초 1회)
model, class_names = load_model()

# 4. 실제 예측 함수 (main.py에서 얘를 부름)
def classify_muffin(image: Image.Image):
    # 이미지 전처리 (RGB 변환 필수)
    image = image.convert("RGB")
    img_tensor = transform(image).unsqueeze(0) # 배치 차원 추가 (1, 3, 224, 224)
    
    # 추론
    with torch.no_grad():
        outputs = model(img_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        
        # 가장 높은 확률 찾기
        top_prob, top_idx = torch.max(probabilities, 0)
        
        predicted_class = class_names[top_idx.item()]
        confidence = top_prob.item() * 100

    return {
        "label": predicted_class,       # 예: "chihuahua" 또는 "muffin"
        "confidence": round(confidence, 2) # 예: 98.55
    }