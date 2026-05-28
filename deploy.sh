#!/bin/bash
# Usage: set the variables below (or export them) before running.
# Copy this script and fill in your own values — never commit real credentials.
set -e

PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
REGISTRY="us-central1-docker.pkg.dev/$PROJECT_ID/healthportal"

# ── Credentials (set via environment or fill in locally, never commit) ────────
: "${GROQ_API_KEY:?Set GROQ_API_KEY}"
: "${CHROMA_API_KEY:?Set CHROMA_API_KEY}"
: "${CHROMA_TENANT:?Set CHROMA_TENANT}"
: "${CHROMA_DATABASE:?Set CHROMA_DATABASE}"
: "${CLOUD_SQL_HOST:?Set CLOUD_SQL_HOST}"
: "${CLOUD_SQL_PORT:?Set CLOUD_SQL_PORT}"
: "${CLOUD_SQL_DATABASE:?Set CLOUD_SQL_DATABASE}"
: "${CLOUD_SQL_USER:?Set CLOUD_SQL_USER}"
: "${CLOUD_SQL_PASSWORD:?Set CLOUD_SQL_PASSWORD}"
: "${JWT_SECRET:?Set JWT_SECRET}"
: "${SMTP_USERNAME:?Set SMTP_USERNAME}"
: "${SMTP_PASSWORD:?Set SMTP_PASSWORD}"
: "${CORS_ORIGINS:?Set CORS_ORIGINS}"

echo "==> Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# ── 1. Build & push AI service ─────────────────────────────────────────────
echo "==> Building AI service..."
docker build --platform linux/amd64 -t $REGISTRY/ai-service:latest ./ai-service

echo "==> Pushing AI service..."
docker push $REGISTRY/ai-service:latest

echo "==> Deploying AI service to Cloud Run..."
gcloud run deploy ai-service \
  --image $REGISTRY/ai-service:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --set-env-vars "APP_ENV=prod,GROQ_API_KEY=${GROQ_API_KEY},CHROMA_API_KEY=${CHROMA_API_KEY},CHROMA_TENANT=${CHROMA_TENANT},CHROMA_DATABASE=${CHROMA_DATABASE},CORS_ORIGINS=${CORS_ORIGINS}"

AI_SERVICE_URL=$(gcloud run services describe ai-service --region $REGION --format 'value(status.url)')
echo "==> AI service deployed at: $AI_SERVICE_URL"

# ── 2. Build & push Spring Boot ────────────────────────────────────────────
echo "==> Building Spring Boot backend..."
docker build --platform linux/amd64 -t $REGISTRY/spring-backend:latest ./spring-backend

echo "==> Pushing Spring Boot backend..."
docker push $REGISTRY/spring-backend:latest

echo "==> Deploying Spring Boot to Cloud Run..."
gcloud run deploy spring-backend \
  --image $REGISTRY/spring-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --set-env-vars "SPRING_PROFILES_ACTIVE=prod,CLOUD_SQL_HOST=${CLOUD_SQL_HOST},CLOUD_SQL_PORT=${CLOUD_SQL_PORT},CLOUD_SQL_DATABASE=${CLOUD_SQL_DATABASE},CLOUD_SQL_USER=${CLOUD_SQL_USER},CLOUD_SQL_PASSWORD=${CLOUD_SQL_PASSWORD},JWT_SECRET=${JWT_SECRET},SMTP_USERNAME=${SMTP_USERNAME},SMTP_PASSWORD=${SMTP_PASSWORD},REDIS_ENABLED=false,AI_SERVICE_URL=${AI_SERVICE_URL},CORS_ORIGINS=${CORS_ORIGINS}"

SPRING_URL=$(gcloud run services describe spring-backend --region $REGION --format 'value(status.url)')
echo "==> Spring Boot deployed at: $SPRING_URL"

echo ""
echo "========================================"
echo "Deployment complete!"
echo "Spring Boot : $SPRING_URL"
echo "AI Service  : $AI_SERVICE_URL"
echo ""
echo "NEXT STEPS:"
echo "1. Update frontend/.env.production:"
echo "   VITE_AI_SERVICE_URL=$AI_SERVICE_URL"
echo "2. Run: cd frontend && npm run build && vercel --prod"
echo "========================================"
