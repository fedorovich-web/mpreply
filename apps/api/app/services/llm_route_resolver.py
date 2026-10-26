from __future__ import annotations


def select_reply_model(message_type: str, rating: int | None) -> str:
    if message_type == "review":
        return "anthropic/claude-sonnet-5.5" if rating is not None and rating <= 2 else "deepseek/deepseek-v4.1-flash"
    if message_type == "question":
        return "openai/gpt-6-luna"
    if message_type == "chat":
        return "google/gemini-3.8-flash"
    raise ValueError("Unsupported message type for AI reply generation")
