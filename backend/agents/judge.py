from agents.llm import get_agent_llm
from agents.prompts import JUDGE_SYSTEM_PROMPT
from agents.schemas import JudgeOutput
from agents.state import ThesisState
from db.client import get_client


def judge_node(state: ThesisState) -> dict:
    """Weigh state["bull_thesis"] vs state["bear_thesis"] and produce a verdict."""
    llm = get_agent_llm().with_structured_output(JudgeOutput)
    output: JudgeOutput = llm.invoke(
        [
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Ticker: {state['ticker']}\n\n"
                    f"Bull thesis:\n{state['bull_thesis']}\n\n"
                    f"Bear thesis:\n{state['bear_thesis']}"
                ),
            },
        ]
    )

    get_client().table("memos").insert(
        {
            "ticker": state["ticker"],
            "run_id": state["run_id"],
            "verdict": output.verdict,
            "confidence": output.confidence,
            "summary": output.summary,
            "bull_thesis_id": state["bull_thesis_id"],
            "bear_thesis_id": state["bear_thesis_id"],
        }
    ).execute()

    return {"verdict": output.verdict}
