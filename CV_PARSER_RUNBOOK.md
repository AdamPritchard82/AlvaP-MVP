# AlvaP CV Parser RUNBOOK (Vendor: `CVDocumentParser.API`)

> **Purpose:** Wire the vendor-supplied .NET Web API (`CVDocumentParser.API/`) into AlvaP, deploy it as its own service, point the Node backend at it, and verify end‑to‑end parsing (including phone, job title, employer). Written for Windows/PowerShell and cross‑platform where helpful.

---

## 0) Assumptions & Folder

* Repo root contains `CVDocumentParser.API/` (vendor code) alongside `backend/` or equivalent Node server.
* Do **not** refactor or rename anything inside `CVDocumentParser.API/` unless explicitly authorised. Treat it as **frozen vendor code**.

**Enforcement phrase:** Any change to vendor code must start with: **"Authorise vendor change"**.

---

## 1) Minimal Ops Additions (Health, CORS, Port)

**Goal:** Add only operational glue; no parsing logic changes.

### 1.1 Health endpoint

Add to `Program.cs` (or startup):

```csharp
app.MapGet("/healthz", () => Results.Json(new { status = "ok" }));
```

### 1.2 CORS policy

Allow production frontend and local dev:

```csharp
var origins = new [] {
    "https://alvap-mvp-production.up.railway.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("alvap", policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

app.UseCors("alvap");
```

### 1.3 Port binding

Ensure production binds to Railway port:

```csharp
// Docker/Railway uses ASPNETCORE_URLS; default to :8080
// In Railway env: ASPNETCORE_URLS=http://0.0.0.0:${PORT}
```

No further changes in controllers/models/JSON.

---

## 2) Run Locally (Windows PowerShell)

From repo root:

```powershell
cd .\CVDocumentParser.API
dotnet restore
dotnet build -c Release
$env:ASPNETCORE_URLS = "http://0.0.0.0:8080"
dotnet run --configuration Release
```

**Health:**

```powershell
Invoke-WebRequest http://localhost:8080/healthz -UseBasicParsing
```

**Parse (example):**

```powershell
$cv = "..\fixtures\sample_cv.pdf"  # adjust if needed
curl -F "file=@$cv" http://localhost:8080/parse
```

**Pass criteria:** JSON matches vendor schema; non‑empty `phone`, `workExperience[0].jobTitle`, `workExperience[0].company` for known fixtures.

---

## 3) Deterministic Deploy (choose ONE)

### Option A — Docker (preferred)

Create `CVDocumentParser.API/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore
RUN dotnet publish -c Release -o /out

FROM base AS final
WORKDIR /app
COPY --from=build /out .
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["dotnet","CVDocumentParser.API.dll"]
```

Local test:

```bash
cd CVDocumentParser.API
docker build -t cv-parser:prod .
docker run -p 8080:8080 cv-parser:prod
```

### Option B — Railway TOML (no Docker)

Create `CVDocumentParser.API/railway.toml`:

```toml
[env]
ASPNETCORE_URLS = "http://0.0.0.0:${PORT}"

[start]
cmd = "dotnet CVDocumentParser.API.dll"
```

Set service Health Check path to `/healthz`.

---

## 4) Deploy as NEW Railway Service

1. Create a **new** Railway service from `CVDocumentParser.API/` (fresh name; don't reuse old services).
2. Set Health Check path: `/healthz`.
3. Deploy → note public URL: `https://<new-parser>.up.railway.app`.
4. No controller/JSON changes.

---

## 5) Wire Backend to Parser

Edit Node backend (e.g., `simple-working-server.js`):

* Read `DOTNET_CV_API_URL` from env.
* On upload: `POST ${DOTNET_CV_API_URL}/parse` with multipart field **`file`**.
* Timeout 10s. On non‑200/timeout → respond `503 { error: "ParserUnavailable" }`. **Do not** return dummy data.
* Optional local fallback only if `ALLOW_LOCAL_FALLBACK=true`.
* Add `GET /meta/version` → `{ gitSha, buildTime, dotnetUrl: process.env.DOTNET_CV_API_URL }`.

**Backend env (Railway):**

```ini
DOTNET_CV_API_URL=https://<new-parser>.up.railway.app
PARSER_TIMEOUT_MS=10000
ALLOW_LOCAL_FALLBACK=true
NODE_ENV=production
```

Redeploy backend service (`natural-kindness-production`).

---

## 6) Smoke Tests

Create `scripts/smoke.ps1` (PowerShell):

```powershell
Param(
  [string]$Api    = "https://natural-kindness-production.up.railway.app",
  [string]$Parser = "https://<new-parser>.up.railway.app",
  [string]$CvPath = ".\fixtures\sample_cv.pdf"
)

Write-Host "-- parser health"; Invoke-WebRequest "$Parser/healthz" -UseBasicParsing | Out-Null
Write-Host "-- backend version"; Invoke-RestMethod "$Api/meta/version" | ConvertTo-Json -Depth 6

Write-Host "-- direct parser test"
$p = curl -s -F "file=@$CvPath" "$Parser/parse" | ConvertFrom-Json
if (-not $p.success -or [string]::IsNullOrWhiteSpace($p.data.personalInfo.phone) -or
    [string]::IsNullOrWhiteSpace($p.data.workExperience[0].jobTitle) -or
    [string]::IsNullOrWhiteSpace($p.data.workExperience[0].company)) { throw "Parser fields missing" }

Write-Host "-- end-to-end via backend"
$b = curl -s -F "file=@$CvPath" "$Api/api/parse" | ConvertFrom-Json
if (("$($b.phone)$($b.data.personalInfo.phone)" -eq '') -or ("$($b.jobTitle)$($b.data.workExperience[0].jobTitle)" -eq '') -or ("$($b.employer)$($b.data.workExperience[0].company)" -eq '')) { throw "Backend fields missing" }

Write-Host "OK ✅"
```

*(Optional Bash variant available on request.)*

---

## 7) Frontend Traceability

* Confirm `frontend/public/config.json` → `API_BASE` points at backend.
* Add a small footer badge that calls `/meta/version` and displays `gitSha` + `dotnetUrl` so we can visually confirm which parser is active.

---

## 8) Regression Guards (No Dummy Data)

* **Unit test:** fail if any parsed field contains `John Doe` or `@example.com`.
* **Integration test:** upload fixture CV → assert non‑empty `phone`, `jobTitle`, `employer/company`.
* Run smoke script post‑deploy in CI; fail build on error.

---

## 9) Troubleshooting

* **Parser healthy but backend fails:** check `DOTNET_CV_API_URL`, CORS on parser, and multipart field name `file`.
* **Timeouts:** increase `PARSER_TIMEOUT_MS`; inspect parser logs; verify file size limits.
* **Wrong service:** verify `/meta/version` shows the expected `dotnetUrl` and commit `gitSha`.
* **Candidate persistence issues:** check DB `INSERT` logs and `SELECT COUNT(*) FROM candidates;` on the production DB; ensure Railway `DATABASE_URL` is correct.

---

## 10) Rollback / Blue‑Green

* Keep old backend live while validating the new parser.
* Switch frontend only after `/healthz` + smoke tests pass against the new parser.
* Maintain old parser service for 24–48h as rollback target.

---

## Appendix A — Sample `curl`

```bash
# Health
curl -fsS https://<new-parser>.up.railway.app/healthz

# Parse
curl -fsS -F "file=@fixtures/sample_cv.pdf" https://<new-parser>.up.railway.app/parse
```

## Appendix B — Contract Reminder (excerpt)

```json
{
  "success": true,
  "message": "CV parsed successfully",
  "data": {
    "personalInfo": {
      "name": "Laura Williams",
      "firstName": "Laura",
      "lastName": "Williams",
      "email": "Laura.williams6349@gmail.com",
      "phone": "(818) 464-6403",
      "address": null,
      "linkedIn": "com/in/laura-williams-280linkedin"
    },
    "workExperience": [
      { "jobTitle": "…", "company": "…", "startDate": null, "endDate": null, "description": "…" }
    ]
  }
}
```

---

**End of RUNBOOK.**

