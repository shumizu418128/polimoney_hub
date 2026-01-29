"""選挙運動費用収支報告書のスキーマ定義

public_journalsとpublic_ledgersテーブルから取得したデータを
レスポンス形式に変換するためのスキーマ。
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PoliticianInfo(BaseModel):
    """政治家情報

    Attributes:
        id: 政治家ID
        name: 氏名
        name_kana: 氏名（カナ）
    """

    id: UUID
    name: str
    name_kana: Optional[str] = None


class ElectionInfo(BaseModel):
    """選挙情報

    Attributes:
        id: 選挙ID
        name: 選挙名
        type: 選挙タイプコード
        type_name: 選挙タイプ名
        district_id: 選挙区ID
        district_name: 選挙区名
        election_date: 選挙日
    """

    id: UUID
    name: str
    type: str
    type_name: str
    district_id: UUID
    district_name: str
    election_date: date


class ElectionFundsSummary(BaseModel):
    """選挙資金サマリー情報

    Attributes:
        total_income: 収入合計
        total_expense: 支出合計
        balance: 収支差額
        public_expense_total: 公費負担合計
        journal_count: 仕訳件数
    """

    total_income: int = 0
    total_expense: int = 0
    balance: int = 0
    public_expense_total: int = 0
    journal_count: int = 0


class ElectionFundsMeta(BaseModel):
    """選挙資金レスポンスのメタ情報

    Attributes:
        api_version: APIバージョン
        politician: 政治家情報
        election: 選挙情報
        summary: サマリー情報
        generated_at: 生成日時
    """

    api_version: str = "v1"
    politician: PoliticianInfo
    election: ElectionInfo
    summary: ElectionFundsSummary
    generated_at: datetime


class ElectionFundsDataItem(BaseModel):
    """選挙資金データの各項目

    Attributes:
        data_id: データID（public_journals.id）
        date: 日付
        amount: 金額
        category: カテゴリコード
        category_name: カテゴリ名
        type: 種別（選挙運動/立候補準備）
        purpose: 摘要
        non_monetary_basis: 金銭以外の見積根拠
        note: 備考
        public_expense_amount: 公費負担額（0の場合は含めない）
    """

    data_id: UUID = Field(..., alias="id")
    date: date
    amount: int
    category: str
    category_name: str
    type: str
    purpose: Optional[str] = None
    non_monetary_basis: Optional[str] = None
    note: Optional[str] = None
    public_expense_amount: Optional[int] = None

    class Config:
        """Pydantic設定"""

        populate_by_name = True
        json_schema_extra = {
            "example": {
                "data_id": "123e4567-e89b-12d3-a456-426614174000",
                "date": "2026-01-29",
                "amount": 30605,
                "category": "personnel",
                "category_name": "人件費",
                "type": "選挙運動",
                "purpose": "車上運動員報酬",
                "non_monetary_basis": None,
                "note": None,
                "public_expense_amount": 1,
            }
        }


class ElectionFundsResponse(BaseModel):
    """選挙資金レスポンス

    Attributes:
        meta: メタ情報
        data: データ配列
    """

    meta: ElectionFundsMeta
    data: list[ElectionFundsDataItem]
