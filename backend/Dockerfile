FROM python:3.11-slim

WORKDIR /app

# Python依存関係インストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードコピー
COPY . .

# ポート公開
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/health')" || exit 1

# 起動コマンド
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
