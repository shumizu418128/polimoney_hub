"""選挙運動費用収支報告書のAPIエンドポイント

public_journalsとpublic_ledgersテーブルから選挙資金データを取得する。
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app import schemas
from app.database.supabase import get_supabase_client_dep
from app.models.public_journals import PublicJournal
from app.models.public_ledgers import PublicLedger
from app.utils.category import (
    derive_category,
    get_category_name,
    get_election_type_name,
)

router = APIRouter()


def derive_type_from_classification(classification: str | None) -> str:
    """classificationからtypeを導出する

    Args:
        classification: 活動区分（campaign/pre-campaign）

    Returns:
        str: 種別（選挙運動/立候補準備）
    """
    if classification == "campaign":
        return "選挙運動"
    elif classification == "pre-campaign":
        return "立候補準備"
    else:
        return "選挙運動"


@router.get(
    "/election-funds/{ledger_id}",
    response_model=schemas.ElectionFundsResponse,
)
async def get_election_funds_by_ledger_id(
    ledger_id: UUID,
    supabase: Client = Depends(get_supabase_client_dep),
):
    """指定した台帳IDの選挙資金データを取得する

    public_ledgersのIDを指定して、関連するpublic_journalsと
    選挙情報、政治家情報を取得する。

    Args:
        ledger_id: 台帳ID（public_ledgers.id）
        supabase: Supabaseクライアント

    Returns:
        schemas.ElectionFundsResponse: 選挙資金データ

    Raises:
        HTTPException: 指定されたデータが見つからない場合
            - 404: 台帳が存在しない場合、または選挙運動の台帳でない場合
    """
    # 1. public_ledgersを取得（election_idがNULLでないことを確認）
    ledger_response = (
        supabase.table("public_ledgers")
        .select("*")
        .eq("id", str(ledger_id))
        .not_.is_("election_id", "null")
        .single()
        .execute()
    )

    if not ledger_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選挙資金の台帳が見つかりません",
        )

    ledger = PublicLedger(**ledger_response.data)

    # 2. 政治家情報を取得
    politician_response = (
        supabase.table("politicians")
        .select("id, name, name_kana")
        .eq("id", str(ledger.politician_id))
        .single()
        .execute()
    )

    if not politician_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="政治家情報が見つかりません",
        )

    politician = schemas.PoliticianInfo(**politician_response.data)

    # 3. 選挙情報を取得
    election_response = (
        supabase.table("elections")
        .select("*")
        .eq("id", str(ledger.election_id))
        .single()
        .execute()
    )

    if not election_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選挙情報が見つかりません",
        )

    election_data = election_response.data

    # 4. 選挙区情報を取得
    district_response = (
        supabase.table("districts")
        .select("id, name")
        .eq("id", str(election_data["district_id"]))
        .single()
        .execute()
    )

    if not district_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選挙区情報が見つかりません",
        )

    district_data = district_response.data

    # 5. 選挙タイプ名を取得
    election_type_name = get_election_type_name(election_data["type"])
    election_type_response = (
        supabase.table("election_types")
        .select("code, name")
        .eq("code", election_data["type"])
        .single()
        .execute()
    )

    if election_type_response.data:
        election_type_name = election_type_response.data.get("name", election_type_name)

    election = schemas.ElectionInfo(
        id=UUID(election_data["id"]),
        name=election_data["name"],
        type=election_data["type"],
        type_name=election_type_name,
        district_id=UUID(district_data["id"]),
        district_name=district_data["name"],
        election_date=election_data["election_date"],
    )

    # 6. public_journalsを取得
    journals_response = (
        supabase.table("public_journals")
        .select("*")
        .eq("ledger_id", str(ledger_id))
        .order("date", desc=False)
        .execute()
    )

    if not journals_response.data:
        journals_data = []
    else:
        journals_data = journals_response.data

    # 7. account_codesを一括取得（必要なaccount_codeのリストを作成）
    account_codes_list = [
        journal_data.get("account_code")
        for journal_data in journals_data
        if journal_data.get("account_code")
    ]
    account_codes_map = {}
    if account_codes_list:
        account_codes_response = (
            supabase.table("account_codes")
            .select("code, name")
            .in_("code", account_codes_list)
            .execute()
        )
        if account_codes_response.data:
            account_codes_map = {
                item["code"]: item["name"] for item in account_codes_response.data
            }

    # 8. データを変換
    data_items = []
    public_expense_total = 0

    for journal_data in journals_data:
        journal = PublicJournal(**journal_data)

        # account_codeからcategoryを導出
        category = derive_category(journal.account_code)
        category_name = get_category_name(category)

        # account_codesテーブルから取得した名前があれば使用
        if journal.account_code and journal.account_code in account_codes_map:
            category_name = account_codes_map[journal.account_code]

        # classificationからtypeを導出
        journal_type = derive_type_from_classification(journal.classification)

        # public_expense_amountが0の場合はNoneにする
        public_expense_amount = journal.public_expense_amount
        if public_expense_amount and public_expense_amount > 0:
            public_expense_total += public_expense_amount
        else:
            public_expense_amount = None

        data_item = schemas.ElectionFundsDataItem(
            id=journal.id,
            date=journal.date,
            amount=journal.amount,
            category=category,
            category_name=category_name,
            type=journal_type,
            purpose=journal.description,
            non_monetary_basis=journal.non_monetary_basis,
            note=journal.note,
            public_expense_amount=public_expense_amount,
        )
        data_items.append(data_item)

    # 9. サマリー情報を作成
    summary = schemas.ElectionFundsSummary(
        total_income=ledger.total_income,
        total_expense=ledger.total_expense,
        balance=ledger.total_income - ledger.total_expense,
        public_expense_total=public_expense_total,
        journal_count=ledger.journal_count,
    )

    # 10. メタ情報を作成
    meta = schemas.ElectionFundsMeta(
        api_version="v1",
        politician=politician,
        election=election,
        summary=summary,
        generated_at=datetime.now(),
    )

    # 11. レスポンスを作成
    return schemas.ElectionFundsResponse(meta=meta, data=data_items)
