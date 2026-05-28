from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chroma_client import embed, get_doctors_collection
from app.services.groq_client import chat
from app.services.scoring import normalize_match_score

router = APIRouter(prefix="/match", tags=["matching"])


class SymptomRequest(BaseModel):
    symptoms: str
    top_k: int = 5
    patient_zip: str | None = None
    patient_age: int | None = None


class RecommendationRequest(BaseModel):
    symptoms: str
    top_k: int = 5


@router.post("/symptoms")
async def match_symptoms(req: SymptomRequest):
    try:
        collection = get_doctors_collection()
        query_embedding = embed(req.symptoms)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=req.top_k,
            include=["documents", "metadatas", "distances"],
        )

        doctors = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            doctors.append({
                "doctor_name": meta.get("doctor_name", "Unknown"),
                "npi": meta.get("npi", ""),
                "speciality": meta.get("specialty", "General Practice"),
                "credential": meta.get("credential", ""),
                "city": meta.get("city", ""),
                "state": meta.get("state", ""),
                "zip": meta.get("zip", ""),
                "phone": meta.get("phone", ""),
                "score": normalize_match_score(1 - dist),
                "document": doc,
            })

        return {"doctors": doctors, "symptoms": req.symptoms}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendation")
async def get_recommendation(req: RecommendationRequest):
    try:
        collection = get_doctors_collection()
        query_embedding = embed(req.symptoms)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=req.top_k,
            include=["documents", "metadatas"],
        )

        doctor_summaries = "\n".join(results["documents"][0][:3])

        recommendation = chat(
            system_prompt=(
                "You are an AI healthcare assistant. Based on the patient's symptoms "
                "and the available doctors, provide a brief, helpful recommendation. "
                "Be concise (3-4 sentences). Do not diagnose — only suggest which type "
                "of specialist to see and why."
            ),
            user_message=f"Patient symptoms: {req.symptoms}\n\nAvailable doctors:\n{doctor_summaries}",
            max_tokens=256,
        )

        return {"recommendation": recommendation, "symptoms": req.symptoms}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
