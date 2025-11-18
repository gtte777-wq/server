from fastapi import FastAPI, UploadFile, File
from io import BytesIO
from PIL import Image
import uvicorn

# 🚨 우리가 만든 모듈 2개 가져오기
from modules.muffin_predict import classify_muffin
from modules.rice_predict import classify_rice
from modules.plant_predict import classify_plant
from fastapi import FastAPI, UploadFile, File
from modules.face_predict import classify_face

app = FastAPI(title="AI Vision Lab API")

@app.get("/")
def read_root():
    return {"message": "AI Server is Running!"}

# ==========================================
# 🐶 1. 머핀 vs 치와와 엔드포인트
# ==========================================
@app.post("/predict/muffin", summary="머핀/치와와 분류")
async def predict_muffin(file: UploadFile = File(...)):
    try:
        file_content = await file.read()
        img = Image.open(BytesIO(file_content))
        
        # 머핀 모듈 호출
        result = classify_muffin(img)
        
        return {"success": True, "type": "muffin", "result": result}
    except Exception as e:
        return {"success": False, "msg": str(e)}

# ==========================================
# 🌾 2. 벼 병해충 엔드포인트
# ==========================================
@app.post("/predict/rice")
async def predict_rice(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(BytesIO(image_data)).convert("RGB")
        
        result = classify_rice(image)
        
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# 🌿 3. 식물 병해충 진단 (신규)
@app.post("/predict/plant")
async def predict_plant(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(BytesIO(image_data)).convert("RGB")
        
        result = classify_plant(image)
        
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
    # 👤 4. 얼굴 인식 엔드포인트 (수정됨)
@app.post("/predict/face")
async def predict_face(file: UploadFile = File(...)):
    try:
        # 🚨 중요: InsightFace는 파일 경로가 아니라 '바이트' 자체를 넘겨야 함
        image_bytes = await file.read()
        
        # 모듈 호출
        result = classify_face(image_bytes)
        
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)