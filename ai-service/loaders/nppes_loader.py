#!/usr/bin/env python3
"""
NPPES Doctor Data Loader — ChromaDB Edition

Loads real US physician data from the NPPES CSV into a ChromaDB Cloud
collection named 'doctors_nppes'.

Default scope: California only (~200K active credentialed providers).
Fits comfortably within ChromaDB Cloud free tier (~1 GB storage).

Setup:
    Your ChromaDB credentials are already in the backend .env:
      CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE=patient-doctor
    Copy those three values into ai-service/.env.

Download NPPES CSV:
    https://download.cms.gov/nppes/NPI_Files.html  (~800 MB zip)
    Extract: npidata_pfile_<date>_<date>.csv

Usage:
    # Smoke test — 1 000 records
    python loaders/nppes_loader.py --csv-path /path/to/npidata_pfile.csv --max-records 1000

    # Full load (California, ~200K doctors — run overnight)
    python loaders/nppes_loader.py --csv-path /path/to/npidata_pfile.csv

    # Add more states later if needed
    python loaders/nppes_loader.py --csv-path /path/to/npidata_pfile.csv --states CA TX

After loading: set COLLECTION_NAME=doctors_nppes in backend .env and redeploy.
"""

import argparse
import logging
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── NPPES column names ────────────────────────────────────────────────────────

NPI_COL          = "NPI"
ENTITY_TYPE_COL  = "Entity Type Code"
DEACTIVATION_COL = "NPI Deactivation Date"
LAST_NAME_COL    = "Provider Last Name (Legal Name)"
FIRST_NAME_COL   = "Provider First Name"
MIDDLE_NAME_COL  = "Provider Middle Name"
CREDENTIAL_COL   = "Provider Credential Text"
TAXONOMY_COL     = "Healthcare Provider Taxonomy Code_1"
CITY_COL         = "Provider Business Practice Location Address City Name"
STATE_COL        = "Provider Business Practice Location Address State Name"
ZIP_COL          = "Provider Business Practice Location Address Postal Code"
PHONE_COL        = "Provider Business Mailing Address Telephone Number"

NEEDED_COLS = [
    NPI_COL, ENTITY_TYPE_COL, DEACTIVATION_COL,
    LAST_NAME_COL, FIRST_NAME_COL, MIDDLE_NAME_COL,
    CREDENTIAL_COL, TAXONOMY_COL,
    CITY_COL, STATE_COL, ZIP_COL, PHONE_COL,
]

# ── Specialty mapping (NPPES taxonomy code → readable name) ───────────────────

TAXONOMY_MAP = {
    "207Q00000X": "Family Medicine",
    "207R00000X": "Internal Medicine",
    "207RC0000X": "Cardiovascular Disease",
    "207RG0000X": "Gastroenterology",
    "207RN0000X": "Nephrology",
    "207RP1001X": "Pulmonary Disease",
    "207RE0101X": "Endocrinology",
    "207RH0000X": "Hematology",
    "207RI0200X": "Infectious Disease",
    "207RO0000X": "Oncology",
    "207RS0010X": "Rheumatology",
    "208000000X": "Pediatrics",
    "207V00000X": "Obstetrics & Gynecology",
    "207X00000X": "Orthopedic Surgery",
    "207XS0114X": "Sports Medicine",
    "208200000X": "Plastic Surgery",
    "207Y00000X": "Otolaryngology",
    "207ZP0102X": "Pathology",
    "207ZR0001X": "Radiology",
    "2084P0800X": "Psychiatry",
    "207L00000X": "Anesthesiology",
    "208G00000X": "Thoracic Surgery",
    "2086S0122X": "General Surgery",
    "207N00000X": "Dermatology",
    "207P00000X": "Emergency Medicine",
    "207SG0201X": "Geriatric Medicine",
    "207T00000X": "Neurological Surgery",
    "208100000X": "Physical Medicine & Rehabilitation",
    "2084N0400X": "Neurology",
    "208VP0000X": "Pain Management",
    "207W00000X": "Ophthalmology",
    "207K00000X": "Allergy & Immunology",
    "208D00000X": "General Practice",
    "207QA0401X": "Addiction Medicine",
    "2086X0206X": "Surgical Oncology",
    "2086S0129X": "Vascular Surgery",
    "2084A0401X": "Addiction Psychiatry",
    "2084P0301X": "Child & Adolescent Psychiatry",
}

DEFAULT_STATES = {"CA"}   # ~200K records — fits ChromaDB free tier comfortably
BATCH_SIZE     = 200      # ChromaDB free tier limit: 300 records per upsert call


def get_specialty(taxonomy_code: str) -> str:
    return TAXONOMY_MAP.get(str(taxonomy_code).strip(), "General Practice")


def _safe(val) -> str:
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none", "") else s


def build_document(row: pd.Series) -> str:
    first      = _safe(row.get(FIRST_NAME_COL, ""))
    middle     = _safe(row.get(MIDDLE_NAME_COL, ""))
    last       = _safe(row.get(LAST_NAME_COL, ""))
    credential = _safe(row.get(CREDENTIAL_COL, ""))
    specialty  = get_specialty(row.get(TAXONOMY_COL, ""))
    city       = _safe(row.get(CITY_COL, "")).title()
    state      = _safe(row.get(STATE_COL, ""))
    zip_code   = _safe(row.get(ZIP_COL, ""))[:5]

    name_parts = [p for p in [first, middle, last] if p]
    name       = "Dr. " + " ".join(name_parts) if name_parts else "Unknown"
    cred       = f", {credential}" if credential else ""
    location   = ", ".join(p for p in [city, state] if p)
    if zip_code:
        location = f"{location} {zip_code}".strip()

    return f"{name}{cred} | Specialty: {specialty} | Location: {location}"


def build_metadata(row: pd.Series) -> dict:
    first      = _safe(row.get(FIRST_NAME_COL, ""))
    middle     = _safe(row.get(MIDDLE_NAME_COL, ""))
    last       = _safe(row.get(LAST_NAME_COL, ""))
    taxonomy   = _safe(row.get(TAXONOMY_COL, ""))
    credential = _safe(row.get(CREDENTIAL_COL, ""))
    name_parts = [p for p in [first, middle, last] if p]
    name       = "Dr. " + " ".join(name_parts) if name_parts else "Unknown"

    return {
        "npi":           _safe(row[NPI_COL]),
        "doctor_name":   name,
        "credential":    credential,
        "specialty":     get_specialty(taxonomy),
        "taxonomy_code": taxonomy,
        "city":          _safe(row.get(CITY_COL, "")).title(),
        "state":         _safe(row.get(STATE_COL, "")),
        "zip":           _safe(row.get(ZIP_COL, ""))[:5],
        "phone":         _safe(row.get(PHONE_COL, "")),
    }


def connect_chromadb():
    try:
        import chromadb
    except ImportError:
        log.error("chromadb not installed. Run: pip install -r requirements_loader.txt")
        sys.exit(1)

    tenant   = os.environ.get("CHROMA_TENANT")
    database = os.environ.get("CHROMA_DATABASE")
    api_key  = os.environ.get("CHROMA_API_KEY")

    missing = [k for k, v in [
        ("CHROMA_TENANT", tenant),
        ("CHROMA_DATABASE", database),
        ("CHROMA_API_KEY", api_key),
    ] if not v]
    if missing:
        log.error(f"Missing env vars: {', '.join(missing)}")
        log.error("Copy your backend .env values for CHROMA_TENANT, CHROMA_DATABASE, CHROMA_API_KEY into ai-service/.env")
        sys.exit(1)

    client     = chromadb.CloudClient(tenant=tenant, database=database, api_key=api_key)
    collection = client.get_or_create_collection(
        name="doctors_nppes",
        metadata={"hnsw:space": "cosine"},
    )
    log.info(f"ChromaDB ready — 'doctors_nppes' has {collection.count():,} existing docs")
    return collection


def flush_batch(collection, model, ids, docs, metas):
    embeddings = model.encode(docs, batch_size=64, show_progress_bar=False).tolist()
    collection.upsert(ids=ids, embeddings=embeddings, documents=docs, metadatas=metas)


def main():
    parser = argparse.ArgumentParser(
        description="Load NPPES physicians into ChromaDB 'doctors_nppes' collection"
    )
    parser.add_argument("--csv-path",    required=True, help="Path to NPPES npidata_pfile*.csv")
    parser.add_argument(
        "--states", nargs="+", default=list(DEFAULT_STATES), metavar="STATE",
        help="Two-letter state codes to include (default: CA)",
    )
    parser.add_argument("--batch-size",  type=int, default=BATCH_SIZE,
                        help=f"Records per ChromaDB upsert (default {BATCH_SIZE})")
    parser.add_argument("--max-records", type=int, default=None,
                        help="Stop after N uploads — for smoke testing")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        log.error(f"CSV not found: {csv_path}")
        sys.exit(1)

    states_filter = {s.upper() for s in args.states}
    log.info(f"State filter:  {sorted(states_filter)}")
    log.info(f"Batch size:    {args.batch_size}")
    if args.max_records:
        log.info(f"Max records:   {args.max_records} (smoke-test mode)")

    collection = connect_chromadb()

    log.info("Loading sentence-transformers model all-MiniLM-L6-v2 ...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    log.info("Model ready.")

    batch_ids, batch_docs, batch_metas = [], [], []
    total_uploaded = 0
    total_seen     = 0

    chunk_iter = pd.read_csv(
        csv_path,
        usecols=lambda c: c in NEEDED_COLS,
        chunksize=10_000,
        low_memory=False,
        dtype=str,
    )

    log.info(f"Reading: {csv_path.name}")

    for chunk in tqdm(chunk_iter, desc="CSV chunks", unit="chunk"):
        # Filter: individual, active, target state, credentialed
        chunk = chunk[chunk[ENTITY_TYPE_COL] == "1"]
        chunk = chunk[chunk[DEACTIVATION_COL].isna() | (chunk[DEACTIVATION_COL].str.strip() == "")]
        chunk = chunk[chunk[STATE_COL].isin(states_filter)]
        chunk = chunk[chunk[CREDENTIAL_COL].notna() & (chunk[CREDENTIAL_COL].str.strip() != "")]
        total_seen += len(chunk)

        for _, row in chunk.iterrows():
            batch_ids.append(str(row[NPI_COL]))
            batch_docs.append(build_document(row))
            batch_metas.append(build_metadata(row))

            if len(batch_ids) >= args.batch_size:
                flush_batch(collection, model, batch_ids, batch_docs, batch_metas)
                total_uploaded += len(batch_ids)
                log.info(f"Uploaded {total_uploaded:,} doctors total")
                batch_ids, batch_docs, batch_metas = [], [], []

            if args.max_records and total_uploaded >= args.max_records:
                break

        if args.max_records and total_uploaded >= args.max_records:
            log.info(f"Reached --max-records limit ({args.max_records}). Stopping.")
            break

    # Flush remaining
    if batch_ids:
        flush_batch(collection, model, batch_ids, batch_docs, batch_metas)
        total_uploaded += len(batch_ids)

    log.info("=" * 60)
    log.info(f"Rows matched filter:   {total_seen:,}")
    log.info(f"Doctors uploaded:      {total_uploaded:,}")
    log.info(f"Collection count:      {collection.count():,}")
    log.info("=" * 60)
    log.info("Next step: set COLLECTION_NAME=doctors_nppes in backend .env and redeploy.")


if __name__ == "__main__":
    main()
