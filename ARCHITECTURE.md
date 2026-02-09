# Treatment Trial Match — Overall Architecture

```mermaid
flowchart TB
    subgraph User["👤 User"]
        Browser[Browser]
    end

    subgraph Frontend["Frontend (Next.js)"]
        direction TB
        Middleware[WorkOS AuthKit Middleware]
        Landing["/ (Landing)"]
        Callback["/callback (OAuth)"]
        Dashboard["/dashboard"]
        API["API Routes"]

        subgraph DashboardFlow["Dashboard flow"]
            Capture[ImageCapture]
            Review[OcrReview]
            Results[TrialResults]
            Capture --> Review --> Results
        end

        subgraph APIRoutes["API Routes"]
            OCRRoute["/api/ocr\n(OpenAI Vision)"]
            MatchRoute["/api/match\n(proxy → backend)"]
        end

        ClientAPI["lib/api.ts\n(uploadForOCR, matchTrials)"]
    end

    subgraph ExternalAuth["External"]
        WorkOS[WorkOS Auth]
    end

    subgraph Backend["Backend (FastAPI)"]
        direction TB
        MatchEP["POST /match\n(RAG pipeline)"]
        SearchEP["POST /search\n(vector search)"]
        HealthEP["GET /health"]

        subgraph MatchPipeline["/match pipeline"]
            Step1[1. GPT-4o: extract\npatient criteria]
            Step2[2. ChromaDB: vector search\n(condition + criteria, optional RRF)]
            Step3[3. GPT-4o: re-rank +\nmatch reasoning]
            Step1 --> Step2 --> Step3
        end

        Security[SecurityHeaders, CORS, Rate limit]
        Audit[Audit logging]
    end

    subgraph Data["Data & ML"]
        ChromaDB[(ChromaDB\nclinical_trials)]
        EmbedModel[SentenceTransformer\nall-MiniLM-L6-v2]
        OpenAI[OpenAI API\nGPT-4o]
    end

    subgraph Ingest["Ingestion (offline)"]
        CSV[ctg-studies-merged.csv]
        IngestScript[ingest_clinical_trials_to_chromadb.py]
        CSV --> IngestScript --> ChromaDB
    end

    Browser --> Middleware
    Middleware --> Landing
    Middleware --> Callback
    Middleware --> Dashboard
    Landing --> WorkOS
    WorkOS --> Callback
    Callback --> Dashboard

    Dashboard --> DashboardFlow
    DashboardFlow --> ClientAPI
    ClientAPI --> API
    API --> OCRRoute
    API --> MatchRoute

    OCRRoute --> OpenAI
    MatchRoute --> MatchEP

    MatchEP --> MatchPipeline
    MatchPipeline --> EmbedModel
    MatchPipeline --> ChromaDB
    MatchPipeline --> OpenAI

    SearchEP --> EmbedModel
    SearchEP --> ChromaDB

    Backend --> Security
    Backend --> Audit
```

## High-level flow

| Layer        | Components                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**     | User hits `/` → WorkOS sign-in → `/callback` → `/dashboard`. All protected routes go through AuthKit middleware.                                      |
| **Frontend** | Next.js app: capture image → `/api/ocr` (OpenAI Vision) → review/edit text → `/api/match` (proxied to backend) → show trial results.                  |
| **Backend**  | FastAPI: `POST /match` runs RAG (extract → vector search → re-rank); `POST /search` is direct vector search. ChromaDB + SentenceTransformer + OpenAI. |
| **Data**     | Clinical trials in ChromaDB; populated by ingest script from `ctg-studies-merged.csv`.                                                                |

## Request flow: Match (OCR → trials)

1. **Browser** → `POST /api/ocr` (image) → Next.js calls **OpenAI Vision (GPT-4o)** → returns extracted text.
2. **Browser** → `POST /api/match` (OCR text) → Next.js proxies to **Backend** `POST /match`.
3. **Backend** `/match`: GPT-4o extracts patient criteria → SentenceTransformer + ChromaDB vector search (optionally two-query RRF) → GPT-4o re-ranks and adds reasoning → response to frontend.
4. **Frontend** shows patient criteria and ranked trial list (TrialResults).

## Security

- WorkOS AuthKit on Next.js; backend does not verify tokens (frontend is trusted).
- Backend: rate limiting, security headers, CORS to frontend origin, audit logging (no PHI in logs).
- PHI (OCR text, images) processed in memory only; not persisted.
