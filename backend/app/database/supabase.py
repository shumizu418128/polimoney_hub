"""Supabaseクライアントの設定と依存関数

Supabaseへの接続を管理し、FastAPIの依存性注入で使用できる
クライアントを提供する。
"""

from fastapi import HTTPException, status
from supabase import Client, create_client

from app.config import settings


def get_supabase_client() -> Client:
    """Supabaseクライアントを取得する

    Service Roleキーを使用してSupabaseクライアントを作成する。
    RLSをバイパスするため、管理者APIでのみ使用すること。

    Returns:
        Client: Supabaseクライアントインスタンス

    Raises:
        HTTPException: Supabase設定が不完全な場合
    """
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase configuration is incomplete",
        )

    return create_client(
        settings.supabase_url,
        settings.supabase_secret_key,
        options={
            "auth": {
                "auto_refresh_token": False,
                "persist_session": False,
            }
        },
    )


def get_supabase_client_dep() -> Client:
    """FastAPIの依存性注入で使用するSupabaseクライアント取得関数

    Returns:
        Client: Supabaseクライアントインスタンス
    """
    return get_supabase_client()
