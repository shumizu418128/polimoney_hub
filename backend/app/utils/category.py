"""勘定科目コードからカテゴリを導出するユーティリティ

account_codeからcategoryを導出するロジックを提供する。
"""

from typing import Literal

CategoryCode = Literal[
    "personnel",
    "building",
    "communication",
    "transportation",
    "printing",
    "advertising",
    "stationery",
    "food",
    "lodging",
    "miscellaneous",
    "other_income",
    "donation",
]

# account_code → category マッピング
ACCOUNT_CODE_TO_CATEGORY: dict[str, CategoryCode] = {
    # 支出（選挙運動費用）
    "EXP_PERSONNEL_ELEC": "personnel",
    "EXP_BUILDING_ELEC": "building",
    "EXP_COMMUNICATION_ELEC": "communication",
    "EXP_TRANSPORT_ELEC": "transportation",
    "EXP_PRINTING_ELEC": "printing",
    "EXP_ADVERTISING_ELEC": "advertising",
    "EXP_STATIONERY_ELEC": "stationery",
    "EXP_FOOD_ELEC": "food",
    "EXP_LODGING_ELEC": "lodging",
    "EXP_MISC_ELEC": "miscellaneous",
    # 収入
    "REV_SELF_FINANCING": "other_income",
    "REV_LOAN_ELEC": "other_income",
    "REV_DONATION_INDIVIDUAL_ELEC": "donation",
    "REV_DONATION_POLITICAL_ELEC": "donation",
    "REV_MISC_ELEC": "other_income",
}

# カテゴリコード → 日本語名 マッピング
CATEGORY_NAMES: dict[str, str] = {
    "personnel": "人件費",
    "building": "家屋費",
    "communication": "通信費",
    "transportation": "交通費",
    "printing": "印刷費",
    "advertising": "広告費",
    "stationery": "文具費",
    "food": "食糧費",
    "lodging": "休泊費",
    "miscellaneous": "雑費",
    "other_income": "その他の収入",
    "donation": "寄附",
}

# 選挙タイプコード → 日本語名 マッピング
ELECTION_TYPE_NAMES: dict[str, str] = {
    "HR": "衆議院議員選挙",
    "HC": "参議院議員選挙",
    "PG": "都道府県知事選挙",
    "PA": "都道府県議会議員選挙",
    "CM": "市区町村長選挙",
    "GM": "市区町村議会議員選挙",
}


def derive_category(account_code: str | None) -> CategoryCode:
    """account_codeからcategoryを導出する

    Args:
        account_code: 勘定科目コード（Noneの場合は"miscellaneous"を返す）

    Returns:
        CategoryCode: カテゴリコード
    """
    if not account_code:
        return "miscellaneous"

    # マッピングテーブルから直接取得
    category = ACCOUNT_CODE_TO_CATEGORY.get(account_code)
    if category:
        return category

    # プレフィックスで判断
    if account_code.startswith("REV_"):
        if "DONATION" in account_code:
            return "donation"
        return "other_income"

    if account_code.startswith("EXP_"):
        return "miscellaneous"

    return "miscellaneous"


def get_category_name(category: str) -> str:
    """カテゴリコードから日本語名を取得する

    Args:
        category: カテゴリコード

    Returns:
        str: カテゴリ名（見つからない場合はそのまま返す）
    """
    return CATEGORY_NAMES.get(category, category)


def get_election_type_name(election_type: str) -> str:
    """選挙タイプコードから日本語名を取得する

    Args:
        election_type: 選挙タイプコード

    Returns:
        str: 選挙タイプ名（見つからない場合はそのまま返す）
    """
    return ELECTION_TYPE_NAMES.get(election_type, election_type)
