#!/usr/bin/env python3
"""
Train No-Show Prediction Model

Trains a GradientBoostingClassifier on synthetic appointment data.
Produces noshow_model.pkl used by Agent 3 at runtime.

Run from ai-service/ directory:
    venv/bin/python scripts/train_noshow_model.py
"""

import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

SEED = 42
N_SAMPLES = 10_000
MODEL_PATH = Path(__file__).parent.parent / "noshow_model.pkl"

# Specialty encoding
SPECIALTY_MAP = {
    "Family Medicine": 0, "General Practice": 0, "Internal Medicine": 0,
    "Pediatrics": 0, "Geriatric Medicine": 0,
    "Cardiovascular Disease": 1, "Cardiology": 1, "Gastroenterology": 1,
    "Orthopedic Surgery": 1, "Neurology": 1, "Oncology": 1,
    "Dermatology": 1, "Ophthalmology": 1, "Endocrinology": 1,
    "Pulmonary Disease": 1, "Nephrology": 1, "Rheumatology": 1,
    "Psychiatry": 2, "Addiction Psychiatry": 2, "Child & Adolescent Psychiatry": 2,
    "Addiction Medicine": 2,
}


def specialty_to_type(specialty: str) -> int:
    return SPECIALTY_MAP.get(specialty, 1)


def generate_synthetic_data(n: int, seed: int) -> tuple:
    rng = np.random.default_rng(seed)

    day_of_week        = rng.integers(0, 7, n)           # 0=Mon, 6=Sun
    hour_of_day        = rng.integers(9, 17, n)          # 9am-4pm
    specialty_type     = rng.integers(0, 3, n)           # 0=primary, 1=specialist, 2=mental
    days_until_appt    = rng.integers(0, 91, n)          # 0-90 days lead time
    past_noshow_rate   = rng.uniform(0.0, 0.5, n)        # 0-50% historical rate

    # No-show probability based on realistic patterns:
    # - Mental health: highest no-show (~35%)
    # - Long lead time: more no-shows
    # - Early morning (9am) and late Friday: more no-shows
    # - High past_noshow_rate: strong predictor
    noshow_prob = (
        0.08                                                  # base rate
        + 0.12 * (specialty_type == 2)                        # mental health
        + 0.06 * (specialty_type == 1)                        # specialist
        + 0.003 * days_until_appt                             # lead time effect
        + 0.20 * past_noshow_rate                             # history is best predictor
        + 0.04 * (hour_of_day == 9)                           # early morning
        + 0.03 * (day_of_week == 4)                           # Friday
        + 0.02 * (day_of_week == 0)                           # Monday
        - 0.03 * (hour_of_day.isin([10, 11]) if hasattr(hour_of_day, 'isin') else
                  np.isin(hour_of_day, [10, 11]))             # mid-morning is best
    )
    noshow_prob = np.clip(noshow_prob, 0.02, 0.95)
    y = rng.binomial(1, noshow_prob).astype(int)

    X = np.column_stack([day_of_week, hour_of_day, specialty_type,
                         days_until_appt, past_noshow_rate])
    return X, y


def main():
    print("Generating synthetic training data...")
    X, y = generate_synthetic_data(N_SAMPLES, SEED)
    print(f"  {N_SAMPLES} records — no-show rate: {y.mean():.1%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )

    print("Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.1,
        random_state=SEED,
    )
    model.fit(X_train, y_train)

    y_prob = model.predict_proba(X_test)[:, 1]
    print(f"\nTest set results:")
    print(classification_report(y_test, (y_prob > 0.5).astype(int),
                                 target_names=["Show", "No-Show"]))
    print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.3f}")

    # Feature importances
    features = ["day_of_week", "hour_of_day", "specialty_type",
                 "days_until_appt", "past_noshow_rate"]
    print("\nFeature importances:")
    for f, imp in sorted(zip(features, model.feature_importances_),
                          key=lambda x: -x[1]):
        print(f"  {f}: {imp:.3f}")

    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
