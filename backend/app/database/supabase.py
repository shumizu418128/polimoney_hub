"""Supabaseクライアントの設定と依存関数

Supabaseへの接続を管理し、FastAPIの依存性注入で使用できる
クライアントを提供する。
"""

from fastapi import HTTPException, status
from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from app.config import settings


def _create_supabase_client(api_key: str) -> Client:
    """Supabaseクライアントを作成する内部ヘルパー関数。

    Args:
        api_key (str): SupabaseのAPIキー（公開キーまたはService Roleキー）。

    Returns:
        Client: Supabaseクライアントインスタンス。

    Raises:
        HTTPException: Supabase設定が不完全な場合。
    """
    if not settings.supabase_url or not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase configuration is incomplete",
        )

    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )

    return create_client(settings.supabase_url, api_key, options=options)


def get_supabase_client() -> Client:
    """RLSを尊重するSupabaseクライアントを取得する。

    Publishable（匿名）キーを使用してSupabaseクライアントを作成する。
    Row Level Security（RLS）のポリシーが有効な通常のエンドポイントで使用する。

    Returns:
        Client: Supabaseクライアントインスタンス。

    Raises:
        HTTPException: Supabase設定が不完全な場合。
    """
    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase publishable key is not configured",
        )

    return _create_supabase_client(settings.supabase_publishable_key)


def get_supabase_client_dep() -> Client:
    """FastAPIの依存性注入で使用する通常権限のSupabaseクライアント取得関数。

    Returns:
        Client: RLSを尊重するSupabaseクライアントインスタンス。
    """
    return get_supabase_client()


def get_admin_supabase_client() -> Client:
    """管理者用Supabaseクライアントを取得する。

    Service Roleキーを使用してSupabaseクライアントを作成する。
    このクライアントはRLSをバイパスするため、認証・認可が
    施された管理者専用のエンドポイントでのみ使用すること。

    Returns:
        Client: 管理者権限を持つSupabaseクライアントインスタンス。

    Raises:
        HTTPException: Supabase設定が不完全な場合。
    """
    if not settings.supabase_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase service role key is not configured",
        )

    return _create_supabase_client(settings.supabase_secret_key)


def get_admin_supabase_client_dep() -> Client:
    """FastAPIの依存性注入で使用する管理者用Supabaseクライアント取得関数。

    Returns:
        Client: 管理者権限を持つSupabaseクライアントインスタンス。
    """
    return get_admin_supabase_client()
