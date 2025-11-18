# 🧠 Python AI Engine (FastAPI)

딥러닝 모델을 로드하고 이미지를 분석하여 결과를 반환하는 AI 전용 서버입니다.

## ✨ 지원 모델 (Models)
1. **🐶 머핀 vs 치와와:** EfficientNet-B0 기반 이미지 분류.
2. **🌾 벼 병해충 진단:** 벼 잎사귀 질병(도열병 등) 식별.
3. **🌿 식물 병해충 진단:** 다양한 식물의 질병 상태 분석.
4. **👤 인물 신원 확인:** InsightFace + FAISS를 활용한 얼굴 인식 및 검색.

## 🛠️ 기술 스택
- **FastAPI:** 고성능 비동기 API 서버.
- **PyTorch & Torchvision:** 딥러닝 모델 추론.
- **InsightFace & FAISS:** 얼굴 특징 추출 및 고속 벡터 검색.
- **Pillow & OpenCV:** 이미지 전처리.

## ⚠️ 주의사항 (모델 파일)
Git 용량 제한으로 인해 모델 파일(`.pt`, `.index`, `.pkl`)은 저장소에 포함되지 않습니다.
`models/` 폴더에 아래 파일들이 있어야 정상 작동합니다.
- `muffin_model.pt`
- `rice_model.pth`
- `efficientnet_b0_plantdisease.pt`
- `face_index_v2.index`
- `face_labels_v2.pkl`

## 🚀 실행 방법
```bash
# 가상환경 권장
pip install -r requirements.txt
python main.py
# (포트: 8000)

ai-server/README.md (설치 가이드 추가 버전)기존 내용 아래에 [📂 모델 파일 수동 설정 가이드] 섹션을 추가하세요.(※ 나중에 본인의 구글 드라이브나 드롭박스에 모델 파일들을 올려두고, 그 다운로드 링크를 저 빈칸에 채워 넣으시면 됩니다.)Markdown# 🧠 Python AI Engine (FastAPI)

딥러닝 모델을 로드하고 이미지를 분석하여 결과를 반환하는 AI 전용 서버입니다.

