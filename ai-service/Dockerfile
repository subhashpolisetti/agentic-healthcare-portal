FROM python:3.11-slim-bookworm

WORKDIR /app

# Install torch CPU-only first (saves ~600MB vs default GPU build)
RUN pip install --no-cache-dir \
    torch==2.6.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && find /usr/local/lib/python3.11 -name "*.pyc" -delete \
    && find /usr/local/lib/python3.11 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null; true

# Download embedding model at build time so container starts fast
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY app/ app/

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
