from typing import Any, TypedDict


class ThesisState(TypedDict):
    """Shared state threaded through the Bull -> Bear -> Judge graph.

    Each node reads what it needs and returns a dict of the keys it wants to
    update; LangGraph merges that into this state before the next node runs.
    """

    ticker: str
    run_id: str

    # Output of ingestion.fetch_all(ticker) — {source_name: data_or_None}
    raw_data: dict[str, Any]

    # Populated by bull_node
    bull_thesis: str
    bull_thesis_id: str

    # Populated by bear_node
    bear_thesis: str
    bear_thesis_id: str

    # Populated by judge_node
    verdict: str
