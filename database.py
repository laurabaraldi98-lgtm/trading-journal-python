import os

from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

supabase = create_client(
    supabase_url,
    supabase_key,
)


def get_authenticated_client(token: str):
    client = create_client(
        supabase_url,
        supabase_key,
    )

    client.postgrest.auth(token)

    return client


class DatabaseError(Exception):
    pass


class ResourceNotFoundError(Exception):
    pass


def execute_query(query):
    try:
        return query.execute()
    except Exception as error:
        raise DatabaseError(
            "Database request failed"
        ) from error


def load_trades_from_supabase(
    user_id: str,
    token: str,
    account_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    date_from: date | None = None,
    date_to: date | None = None,
):
    client = get_authenticated_client(token)

    query = (
        client
        .table("trades")
        .select("*", count="exact")
        .eq("user_id", user_id)
    )

    if account_id is not None:
        query = query.eq("account_id", account_id)

    if date_from is not None:
        query = query.gte(
            "entry_datetime",
            date_from.isoformat(),
        )

    if date_to is not None:
        day_after = date_to + timedelta(days=1)
        query = query.lt(
            "entry_datetime",
            day_after.isoformat(),
        )

    query = query.order(
        "entry_datetime",
        desc=True,
        nullsfirst=False,
    )

    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.range(start, end)

    response = execute_query(query)
    loaded_trades = []

    for trade in response.data:
        loaded_trade = [
            trade["id"],
            trade["symbol"],
            trade["direction"],
            float(trade["entry"]),
            float(trade["stop"]) if trade["stop"] is not None else None,
            float(trade["exit"]),
            float(trade["result"]) if trade["result"] is not None else None,
            float(trade["pnl"]),
            trade["entry_datetime"],
            trade["exit_datetime"],
        ]
        loaded_trades.append(loaded_trade)

    return loaded_trades, response.count or 0


def load_trade_metrics_batch_from_supabase(
    user_id: str,
    token: str,
    account_id: int,
    offset: int = 0,
    batch_size: int = 1000,
    date_from: date | None = None,
    date_to: date | None = None,
):
    client = get_authenticated_client(token)

    query = (
        client
        .table("trades")
        .select("pnl,result,entry_datetime")
        .eq("user_id", user_id)
        .eq("account_id", account_id)
    )

    if date_from is not None:
        query = query.gte(
            "entry_datetime",
            date_from.isoformat(),
        )

    if date_to is not None:
        day_after = date_to + timedelta(days=1)
        query = query.lt(
            "entry_datetime",
            day_after.isoformat(),
        )

    end = offset + batch_size - 1
    query = (
        query
        .order(
            "entry_datetime",
            desc=False,
            nullsfirst=False,
        )
        .range(offset, end)
    )

    response = execute_query(query)
    return response.data


def _build_trade_data(
    trade,
    user_id: str,
):
    return {
        "account_id": trade["account_id"],
        "symbol": trade["symbol"],
        "direction": trade["direction"],
        "entry": trade["entry"],
        "stop": trade["stop"],
        "exit": trade["exit"],
        "result": trade["result"],
        "pnl": trade["pnl"],
        "entry_datetime": (
            trade["entry_datetime"].isoformat()
            if trade["entry_datetime"]
            else None
        ),
        "exit_datetime": (
            trade["exit_datetime"].isoformat()
            if trade["exit_datetime"]
            else None
        ),
        "user_id": user_id,
    }


def load_calendar_metrics_batch_from_supabase(
    user_id: str,
    token: str,
    account_id: int,
    month_start: date,
    next_month_start: date,
    offset: int = 0,
    batch_size: int = 1000,
):
    client = get_authenticated_client(token)
    end = offset + batch_size - 1

    query = (
        client
        .table("trades")
        .select("pnl,result,entry_datetime")
        .eq("user_id", user_id)
        .eq("account_id", account_id)
        .gte("entry_datetime", month_start.isoformat())
        .lt("entry_datetime", next_month_start.isoformat())
        .order(
            "entry_datetime",
            desc=False,
            nullsfirst=False,
        )
        .range(offset, end)
    )

    response = execute_query(query)
    return response.data


def save_trade_to_supabase(
    trade,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)
    new_trade = _build_trade_data(trade, user_id)

    response = execute_query(
        client
        .table("trades")
        .insert(new_trade)
    )

    saved_trade = response.data[0]

    return [
        saved_trade["id"],
        saved_trade["symbol"],
        saved_trade["direction"],
        float(saved_trade["entry"]),
        (
            float(saved_trade["stop"])
            if saved_trade["stop"] is not None
            else None
        ),
        float(saved_trade["exit"]),
        (
            float(saved_trade["result"])
            if saved_trade["result"] is not None
            else None
        ),
        float(saved_trade["pnl"]),
    ]


def save_trades_to_supabase(
    trades,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)
    new_trades = [
        _build_trade_data(trade, user_id)
        for trade in trades
    ]

    response = execute_query(
        client
        .table("trades")
        .insert(new_trades)
    )

    return response.data


def delete_trade_from_supabase(
    trade_id,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    response = execute_query(
        client
        .table("trades")
        .delete()
        .eq("id", trade_id)
        .eq("user_id", user_id)
    )

    if not response.data:
        raise ResourceNotFoundError(
            "Trade not found"
        )

    return response


def update_trade_in_supabase(
    trade_id,
    updated_trade,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    trade_data = {
        "symbol": updated_trade["symbol"],
        "direction": updated_trade["direction"],
        "entry": updated_trade["entry"],
        "stop": updated_trade["stop"],
        "exit": updated_trade["exit"],
        "result": updated_trade["result"],
        "pnl": updated_trade["pnl"],
        "entry_datetime": (
            updated_trade["entry_datetime"].isoformat()
            if updated_trade["entry_datetime"]
            else None
        ),
        "exit_datetime": (
            updated_trade["exit_datetime"].isoformat()
            if updated_trade["exit_datetime"]
            else None
        ),
    }

    response = execute_query(
        client
        .table("trades")
        .update(trade_data)
        .eq("id", trade_id)
        .eq("user_id", user_id)
    )

    if not response.data:
        raise ResourceNotFoundError(
            "Trade not found"
        )

    return response


def load_accounts_from_supabase(
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    response = execute_query(
        client
        .table("accounts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")
    )

    return response.data


def account_belongs_to_user(
    account_id: int,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    response = execute_query(
        client
        .table("accounts")
        .select("id")
        .eq("id", account_id)
        .eq("user_id", user_id)
    )

    return bool(response.data)


def save_account_to_supabase(
    account,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    data = {
        "user_id": user_id,
        "name": account["name"],
        "starting_balance": account["starting_balance"],
        "currency": account["currency"],
        "broker": account.get("broker"),
        "account_type": account.get("account_type"),
    }

    response = execute_query(
        client
        .table("accounts")
        .insert(data)
    )

    return response.data


def update_account_in_supabase(
    account_id: int,
    account,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    data = {
        "name": account["name"],
        "starting_balance": account["starting_balance"],
        "currency": account["currency"],
        "broker": account.get("broker"),
        "account_type": account.get("account_type"),
    }

    response = execute_query(
        client
        .table("accounts")
        .update(data)
        .eq("id", account_id)
        .eq("user_id", user_id)
    )

    if not response.data:
        raise ResourceNotFoundError(
            "Account not found"
        )

    return response.data


def delete_account_from_supabase(
    account_id: int,
    user_id: str,
    token: str,
):
    client = get_authenticated_client(token)

    response = execute_query(
        client
        .table("accounts")
        .delete()
        .eq("id", account_id)
        .eq("user_id", user_id)
    )

    if not response.data:
        raise ResourceNotFoundError(
            "Account not found"
        )

    return response.data
