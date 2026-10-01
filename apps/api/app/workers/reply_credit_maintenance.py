from datetime import datetime

from app.db.session import AsyncSessionLocal
from app.services.reply_credit_service import recover_due_credit_accounts


async def recover_due_reply_credits(now: datetime, *, limit: int = 25) -> int:
    async with AsyncSessionLocal() as session:
        return await recover_due_credit_accounts(session, now=now, limit=limit)
