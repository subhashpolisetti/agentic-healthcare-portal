from fastapi import APIRouter, HTTPException, Query
from app.services.chroma_client import embed, get_doctors_collection

router = APIRouter(prefix="/doctors/nppes", tags=["admin-nppes"])


@router.get("/lookup")
async def lookup_by_npi(npi: str = Query(..., min_length=10, max_length=10)):
    """Exact NPI lookup via ChromaDB metadata filter."""
    try:
        collection = get_doctors_collection()
        results = collection.get(
            where={"npi": npi},
            include=["documents", "metadatas"],
            limit=1,
        )
        if not results["ids"]:
            raise HTTPException(status_code=404, detail=f"No NPPES doctor found with NPI {npi}")
        return _to_doctor_dto(results["metadatas"][0], results["documents"][0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_doctors(
    name: str | None = Query(None),
    state: str | None = Query(None),
    city: str | None = Query(None),
    specialty: str | None = Query(None),
    top_k: int = Query(10, ge=1, le=50),
):
    """Vector search by name/location/specialty for doctors who may not know their NPI."""
    if not any([name, state, city, specialty]):
        raise HTTPException(status_code=400, detail="At least one search parameter required")

    try:
        collection = get_doctors_collection()

        parts = [p for p in [name, specialty, city, state] if p]
        query_text = " ".join(parts)
        query_embedding = embed(query_text)

        where_filter = None
        if state and city:
            where_filter = {"$and": [{"state": state.upper()}, {"city": city.upper()}]}
        elif state:
            where_filter = {"state": state.upper()}
        elif city:
            where_filter = {"city": city.upper()}

        kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if where_filter:
            kwargs["where"] = where_filter

        results = collection.query(**kwargs)

        doctors = [
            _to_doctor_dto(meta, doc, score=round(1 - dist, 3))
            for meta, doc, dist in zip(
                results["metadatas"][0],
                results["documents"][0],
                results["distances"][0],
            )
        ]
        return {"doctors": doctors, "query": query_text, "count": len(doctors)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _to_doctor_dto(meta: dict, doc: str, score: float | None = None) -> dict:
    result = {
        "npi": meta.get("npi", ""),
        "doctor_name": meta.get("doctor_name", "Unknown"),
        "specialty": meta.get("specialty", ""),
        "credential": meta.get("credential", ""),
        "city": meta.get("city", ""),
        "state": meta.get("state", ""),
        "zip": meta.get("zip", ""),
        "phone": meta.get("phone", ""),
        "document": doc,
    }
    if score is not None:
        result["score"] = score
    return result
