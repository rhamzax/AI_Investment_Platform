import os

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel


def get_agent_llm() -> BaseChatModel:
    """The model every Bull/Bear/Judge node uses — the one place to swap it.

    Currently wired to Gemini. To swap providers, change this one call,
    e.g. back to Anthropic via get_llm("anthropic:claude-sonnet-5").
    """
    return get_llm(
        "gemini-3.5-flash-lite",
        model_provider="google_genai",
        api_key=os.environ["GEMINI_API_KEY"],
    )


def get_llm(model: str, **kwargs) -> BaseChatModel:
    """Return a configured LangChain chat model for any supported provider.

    `model` uses LangChain's "provider:model_name" convention, e.g.:
      - get_llm("anthropic:claude-sonnet-5")
      - get_llm("openai:gpt-4o")

    For OpenAI-compatible-but-not-OpenAI providers (e.g. Kimi/Moonshot),
    pass model_provider="openai" plus a base_url/api_key override — kwargs
    are forwarded straight to the underlying model class:
      get_llm("moonshot-v1-8k", model_provider="openai",
              base_url="https://api.moonshot.ai/v1",
              api_key=os.environ["KIMI_API_KEY"])

    This is the single place provider selection happens — nodes should call
    get_llm(...) rather than importing a provider SDK directly, so swapping
    models later is a one-line change here instead of edits across agents/.
    """
    return init_chat_model(model, **kwargs)
