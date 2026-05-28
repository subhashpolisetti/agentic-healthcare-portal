"""
HRSA Health Professional Shortage Area (HPSA) lookup service.
Embedded CA HPSA zip codes — primary care shortage areas.
Source: HRSA HPSA designations for California rural/underserved counties.
"""

# Primary care HPSA-designated zip codes for California rural counties
_PRIMARY_CARE_SHORTAGE_ZIPS: set[str] = {
    # Modoc County (far northeast CA)
    "96101", "96108", "96112", "96115", "96116", "96121",
    # Trinity County
    "96091", "96093", "96041", "96040",
    # Lassen County
    "96068", "96130", "96137",
    # Plumas County
    "95947", "95915", "95971", "95983",
    # Del Norte County
    "95531", "95543", "95548",
    # Siskiyou County
    "96001", "96014", "96023", "96025", "96034", "96038",
    "96044", "96055", "96085", "96094", "96097",
    # Alpine County
    "96120",
    # Inyo County
    "93522", "93526", "93529", "93541", "93545", "93549", "93562",
    # Kings County
    "93230", "93239", "93266",
    # Imperial County (US-Mexico border)
    "92231", "92232", "92233", "92234", "92243", "92249",
    "92250", "92251", "92257", "92259", "92266", "92281", "92283",
    # Tulare County (rural)
    "93218", "93219", "93238", "93261", "93262", "93265",
    "93267", "93271", "93276",
    # Glenn County
    "95912", "95916", "95921", "95943", "95950", "95963",
    # Colusa County
    "95932", "95935", "95979", "95987",
    # Tehama County (rural)
    "96016", "96020", "96021", "96029", "96032", "96058",
    "96059", "96061", "96065", "96074", "96075", "96076",
}

# Mental health shortage — broader, affects more rural CA zip prefixes
_MENTAL_HEALTH_SHORTAGE_ZIP_PREFIXES: set[str] = {
    "961", "960",  # Far north CA (Shasta, Siskiyou, Modoc)
    "959", "958",  # Northeast CA (Plumas, Lassen)
    "936", "935",  # Central valley rural
    "922", "923",  # Imperial / desert areas
}


def check_shortage(zip_code: str) -> dict:
    """
    Returns shortage area status for a given zip code.
    Checks primary care HPSA first, then mental health prefix.
    """
    if not zip_code or len(zip_code) < 5:
        return {"is_shortage": False, "shortage_type": "", "description": ""}

    zip5 = zip_code[:5]
    zip3 = zip_code[:3]

    if zip5 in _PRIMARY_CARE_SHORTAGE_ZIPS:
        return {
            "is_shortage": True,
            "shortage_type": "primary_care",
            "description": (
                f"ZIP {zip5} is in a federally designated Primary Care "
                "Health Professional Shortage Area (HPSA). "
                "83M Americans face similar access barriers. "
                "Telehealth options are available."
            ),
        }

    if zip3 in _MENTAL_HEALTH_SHORTAGE_ZIP_PREFIXES:
        return {
            "is_shortage": True,
            "shortage_type": "mental_health",
            "description": (
                f"ZIP {zip5} is in a region with limited mental health providers. "
                "Telehealth mental health services may reduce your wait time."
            ),
        }

    return {"is_shortage": False, "shortage_type": "", "description": ""}
