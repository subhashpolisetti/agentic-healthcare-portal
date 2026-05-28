from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/location", tags=["location"])


@router.post("/reverse-zip")
async def reverse_zip(lat: float, lon: float):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "AIHealthcarePortal/1.0"},
            )
            data = resp.json()
            address = data.get("address", {})
            zip_code = address.get("postcode", "")
            return {"zip_code": zip_code, "city": address.get("city", address.get("town", "")), "state": address.get("state", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
