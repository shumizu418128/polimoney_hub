from datetime import datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント

    アプリケーションの状態を確認するためのエンドポイント。
    システムの状態を返却する。

    Returns:
        dict: ヘルスチェック結果
            - status (str): "healthy"
            - timestamp (str): チェック実行時刻
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
    }
