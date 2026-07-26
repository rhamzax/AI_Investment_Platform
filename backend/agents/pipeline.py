import uuid

from agents.graph import build_graph
from ingestion import fetch_all

_graph = build_graph()


def generate_thesis(ticker: str) -> None:
    """Single entrypoint: fetch data, run the Bull/Bear/Judge graph."""
    raw_data = fetch_all(ticker)
    initial_state = {
        "ticker": ticker,
        "run_id": str(uuid.uuid4()),
        "raw_data": raw_data,
    }
    _graph.invoke(initial_state)
