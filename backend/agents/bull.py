import json

from agents.llm import get_agent_llm
from agents.prompts import BULL_SYSTEM_PROMPT
from agents.schemas import BullBearOutput
from agents.state import ThesisState
from db.client import get_client


def bull_node(state: ThesisState) -> dict:
    """Argue the bull case for state["ticker"] using state["raw_data"]."""
    llm = get_agent_llm().with_structured_output(BullBearOutput)
    output: BullBearOutput = llm.invoke(
        [
            {"role": "system", "content": BULL_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Ticker: {state['ticker']}\n\n"
                    f"Research data:\n{json.dumps(state['raw_data'], default=str)}"
                ),
            },
        ]
    )

    row = (
        get_client()
        .table("theses")
        .insert(
            {
                "ticker": state["ticker"],
                "run_id": state["run_id"],
                "stance": "bull",
                "thesis": output.thesis,
                "key_points": output.key_points,
                "sources": output.sources,
            }
        )
        .execute()
    )

    return {"bull_thesis": output.thesis, "bull_thesis_id": row.data[0]["id"]}
