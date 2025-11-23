import numpy as np
import pandas as pd
# sklearn이나 tensorflow가 없는 환경에서 에러 안 나게 예외처리 할 수도 있지만,
# 일단 설치되어 있다고 가정하고 진행합니다.
try:
    from sklearn.preprocessing import MinMaxScaler
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense
except ImportError:
    pass # 메인 로직에서 에러 처리됨

import FinanceDataReader as fdr

# 1. 감성 분석 함수
def analyze_sentiment(news_list):
    score = 0
    pos_keywords = ['상승', '급등', '호재', '체결', '성장', '흑자', '기대', '최대', '개선', '매수', '돌파']
    neg_keywords = ['하락', '급락', '악재', '무산', '감소', '적자', '우려', '최저', '둔화', '매도', '이탈']

    for news in news_list:
        title = news.get('title', '')
        for word in pos_keywords:
            if word in title: score += 1
        for word in neg_keywords:
            if word in title: score -= 1
    return score

# 2. 예측 메인 함수
def predict_next_price(ticker, news_data):
    try:
        # 차트 데이터 가져오기 (최근 500일)
        # 한국 주식은 종목코드(예: 005930), 미국은 티커(예: AAPL)
        df = fdr.DataReader(ticker)
        
        # 데이터가 없거나 너무 적으면 에러 반환
        if df is None or len(df) < 60:
            return {"error": "차트 데이터 부족 또는 종목 코드 오류"}
        
        # 'Close' 컬럼 사용 (종가)
        prices = df['Close'].astype(float).values.reshape(-1, 1)

        # 정규화
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_prices = scaler.fit_transform(prices)

        # 데이터셋 생성
        look_back = 10
        X, y = [], []
        for i in range(len(scaled_prices) - look_back):
            X.append(scaled_prices[i : i + look_back, 0])
            y.append(scaled_prices[i + look_back, 0])
        
        X, y = np.array(X), np.array(y)
        X = np.reshape(X, (X.shape[0], X.shape[1], 1))

        # 모델 학습 (속도를 위해 epochs 5로 설정)
        model = Sequential()
        model.add(LSTM(50, return_sequences=False, input_shape=(look_back, 1)))
        model.add(Dense(1))
        model.compile(optimizer='adam', loss='mean_squared_error')
        model.fit(X, y, epochs=5, batch_size=16, verbose=0)

        # 예측
        last_10_days = scaled_prices[-look_back:].reshape(1, look_back, 1)
        predicted_scaled = model.predict(last_10_days, verbose=0)
        chart_price = int(scaler.inverse_transform(predicted_scaled)[0][0])

        # 뉴스 점수 반영
        sentiment = analyze_sentiment(news_data)
        # 점수 1점당 0.5% 가중치
        final_price = int(chart_price * (1 + sentiment * 0.005))

        return {
            "chart_price": chart_price,
            "sentiment_score": sentiment,
            "final_price": final_price,
            "analysis": f"AI 분석 결과: 차트 분석 {chart_price}원, 뉴스 점수 {sentiment}점을 반영하여 최종 {final_price}원으로 예측됩니다."
        }

    except Exception as e:
        return {"error": str(e)}