import yfinance as yf


def resolve_ticker(ticker: str) -> tuple[bool, str | None]:
    """Lenient ticker validation: confirm yfinance can resolve real company
    info for it. Works for any exchange yfinance covers (NASDAQ, NYSE, etc.),
    not just a maintained NASDAQ symbol list.

    Returns (is_valid, company_name).
    """
    try:
        info = yf.Ticker(ticker).info or {}
    except Exception:
        return False, None

    name = info.get("longName") or info.get("shortName")
    if not name:
        return False, None
    return True, name
