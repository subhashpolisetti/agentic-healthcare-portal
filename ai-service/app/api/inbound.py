import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import inbound_agent

log = logging.getLogger(__name__)
router = APIRouter(tags=["inbound"])


class InboundClassifyRequest(BaseModel):
    message_id:   int
    from_address: str
    body:         str


@router.post("/agents/inbound/classify")
async def classify_inbound(req: InboundClassifyRequest):
    try:
        result = inbound_agent.run(
            message_id=req.message_id,
            from_address=req.from_address,
            body=req.body,
        )
        return result
    except Exception as e:
        log.error("[Inbound] Classification error for message %d: %s", req.message_id, e)
        raise HTTPException(status_code=500, detail=str(e))
