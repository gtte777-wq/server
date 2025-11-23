from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import uvicorn
import sys
import os
import io
from PIL import Image

# 🚨 [경로 설정] modules 폴더 인식
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(current_dir, 'modules'))

# 한글 출력 깨짐 방지
sys.stdout.reconfigure(encoding='utf-8')

app = FastAPI()

# ==========================================
# 📦 모듈 로딩 (서버 켤 때 한 번만 로딩됨 -> 속도 빠름)
# ==========================================
print("\n" + "="*40)
print("⏳ AI 모델 로딩 시작...")

# 1. 주식 (Stock)
try:
    from modules.Stock_predict import predict_next_price
    print("✅ [주식] 모델 로딩 완료")
except ImportError:
    predict_next_price = None
    print("⚠️ [주식] 모듈 없음 (Stock_predict.py 확인)")

# 2. 머핀 (Muffin)
try:
    from modules.muffin_predict import classify_muffin
    print("✅ [머핀] 모델 로딩 완료")
except ImportError as e:
    classify_muffin = None
    print(f"⚠️ [머핀] 모듈 로딩 실패: {e}")

# 3. 식물 (Plant)
try:
    from modules.plant_predict import classify_plant
    print("✅ [식물] 모델 로딩 완료")
except ImportError:
    classify_plant = None
    print("⚠️ [식물] 모듈 없음 (plant_predict.py 확인)")

# 4. 얼굴 (Face)
try:
    from modules.face_predict import classify_face
    print("✅ [얼굴] 모델 로딩 완료")
except ImportError:
    classify_face = None
    print("⚠️ [얼굴] 모듈 없음 (face_predict.py 확인)")

# 5. 벼 (Rice)
try:
    from modules.rice_predict import classify_rice
    print("✅ [벼] 모델 로딩 완료")
except ImportError:
    classify_rice = None
    print("⚠️ [벼] 모듈 없음 (rice_predict.py 확인)")

print("="*40 + "\n")


@app.get("/")
def health_check():
    return {"status": "AI Server is Running", "port": 8000}

# ==========================================
# 📈 1. 주식 예측 API
# ==========================================
class StockRequest(BaseModel):
    ticker: str
    news_data: list

@app.post("/stock")
def api_predict_stock(req: StockRequest):
    if not predict_next_price:
        return {"error": "주식 예측 모듈이 로드되지 않았습니다."}
    try:
        return predict_next_price(req.ticker, req.news_data)
    except Exception as e:
        print(f"Stock Error: {e}")
        return {"error": str(e)}

# ==========================================
# 🐶 2. 머핀/치와와 API
# ==========================================
@app.post("/muffin")
async def api_predict_muffin(file: UploadFile = File(...)):
    if not classify_muffin:
        return {"error": "머핀 모듈이 로드되지 않았습니다."}
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        result = classify_muffin(image)
        return result
    except Exception as e:
        return {"error": str(e)}

# ==========================================
# 🌿 3. 식물 병해충 API
# ==========================================
@app.post("/plant")
async def api_predict_plant(file: UploadFile = File(...)):
    if not classify_plant:
        return {"error": "식물 모듈이 없습니다."}
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        result = classify_plant(image) 
        return result
    except Exception as e:
        print(f"Plant Error: {e}")
        return {"error": str(e)}

# ==========================================
# 👤 4. 얼굴 인식 API
# ==========================================
@app.post("/face")
async def api_predict_face(file: UploadFile = File(...)):
    if not classify_face:
        return {"error": "얼굴 모듈이 없습니다."}
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        result = classify_face(image)
        return result
    except Exception as e:
        print(f"Face Error: {e}")
        return {"error": str(e)}

# ==========================================
# 🌾 5. 벼 병해충 API
# ==========================================
@app.post("/rice")
async def api_predict_rice(file: UploadFile = File(...)):
    if not classify_rice:
        return {"error": "벼 모듈이 없습니다."}
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        result = classify_rice(image)
        return result
    except Exception as e:
        print(f"Rice Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    print("🚀 AI Server running on http://127.0.0.1:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)