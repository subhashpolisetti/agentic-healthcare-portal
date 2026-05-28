import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents import intake_agent
from app.services.groq_client import chat_stream

log = logging.getLogger(__name__)

router = APIRouter(prefix="/agents/intake", tags=["intake"])


class NextQuestionRequest(BaseModel):
    symptoms: str
    history: list[dict] = []   # [{"question": "...", "answer": "..."}, ...]


class IntakeRequest(BaseModel):
    symptoms: str
    patient_zip: str = ""
    patient_age: int = 0
    patient_gender: str = ""
    radius_miles: int = 75


_FALLBACK_QUESTIONS = [
    "How long have you been experiencing this, and did it start suddenly or gradually?",
    "On a scale of 1 to 10, how would you rate the severity right now?",
    "Have you noticed anything that makes it better or worse — like rest, activity, or food?",
    "Are you experiencing any other symptoms alongside this, such as fever, fatigue, or nausea?",
    "Have you seen a doctor for this before, or tried any medications or treatments?",
]

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",    # prevents nginx from buffering the SSE stream
    "Access-Control-Allow-Origin": "*",
}


@router.post("/stream-question")
async def stream_question(req: NextQuestionRequest):
    """
    SSE endpoint — streams question tokens from Groq in real time.

    Event protocol:
      event: status   data: {"done": bool, "question_number": int}
      event: token    data: "<text fragment>"
      event: end      data: {"question": "<full accumulated text>"}
    """
    n = len(req.history)
    # L1: single source of truth for done-heuristic lives in intake_agent.is_intake_done()
    is_done = intake_agent.is_intake_done(n, req.history)

    async def generate():
        if is_done:
            yield f"event: status\ndata: {json.dumps({'done': True, 'question_number': n + 1})}\n\n"
            yield f"event: end\ndata: {{}}\n\n"
            return

        yield f"event: status\ndata: {json.dumps({'done': False, 'question_number': n + 1})}\n\n"

        history_text = (
            "\n".join(
                f"Q{i+1}: {h['question']}\nPatient: {h['answer']}"
                for i, h in enumerate(req.history)
            )
            if req.history
            else "None yet."
        )

        system_prompt = (
            "You are a skilled medical intake nurse. Ask ONE question that will most help "
            "determine the RIGHT specialist for this patient. Think clinically.\n\n"
            "Adapt to the symptom type:\n"
            "- Pain → character (sharp/dull/pressure/burning), radiation, what worsens or relieves it\n"
            "- Skin → appearance (color, texture, blistering, spreading pattern), itch level\n"
            "- Respiratory → rest vs exertion, cough type, fever, wheezing\n"
            "- Mental health → specific triggers, sleep quality, impact on daily function\n"
            "- Digestive → relation to meals, bowel changes, nausea\n"
            "- Cardiac → exertion vs rest, radiation to arm or jaw, sweating, palpitations\n"
            "- Neurological → headache location, vision changes, numbness, weakness pattern\n\n"
            "Rules:\n"
            "- ONE complete natural sentence — warm, caring, conversational\n"
            "- NEVER ask 'rate 1-10' if severity is already known from the patient's answers\n"
            "- NEVER repeat a topic already covered — read the history carefully\n"
            "- Do NOT follow a fixed template. Ask what is most clinically useful right now.\n"
            "- Output ONLY the question text. No JSON, no labels, no preamble."
        )
        user_message = (
            f"Patient symptoms: {req.symptoms}\n\n"
            f"Conversation so far:\n{history_text}\n\n"
            f"What is the single most clinically useful question to ask next (question {n + 1})?"
        )

        accumulated = ""
        try:
            for token in chat_stream(system_prompt, user_message, max_tokens=120):
                accumulated += token
                yield f"event: token\ndata: {json.dumps(token)}\n\n"
        except Exception as e:
            log.error("[SSE] chat_stream failed: %s", e)
            fallback = _FALLBACK_QUESTIONS[min(n, 4)]
            for word in fallback.split():
                frag = word + " "
                accumulated += frag
                yield f"event: token\ndata: {json.dumps(frag)}\n\n"

        yield f"event: end\ndata: {json.dumps({'question': accumulated.strip()})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/next-question")
async def get_next_question(req: NextQuestionRequest):
    """
    Returns the next contextual question (or done=true when agent has enough info).
    LLM decides: min 2 questions, max 5, adapts based on answer quality.
    """
    try:
        result = intake_agent.get_next_question(req.symptoms, req.history)
        return {
            "question": result["question"],
            "done": result["done"],
            "question_number": len(req.history) + 1,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_intake(req: IntakeRequest):
    try:
        result = intake_agent.run(
            symptoms=req.symptoms,
            patient_zip=req.patient_zip,
            patient_age=req.patient_age,
            patient_gender=req.patient_gender,
            radius_miles=req.radius_miles,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
