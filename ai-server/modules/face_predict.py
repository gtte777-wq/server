import cv2
import numpy as np
import pickle
import faiss
from insightface.app import FaceAnalysis
import os
from PIL import Image

# 1. 설정 및 경로
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(BASE_DIR, "../models/face_index_v2.index")
LABEL_PATH = os.path.join(BASE_DIR, "../models/face_labels_v2.pkl")

# 2. 모델 및 데이터 로딩 (서버 시작 시 1회 실행)
model = None
index = None
labels = []

print("🔄 [Face] InsightFace & FAISS 모델 로딩 중...")

try:
    # (1) InsightFace 초기화 (얼굴 탐지 & 특징 추출용)
    model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    model.prepare(ctx_id=0, det_size=(640, 640))
    print("✅ [Step 1] InsightFace 로딩 성공")
    
    # (2) FAISS & 라벨 로드 (벡터 검색용)
    if os.path.exists(INDEX_PATH) and os.path.exists(LABEL_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(LABEL_PATH, "rb") as f:
            labels = pickle.load(f)
        print(f"✅ [Step 2] 얼굴 인덱스 로드 완료! (등록된 인원: {len(labels)}명)")
    else:
        print(f"⚠️ [경고] 인덱스 파일이 없습니다. (경로: {INDEX_PATH})")
        print("   -> 신원 확인 기능은 작동하지 않고, 얼굴 탐지만 수행합니다.")
        
except Exception as e:
    print(f"❌ [Face] 모델 로딩 중 오류 발생: {e}")

# 3. 예측 함수 (main.py에서 호출)
def classify_face(pil_image: Image.Image):
    # 모델 로딩 실패 시 방어 코드
    if model is None:
        return {"error": "AI 모델이 로드되지 않았습니다."}

    try:
        # ---------------------------------------------------------
        # [핵심 수정] PIL 이미지(RGB) -> OpenCV 포맷(BGR) 변환
        # ---------------------------------------------------------
        img_np = np.array(pil_image)
        
        # 색상 채널 확인 및 변환 (InsightFace는 BGR을 원함)
        if img_np.ndim == 2: # 흑백
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        elif img_np.shape[2] == 3: # RGB
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        elif img_np.shape[2] == 4: # RGBA (투명도 포함)
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        else:
            img_cv = img_np # 그대로 사용 시도

        # ---------------------------------------------------------
        # 1. 얼굴 탐지 및 임베딩 추출
        # ---------------------------------------------------------
        faces = model.get(img_cv)

        if not faces:
            return {
                "label": "탐지 실패",
                "confidence": 0.0,
                "message": "얼굴을 찾을 수 없습니다."
            }

        # 가장 크게 나온 얼굴 하나 선택 (가로x세로 면적 기준)
        target_face = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)[0]
        embedding = target_face.embedding

        # 성별/나이 정보 추출
        gender = '남성' if target_face.gender == 1 else '여성'
        age = int(target_face.age)

        # ---------------------------------------------------------
        # 2. FAISS 벡터 검색 (신원 확인)
        # ---------------------------------------------------------
        found_name = "Unknown"
        confidence_percent = 0.0
        
        # 인덱스가 정상적으로 로드되었을 때만 검색 수행
        if index is not None and len(labels) > 0:
            # 차원 맞추기 및 정규화 (L2 Norm)
            embedding = embedding.astype('float32')
            faiss.normalize_L2(embedding.reshape(1, -1))
            
            query_vector = np.array([embedding])
            
            # 가장 유사한 1명 찾기
            scores, indices = index.search(query_vector, 1)
            
            top_idx = indices[0][0]
            score = scores[0][0] # 코사인 유사도 점수

            # 유효한 인덱스인지 확인
            if 0 <= top_idx < len(labels):
                # 임계값(Threshold) 설정 (보통 0.4~0.5 이상이면 동일인)
                if score > 0.3: 
                    found_name = labels[top_idx]
                    confidence_percent = float(score) * 100
                else:
                    found_name = "등록되지 않은 사용자"
                    confidence_percent = float(score) * 100
        
        # ---------------------------------------------------------
        # 3. 결과 반환
        # ---------------------------------------------------------
        return {
            "label": found_name,
            "confidence": round(confidence_percent, 2),
            "message": f"분석 완료: {gender}, 약 {age}세 (유사도: {round(confidence_percent, 1)}%)"
        }

    except Exception as e:
        print(f"❌ [Face] 분석 중 에러: {e}")
        return {"error": str(e)}