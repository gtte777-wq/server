import cv2
import numpy as np
import pickle
import faiss
from insightface.app import FaceAnalysis
import os
from io import BytesIO
from PIL import Image

# 🚨 [수정] 코드가 다시 상대 경로로 돌아갔습니다. (가장 깔끔한 형태!)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(BASE_DIR, "../models/face_index_v2.index")
LABEL_PATH = os.path.join(BASE_DIR, "../models/face_labels_v2.pkl")

# 3. 모델 및 데이터 로딩
model = None
index = None
labels = []

print("🔄 [AI] InsightFace 모델 초기 로딩 중...")
try:
    model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    model.prepare(ctx_id=0, det_size=(640, 640))
    print("✅ [Step 1] InsightFace 로딩 성공")
    
    if os.path.exists(INDEX_PATH) and os.path.exists(LABEL_PATH):
        # 🚨 이제 한글 경로 문제가 해결됐으므로 FAISS가 파일을 찾아야 합니다.
        index = faiss.read_index(INDEX_PATH)
        with open(LABEL_PATH, "rb") as f:
            labels = pickle.load(f)
        print(f"✅ [Step 2] 얼굴 인덱스 로드 완료! 등록된 인원: {len(labels)}명")
    else:
        print(f"❌ [오류] 인덱스 파일 없음: {INDEX_PATH} 경로를 확인하세요.")
        
except Exception as e:
    print(f"❌ [오류] 로딩 중 심각한 오류 발생: {e}")

# ... (아래 get_face_embedding 및 classify_face 함수들은 그대로 유지) ...

def get_face_embedding(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: return None
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    faces = model.get(img_rgb)
    if not faces: return None
    return faces[0].embedding

def classify_face(image_bytes):
    if index is None or model is None:
        return {"label": "System Error (AI Core Down)", "confidence": 0.0}

    embedding = get_face_embedding(image_bytes)
    if embedding is None:
        return {"label": "No Face Detected", "confidence": 0.0}

    embedding = embedding.astype('float32')
    faiss.normalize_L2(embedding.reshape(1, -1))

    query_vector = np.array([embedding])
    scores, indices = index.search(query_vector, 1)
    
    top_idx = indices[0][0]
    score = scores[0][0]

    if top_idx == -1 or top_idx >= len(labels):
        return {"label": "Unknown", "confidence": 0.0}
    
    found_name = labels[top_idx]
    confidence_percent = float(score) * 100

    return {
        "label": found_name,
        "confidence": round(confidence_percent, 2)
    }