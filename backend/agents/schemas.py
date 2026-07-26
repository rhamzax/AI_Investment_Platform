from pydantic import BaseModel, Field


class BullBearOutput(BaseModel):
    """Structured output for the Bull/Bear nodes — mirrors theses columns.

    Use with `llm.with_structured_output(BullBearOutput)` so the model's
    response comes back as this type instead of raw text.
    """

    thesis: str = Field(description="The full argument, a few paragraphs.")
    key_points: list[str] = Field(description="3-5 bullet-point takeaways.")
    sources: list[str] = Field(
        description="Which raw_data sources were used, e.g. ['sec_edgar', 'fred']."
    )


class JudgeOutput(BaseModel):
    """Structured output for the Judge node — mirrors memos columns."""

    verdict: str = Field(description="One of: bullish, bearish, neutral.")
    confidence: float = Field(description="0.0 to 1.0.")
    summary: str = Field(description="A short paragraph explaining the verdict.")
