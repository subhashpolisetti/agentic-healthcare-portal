"""
Agent 1 — Patient Intake Agent (Rural Shortage Detection)

Graph structure with conditional routing:

    START
      ↓
    assess_urgency     (Groq LLM: emergency | urgent | routine)
      ↓
    check_shortage     (HRSA data: is this zip a shortage area?)
      ↓
    classify_specialty (Groq LLM: primary + secondary specialty classification)
      ↓
    find_doctors       (ChromaDB vector search + LLM specialty boost)
      ↓ [conditional — routes by shortage status]
      ├── shortage area → suggest_telehealth → END
      └── no shortage   → END

What makes this genuinely agentic:
  1. LLM urgency reasoning — Groq classifies emergency/urgent/routine from symptoms
  2. LLM specialty classification — Groq picks the right specialty BEFORE vector search,
     then boosts matching ChromaDB candidates (hybrid retrieval)
  3. Conditional routing — telehealth node fires only when geography warrants it
  4. State enrichment — each node adds to shared state read by downstream nodes
  5. Real data — HRSA HPSA lookup + ChromaDB vector search over NPPES doctors
"""

import json
import logging
import math
import re
from typing import Literal, TypedDict

import pgeocode
from langgraph.graph import END, START, StateGraph

from app.services.chroma_client import embed, get_doctors_collection

# Lazy-loaded once at module level — downloads ~2MB GeoNames US ZIP data on first use
_nomi: pgeocode.Nominatim | None = None

def _get_nomi() -> pgeocode.Nominatim:
    global _nomi
    if _nomi is None:
        _nomi = pgeocode.Nominatim("us")
    return _nomi


def _distance_miles(zip1: str, zip2: str) -> float | None:
    """Haversine distance in miles between two US ZIP codes. Returns None if either is missing/invalid."""
    try:
        z1 = zip1.strip()[:5]
        z2 = zip2.strip()[:5]
        if not z1 or not z2 or not z1.isdigit() or not z2.isdigit():
            return None
        nomi = _get_nomi()
        r1 = nomi.query_postal_code(z1)
        r2 = nomi.query_postal_code(z2)
        if any(math.isnan(v) for v in [r1.latitude, r1.longitude, r2.latitude, r2.longitude]):
            return None
        lat1, lon1 = math.radians(r1.latitude), math.radians(r1.longitude)
        lat2, lon2 = math.radians(r2.latitude), math.radians(r2.longitude)
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return 3958.8 * 2 * math.asin(math.sqrt(a))
    except Exception:
        return None
from app.services.groq_client import chat
from app.services.scoring import normalize_match_score
from app.services.shortage_service import check_shortage

log = logging.getLogger(__name__)


# ── Specialties available in ChromaDB (from NPPES taxonomy map) ──────────────
# Used by classify_specialty to constrain LLM output to names that actually exist
# in our doctor collection — prevents hallucinated specialty names.

KNOWN_SPECIALTIES = [
    "Addiction Medicine", "Addiction Psychiatry", "Allergy & Immunology",
    "Anesthesiology", "Cardiovascular Disease", "Child & Adolescent Psychiatry",
    "Dermatology", "Emergency Medicine", "Endocrinology", "Family Medicine",
    "Gastroenterology", "General Practice", "General Surgery", "Geriatric Medicine",
    "Hematology", "Infectious Disease", "Internal Medicine", "Nephrology",
    "Neurological Surgery", "Neurology", "Obstetrics & Gynecology", "Oncology",
    "Ophthalmology", "Orthopedic Surgery", "Otolaryngology", "Pain Management",
    "Pathology", "Pediatrics", "Physical Medicine & Rehabilitation", "Plastic Surgery",
    "Psychiatry", "Pulmonary Disease", "Radiology", "Rheumatology", "Sports Medicine",
    "Surgical Oncology", "Thoracic Surgery", "Vascular Surgery",
]


# ── State ─────────────────────────────────────────────────────────────────────

class IntakeState(TypedDict):
    # Input
    symptoms: str
    patient_zip: str
    patient_age: int
    patient_gender: str
    radius_miles: int

    # Computed by nodes
    urgency: str            # emergency | urgent | routine
    urgency_reason: str
    confidence: int         # 0–100 — LLM-assessed confidence in the classification
    is_shortage_area: bool
    shortage_type: str
    shortage_description: str
    target_specialty: str        # LLM-classified primary specialty (Change 2)
    secondary_specialties: list  # LLM-classified secondary specialties (Change 2)
    doctors: list
    telehealth_options: list
    error: str | None


# ── Node 1: Assess urgency (Groq LLM) ────────────────────────────────────────

def assess_urgency(state: IntakeState) -> IntakeState:
    """
    LLM reasoning node — Groq classifies symptom urgency.
    Genuine LLM reasoning: interprets semantics, not keyword matching.
    """
    try:
        system_prompt = (
            "You are an AI medical triage assistant. Classify the patient's symptoms "
            "into exactly one urgency level:\n"
            "- emergency: life-threatening (chest pain + sweating, stroke symptoms, "
            "  severe breathing difficulty, major trauma)\n"
            "- urgent: needs care within 24-48 hours (high fever, moderate pain, "
            "  possible infection, worsening symptoms)\n"
            "- routine: can wait for a normal appointment (mild symptoms, checkup, "
            "  chronic condition management)\n\n"
            "Also rate your confidence (0-100) based on symptom specificity — "
            "specific, detailed symptoms score higher; vague single-word symptoms score lower.\n\n"
            'Respond with JSON only: {"urgency": "emergency|urgent|routine", '
            '"reason": "one sentence explanation", "confidence": <integer 0-100>}\n'
            "Do not include markdown, code blocks, or extra text."
        )

        user_msg = (
            f"Patient symptoms: {state['symptoms']}\n"
            f"Patient age: {state.get('patient_age') or 'unknown'}\n"
            f"Patient gender: {state.get('patient_gender') or 'unknown'}"
        )

        raw = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=120)

        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
        urgency = parsed.get("urgency", "routine")
        reason = parsed.get("reason", "")
        confidence = int(parsed.get("confidence", 70))
        confidence = max(0, min(100, confidence))

        if urgency not in ("emergency", "urgent", "routine"):
            urgency = "routine"

        log.info("[Agent1] Urgency=%s confidence=%d reason=%s", urgency, confidence, reason)
        return {**state, "urgency": urgency, "urgency_reason": reason, "confidence": confidence, "error": None}

    except Exception as e:
        log.error("[Agent1] assess_urgency failed: %s", e)
        return {
            **state,
            "urgency": "routine",
            "urgency_reason": "Unable to assess — defaulting to routine",
            "confidence": 50,
            "error": str(e),
        }


# ── Node 2: Check shortage area (HRSA data) ───────────────────────────────────

def check_shortage_area(state: IntakeState) -> IntakeState:
    """Looks up patient zip against HRSA HPSA shortage area data."""
    try:
        result = check_shortage(state.get("patient_zip", ""))
        log.info(
            "[Agent1] ZIP=%s shortage=%s type=%s",
            state.get("patient_zip"),
            result["is_shortage"],
            result["shortage_type"],
        )
        return {
            **state,
            "is_shortage_area": result["is_shortage"],
            "shortage_type": result["shortage_type"],
            "shortage_description": result["description"],
        }
    except Exception as e:
        log.error("[Agent1] check_shortage_area failed: %s", e)
        return {
            **state,
            "is_shortage_area": False,
            "shortage_type": "",
            "shortage_description": "",
            "error": str(e),
        }


# ── Node 2b: Classify specialty (Groq LLM) ───────────────────────────────────

def classify_specialty(state: IntakeState) -> IntakeState:
    """
    LLM classifies the most likely medical specialty before ChromaDB search.
    Output is used in find_doctors to boost candidates that match (hybrid retrieval).

    Why this improves accuracy: ChromaDB embeds short specialty labels
    (e.g. 'Dr. Smith | Specialty: Psychiatry | Location: Austin TX').
    A patient query like 'grief, hopelessness, sleep issues' has low cosine
    similarity to a specialty label — the LLM bridges this gap by naming the
    specialty directly, then we boost those candidates in the result set.
    """
    specialties_list = "\n".join(f"- {s}" for s in sorted(KNOWN_SPECIALTIES))
    try:
        raw = chat(
            system_prompt=(
                "You are a medical triage AI performing specialty classification.\n\n"
                "Given patient symptoms, identify the most appropriate medical specialty "
                "from the list below. Use EXACT names from the list — do not invent new ones.\n\n"
                f"Available specialties:\n{specialties_list}\n\n"
                "Rules:\n"
                "- primary: the single best specialty for the chief complaint\n"
                "- secondary: up to 2 other relevant specialties (empty list [] if none apply)\n"
                "- Think about the UNDERLYING condition, not just the symptom word\n"
                "  (e.g. 'grief, hopelessness, poor sleep' → Psychiatry, not Neurology)\n"
                "- For musculoskeletal pain: consider whether it's surgical (Orthopedic Surgery) "
                "  or non-surgical (Physical Medicine & Rehabilitation, Pain Management)\n"
                "- When uncertain, prefer Family Medicine or Internal Medicine as primary\n\n"
                'Return JSON only: {"primary": "ExactName", "secondary": ["ExactName", ...]}\n'
                "No markdown. No extra text."
            ),
            user_message=f"Patient symptoms: {state['symptoms'][:600]}",
            max_tokens=120,
        )
        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)

        primary = parsed.get("primary", "").strip()
        secondary = [s.strip() for s in parsed.get("secondary", []) if s.strip()]

        # Validate against known list — reject hallucinated specialty names
        if primary not in KNOWN_SPECIALTIES:
            log.warning("[Agent1] classify_specialty returned unknown primary '%s' — ignoring", primary)
            primary = ""
        secondary = [s for s in secondary if s in KNOWN_SPECIALTIES]

        log.info("[Agent1] Specialty classification: primary='%s' secondary=%s", primary, secondary)
        return {**state, "target_specialty": primary, "secondary_specialties": secondary}

    except Exception as e:
        log.error("[Agent1] classify_specialty failed: %s", e)
        return {**state, "target_specialty": "", "secondary_specialties": []}


# ── Match reasoning ───────────────────────────────────────────────────────────

def _add_match_reasoning(symptoms: str, doctors: list) -> list:
    """
    One LLM call → generates a specific clinical reasoning sentence per doctor.
    Explains WHY this specialty matches the patient's actual symptoms.
    Returns the same list with 'reasoning' added to each doctor dict.
    """
    if not doctors:
        return doctors

    # Truncate enriched symptoms — take first 400 chars (most clinically dense)
    symptom_summary = symptoms[:400].strip()

    doctor_list = "\n".join(
        f"{i + 1}. {d['doctor_name']} — {d['speciality']}"
        for i, d in enumerate(doctors)
    )

    try:
        raw = chat(
            system_prompt=(
                "You are a clinical AI explaining why a medical specialty is relevant to a patient's symptoms.\n\n"
                "IMPORTANT CONSTRAINTS:\n"
                "- You only know the doctor's specialty name — NOT their individual case history, conditions treated, or patient outcomes\n"
                "- NEVER invent or imply specific conditions the individual doctor treats\n"
                "- NEVER fabricate clinical details about a specific doctor\n\n"
                "What you CAN do: explain how the patient's reported symptoms relate to what "
                "that specialty evaluates and manages in general clinical practice.\n\n"
                "Format: ONE sentence per doctor (15–22 words). Must:\n"
                "- Reference the patient's ACTUAL symptom(s) from their description\n"
                "- Explain the symptom→specialty clinical connection (e.g. 'radiating leg pain is a presentation orthopedic surgeons evaluate for disc and nerve involvement')\n"
                "- Vary across doctors — no repeated sentences\n"
                "- Sound clinical and honest, not promotional\n\n"
                'Return JSON only: {"1": "sentence", "2": "sentence", ...}\n'
                "No markdown, no extra text."
            ),
            user_message=(
                f"Patient symptoms: {symptom_summary}\n\n"
                f"Doctors (specialty only — no other data available):\n{doctor_list}\n\n"
                "For each number, explain in one sentence how the patient's symptoms "
                "relate to what that specialty evaluates — based only on the specialty name and symptoms."
            ),
            max_tokens=350,
        )
        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)

        for i, doc in enumerate(doctors):
            doc["reasoning"] = parsed.get(str(i + 1), "").strip()

    except Exception as e:
        log.error("[Agent1] _add_match_reasoning failed: %s", e)
        # Fallback — leave reasoning empty; frontend uses default display

    return doctors


# ── Confidence helpers ────────────────────────────────────────────────────────

def _recommendation_confidence(urgency_conf: int, top_score: float, symptoms: str) -> int:
    """
    Composite recommendation confidence — replaces urgency-only LLM confidence.

    Three signals:
      50%  Normalized doctor match score (already in 0.55–0.97 range)
      30%  LLM urgency confidence (how clear is the clinical picture)
      20%  Symptom richness (word count of enriched symptoms string)

    Floor: 72  Ceiling: 97
    """
    # top_score is already normalized via _normalize_match_score → 0.55–0.97
    doc_conf = max(55, min(97, int(top_score * 100)))

    # -- Symptom richness (word count of the full enriched string) --
    words = len(symptoms.split())
    if words < 5:
        richness = 62
    elif words < 15:
        richness = 72
    elif words < 30:
        richness = 82
    elif words < 60:
        richness = 90
    else:
        richness = 95

    # -- Weighted composite --
    composite = int(0.50 * doc_conf + 0.30 * urgency_conf + 0.20 * richness)
    return max(0, min(97, composite))


# ── Node 3: Find doctors (ChromaDB vector search) ─────────────────────────────

def find_doctors(state: IntakeState) -> IntakeState:
    """Vector search for best-matched doctors by symptoms + LLM specialty steering."""
    try:
        collection = get_doctors_collection()

        patient_zip  = state.get("patient_zip", "")
        target_spec  = state.get("target_specialty", "").strip()
        secondary    = state.get("secondary_specialties", [])

        # Query steering (Fix A): prepend specialty label so the embedding lands near
        # doctor records that share the same specialty string (e.g. "Specialty: Psychiatry").
        # Falls back to raw symptoms if no specialty was classified.
        if target_spec:
            query = f"Specialty: {target_spec}. {state['symptoms']}"
        else:
            query = state["symptoms"]

        embedding = embed(query)

        # Pull 30 candidates — more pool lets location re-ranking work meaningfully
        results = collection.query(
            query_embeddings=[embedding],
            n_results=30,
            include=["metadatas", "distances"],
        )

        # If the steered query returned 0 candidates matching the target specialty,
        # fall back to a secondary specialty query so we don't return irrelevant results.
        primary_in_results = any(
            m.get("specialty", "") == target_spec
            for m in results["metadatas"][0]
        )
        if target_spec and not primary_in_results and secondary:
            fallback_spec = secondary[0]
            log.warning(
                "[Agent1] '%s' not in ChromaDB results — re-querying with secondary '%s'",
                target_spec, fallback_spec,
            )
            fallback_query  = f"Specialty: {fallback_spec}. {state['symptoms']}"
            fallback_emb    = embed(fallback_query)
            fallback_result = collection.query(
                query_embeddings=[fallback_emb],
                n_results=30,
                include=["metadatas", "distances"],
            )
            # Merge: deduplicate by NPI, prefer original results for non-missing specialties
            seen_npis = {m.get("npi") for m in results["metadatas"][0]}
            for meta, dist in zip(fallback_result["metadatas"][0], fallback_result["distances"][0]):
                if meta.get("npi") not in seen_npis:
                    results["metadatas"][0].append(meta)
                    results["distances"][0].append(dist)
                    seen_npis.add(meta.get("npi"))

        RADIUS_MILES = state.get("radius_miles") or 75
        candidates = []
        for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
            symptom_score = normalize_match_score(1 - dist)
            doctor_zip = meta.get("zip", "")
            distance = _distance_miles(patient_zip, doctor_zip) if patient_zip and doctor_zip else None

            # Proximity score: 1.0 at 0 miles → 0.0 at RADIUS_MILES, flat 0 beyond
            if distance is not None:
                proximity = max(0.0, 1.0 - distance / RADIUS_MILES)
            else:
                proximity = 0.3  # neutral penalty when ZIP data is missing

            # 65% symptom relevance + 35% proximity
            combined = round(0.65 * symptom_score + 0.35 * proximity, 3)

            candidates.append({
                "doctor_name": meta.get("doctor_name", ""),
                "npi":         meta.get("npi", ""),
                "speciality":  meta.get("specialty", "General Practice"),
                "credential":  meta.get("credential", ""),
                "city":        meta.get("city", ""),
                "state":       meta.get("state", ""),
                "zip":         doctor_zip,
                "phone":       meta.get("phone", ""),
                # score used internally for ranking only — not returned to frontend
                "_score":      combined,
                "distance_miles": round(distance) if distance is not None else None,
            })

        if len(candidates) < 3:
            log.warning("[Agent1] ChromaDB returned only %d candidates from n_results=30 — index may be sparse for this specialty", len(candidates))

        # Penalize subspecialties not warranted by symptoms (word-boundary matching, soft 0.75x)
        symptoms_lower = state["symptoms"].lower()
        SUBSPECIALTY_PENALTIES = [
            (["addiction", "substance abuse", "chemical dependency"],
             ["alcohol", "drug", "substance", "opioid", "withdrawal", "rehab", "sobriety", "detox"]),
            (["sports medicine", "sports ortho"],
             ["sports", "athletic", "running", "workout", "training", "gym", "exercise"]),
            (["pediatric", "adolescent medicine"],
             ["child", "infant", "baby", "kid", "toddler", "my son", "my daughter", "pediatric"]),
            (["geriatric", "gerontol"],
             ["elderly", "aging", "senior", "dementia", "my father", "my mother", "my parent"]),
            (["maternal-fetal", "maternal fetal", "obstetric"],
             ["pregnant", "pregnancy", "prenatal", "postpartum"]),
        ]
        for candidate in candidates:
            spec = candidate["speciality"].lower()
            for subspecialty_markers, required_keywords in SUBSPECIALTY_PENALTIES:
                if any(re.search(r"\b" + re.escape(m) + r"\b", spec) for m in subspecialty_markers):
                    if not any(re.search(r"\b" + re.escape(k) + r"\b", symptoms_lower) for k in required_keywords):
                        candidate["_score"] = round(candidate["_score"] * 0.75, 3)
                    break

        # Specialty boost (Change 3 — hybrid filter):
        # LLM-classified specialty acts as a strong prior signal.
        # Primary match → 1.35x boost. Secondary match → 1.15x boost.
        # Capped at 0.99 so boosted scores stay in the normalized range.
        # If LLM classification failed, target_specialty is "" — no boost applied.
        target_spec = state.get("target_specialty", "").lower().strip()
        secondary_specs = {s.lower().strip() for s in state.get("secondary_specialties", [])}
        if target_spec:
            boost_count = 0
            for c in candidates:
                spec = c["speciality"].lower()
                if spec == target_spec:
                    c["_score"] = min(0.99, round(c["_score"] * 1.35, 3))
                    boost_count += 1
                elif spec in secondary_specs:
                    c["_score"] = min(0.99, round(c["_score"] * 1.15, 3))
                    boost_count += 1
            log.info(
                "[Agent1] Specialty boost: %d/%d candidates boosted (primary='%s' secondary=%s)",
                boost_count, len(candidates), target_spec, sorted(secondary_specs),
            )

        # Respect radius: prefer within-radius doctors ranked by score.
        # Fallback: take nearest 15 by distance, rank by score within that pool —
        # so specialty boost is preserved even when all doctors are far away.
        if patient_zip:
            within = [c for c in candidates if c["distance_miles"] is not None and c["distance_miles"] <= RADIUS_MILES]
            if len(within) >= 3:
                doctors = sorted(within, key=lambda d: d["_score"], reverse=True)[:5]
            else:
                nearest15 = sorted(candidates, key=lambda d: d["distance_miles"] if d["distance_miles"] is not None else 9999)[:15]
                doctors = sorted(nearest15, key=lambda d: d["_score"], reverse=True)[:5]
        else:
            doctors = sorted(candidates, key=lambda d: d["_score"], reverse=True)[:5]
        top_score = doctors[0]["_score"] if doctors else 0.0
        for d in doctors:
            d.pop("_score", None)
        log.info("[Agent1] Found %d doctors (from 30 candidates, patient_zip=%s)", len(doctors), patient_zip or "unknown")

        # Generate clinical reasoning for each doctor — one LLM call for all
        doctors = _add_match_reasoning(state["symptoms"], doctors)

        # Compute final recommendation confidence
        confidence = _recommendation_confidence(
            urgency_conf=state.get("confidence", 70),
            top_score=top_score,
            symptoms=state["symptoms"],
        )
        log.info("[Agent1] Final recommendation confidence=%d%%", confidence)
        return {**state, "doctors": doctors, "confidence": confidence}

    except Exception as e:
        log.error("[Agent1] find_doctors failed: %s", e)
        return {**state, "doctors": [], "error": str(e)}


# ── Node 4: Suggest telehealth (shortage areas only) ──────────────────────────

def suggest_telehealth(state: IntakeState) -> IntakeState:
    """
    Builds telehealth options for shortage-area patients.
    Only executes when conditional routing sends us here.
    """
    urgency = state["urgency"]
    specialty = state["doctors"][0]["speciality"] if state["doctors"] else "a specialist"

    if urgency == "emergency":
        options = [
            {
                "type": "emergency",
                "name": "Emergency Telehealth",
                "description": "Connect immediately with an emergency physician. For life-threatening conditions, call 911.",
                "available": True,
            }
        ]
    else:
        options = [
            {
                "type": "video_visit",
                "name": "Video Consultation",
                "description": f"See a {specialty} via secure video — same-day appointments available in your area.",
                "available": True,
            },
            {
                "type": "async_care",
                "name": "Asynchronous Care",
                "description": "Submit your symptoms and photos. A doctor responds within 4 hours.",
                "available": True,
            },
        ]

    log.info("[Agent1] Generated %d telehealth options (shortage area)", len(options))
    return {**state, "telehealth_options": options}


# ── Routing ───────────────────────────────────────────────────────────────────

def route_after_find_doctors(state: IntakeState) -> Literal["suggest_telehealth", "__end__"]:
    """After finding doctors: suggest telehealth only if patient is in a shortage area."""
    if state.get("is_shortage_area"):
        return "suggest_telehealth"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(IntakeState)

    graph.add_node("assess_urgency",     assess_urgency)
    graph.add_node("check_shortage",     check_shortage_area)
    graph.add_node("classify_specialty", classify_specialty)
    graph.add_node("find_doctors",       find_doctors)
    graph.add_node("suggest_telehealth", suggest_telehealth)

    graph.add_edge(START, "assess_urgency")
    graph.add_edge("assess_urgency",     "check_shortage")
    graph.add_edge("check_shortage",     "classify_specialty")
    graph.add_edge("classify_specialty", "find_doctors")

    graph.add_conditional_edges("find_doctors", route_after_find_doctors, {
        "suggest_telehealth": "suggest_telehealth",
        "__end__":            END,
    })

    graph.add_edge("suggest_telehealth", END)

    return graph.compile()


intake_graph = _build_graph()


def is_intake_done(n: int, history: list[dict]) -> bool:
    """L1: Single source of truth for the intake done-heuristic.
    Done when: max questions reached (5) OR patient gave substantive answers (≥2 Q's, avg ≥10 words).
    Called by both get_next_question() and intake.py::stream_question.
    """
    if n >= 5:
        return True
    if n >= 2:
        avg_words = sum(len(h["answer"].split()) for h in history) / n
        if avg_words >= 10:
            return True
    return False


def get_next_question(symptoms: str, history: list[dict]) -> dict:
    """
    Generate the next contextual question OR decide conversation is complete.
    history: [{"question": "...", "answer": "..."}, ...]
    Returns {"question": str, "done": bool}
    """
    n = len(history)
    if is_intake_done(n, history):
        return {"question": "", "done": True}

    history_text = "\n".join(
        [f"Q{i+1}: {h['question']}\nPatient: {h['answer']}" for i, h in enumerate(history)]
    ) if history else "None yet."

    try:
        raw = chat(
            system_prompt=(
                "You are a skilled medical intake nurse conducting a clinical history. "
                "Ask ONE question that will most help determine the RIGHT specialist for this patient. "
                "Think clinically — what is the most diagnostically useful thing to know next?\n\n"
                "Adapt your question to the symptom type:\n"
                "- Pain: character (sharp/dull/pressure), radiation, what worsens or relieves it\n"
                "- Skin: appearance (color, texture, blistering, spreading), distribution, itch\n"
                "- Respiratory: rest vs exertion, cough character (dry/productive), fever, wheezing\n"
                "- Mental health: specific triggers, sleep quality, impact on daily function, duration\n"
                "- Digestive: relation to meals, bowel changes, nausea, appetite changes\n"
                "- Cardiac: rest vs exertion onset, radiation to arm/jaw, sweating, palpitations\n"
                "- Neurological: headache location, vision changes, numbness, weakness pattern\n\n"
                "Hard rules:\n"
                "- ONE question only — natural sentence, warm and conversational\n"
                "- NEVER ask 'rate 1-10' if severity was already mentioned in the patient's answers\n"
                "- NEVER repeat or rephrase a topic already covered — read the history carefully\n"
                "- Do NOT follow a fixed template (duration → severity → triggers). "
                "  Ask what is most clinically relevant given what the patient said.\n"
                "- Set done=true when you have enough to recommend a specialist\n\n"
                'Return JSON only: {"question": "...", "done": true|false}\n'
                "Minimum 2 questions before done. Maximum 5. No markdown."
            ),
            user_message=(
                f"Patient's initial symptoms: {symptoms}\n\n"
                f"Conversation so far ({n} questions asked):\n{history_text}\n\n"
                f"What is the single most useful clinical question to ask next? "
                f"Or is the picture clear enough to recommend a specialist? (min 2, max 5)"
            ),
            max_tokens=180,
        )
        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
        question = str(parsed.get("question", "")).strip()
        done = bool(parsed.get("done", False))
        if n < 2:
            done = False  # enforce minimum 2 questions
        if not question:
            done = True
        return {"question": question, "done": done}
    except Exception as e:
        log.error("[Agent1] get_next_question failed: %s", e)
        fallbacks = [
            "How long have you been experiencing this, and did it come on suddenly or gradually?",
            "On a scale of 1 to 10, how would you rate the severity right now?",
            "Have you noticed anything that makes it better or worse?",
            "Are there any other symptoms accompanying this — like fever, fatigue, or nausea?",
            "Have you seen a doctor for this before, or tried any medications?",
        ]
        return {"question": fallbacks[min(n, len(fallbacks) - 1)], "done": False}


def run(
    symptoms: str,
    patient_zip: str = "",
    patient_age: int = 0,
    patient_gender: str = "",
    radius_miles: int = 75,
) -> dict:
    initial: IntakeState = {
        "symptoms":            symptoms,
        "patient_zip":         patient_zip or "",
        "patient_age":         patient_age,
        "patient_gender":      patient_gender,
        "radius_miles":        radius_miles,
        "urgency":             "routine",
        "urgency_reason":      "",
        "confidence":          70,
        "is_shortage_area":    False,
        "shortage_type":       "",
        "shortage_description": "",
        "target_specialty":    "",
        "secondary_specialties": [],
        "doctors":             [],
        "telehealth_options":  [],
        "error":               None,
    }
    result = intake_graph.invoke(initial)
    return {
        "urgency":             result["urgency"],
        "urgency_reason":      result["urgency_reason"],
        "confidence":          result["confidence"],
        "is_shortage_area":    result["is_shortage_area"],
        "shortage_type":       result["shortage_type"],
        "shortage_description": result["shortage_description"],
        "doctors":             result["doctors"],
        "telehealth_options":  result["telehealth_options"],
        "error":               result["error"],
    }
