"""
Load real MTSamples 5K clinical transcriptions into ChromaDB patient_cases collection.
Source: harishnair04/mtsamples on HuggingFace (5,000 real de-identified physician transcriptions, 40 specialties).

Run: python scripts/load_patient_cases.py
Prereq: pip install datasets (already in requirements)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datasets import load_dataset
from app.services.chroma_client import get_chroma_client, embed
from app.core.config import settings


def batch(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def clean(text: str | None) -> str:
    if not text:
        return ""
    return str(text).strip()


def main():
    print("Loading MTSamples dataset from HuggingFace (harishnair04/mtsamples)...")
    ds = load_dataset("harishnair04/mtsamples", split="train")
    print(f"Downloaded {len(ds)} records.")

    # Filter: keep only rows with a non-empty transcription (some rows have nulls)
    rows = [r for r in ds if clean(r.get("transcription"))]
    print(f"{len(rows)} rows have non-empty transcriptions.")

    print("Connecting to ChromaDB Cloud...")
    client = get_chroma_client()
    collection = client.get_or_create_collection(settings.patient_collection_name)

    existing = collection.count()
    print(f"Collection '{settings.patient_collection_name}' has {existing} existing documents.")
    if existing > 0:
        print("Clearing existing documents...")
        all_ids = collection.get(include=[])["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
        print(f"Cleared {len(all_ids)} documents.")

    print(f"Embedding and uploading {len(rows)} cases in batches of 25...")

    uploaded = 0
    for chunk_idx, chunk in enumerate(batch(rows, 25)):
        ids, documents, metadatas, embeddings = [], [], [], []

        for i, row in enumerate(chunk):
            transcription = clean(row.get("transcription"))
            specialty = clean(row.get("medical_specialty")) or "General"
            description = clean(row.get("description")) or ""
            sample_name = clean(row.get("sample_name")) or ""
            keywords = clean(row.get("keywords")) or ""

            row_id = f"mt_{chunk_idx * 25 + i}"

            # Embed the transcription text (what we search against)
            # ChromaDB Cloud free tier: 16KB document size limit
            doc_text = transcription[:15000]
            ids.append(row_id)
            documents.append(doc_text)
            metadatas.append({
                "specialty": specialty,
                "description": description,
                "sample_name": sample_name,
                "keywords": keywords[:500],  # ChromaDB metadata value limit
                "source": "mtsamples",
            })
            embeddings.append(embed(doc_text[:2048]))  # embed first 2K chars (most diagnostic content)

        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        uploaded += len(chunk)
        print(f"  Uploaded {uploaded}/{len(rows)} cases...")

    final_count = collection.count()
    print(f"\n✓ Done. Collection '{settings.patient_collection_name}' now has {final_count} documents.")

    # Smoke test
    print("\nSample query — 'chest pain shortness of breath diaphoresis':")
    q_emb = embed("chest pain shortness of breath diaphoresis")
    results = collection.query(
        query_embeddings=[q_emb],
        n_results=5,
        include=["metadatas", "distances"],
    )
    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
        print(f"  [{round(1 - dist, 3)} score] {meta['specialty']} — {meta['description'][:80]}")


if __name__ == "__main__":
    main()
