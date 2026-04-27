# InfoSec Environment Setup

## Quick Start (After `docker compose down -v`)

### 1. Start all services
```bash
docker compose up -d
```

### 2. Run setup script
```bash
# From host (if Node.js installed)
node scripts/setup-env.js

# OR inside backend container
docker compose exec backend node scripts/setup-env.js
```

### 3. Verify
- Open `http://localhost:5174`
- Login with: `admin` / `admin123`

---

## Setup Script Options

### Skip optional steps
```bash
# Skip Ollama model pull (if using OpenAI)
node scripts/setup-env.js --skip-ollama-pull

# Skip QA import (if no Q&A.txt file)
node scripts/setup-env.js --skip-qa-import

# Use custom QA file
node scripts/setup-env.js --qa-file=./data/my-qa.txt
```

---

## What the Setup Script Does

1. **Validates environment** - Checks JWT secrets are 32+ chars
2. **Waits for services** - MongoDB, ChromaDB, Ollama
3. **Creates default users:**
   - `admin` / `admin123` (role: admin)
   - `manager` / `manager123` (role: manager)
   - `sme` / `sme123` (role: sme)
4. **Imports QA entries** from `Q&A.txt` (if exists)
5. **Indexes to ChromaDB** - Generates embeddings via Ollama
6. **Pulls Ollama model** - `nomic-embed-text` for embeddings

---

## Manual Setup (Alternative)

### Create users only
```bash
docker compose exec backend node scripts/seed-users.js
```

### Import QA entries manually
1. Place `Q&A.txt` in project root
2. Use the Settings page in the UI
3. Or call API directly:
   ```bash
   curl -X POST http://localhost:3001/qa/import -H "Authorization: Bearer <token>"
   ```

### Generate JWT secrets
```bash
# Run inside backend container
docker compose exec backend node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Then update `.env` file with the generated secrets.

---

## Environment Variables Checklist

### Critical (MUST have real values)
- [ ] `JWT_SECRET` - 32+ characters
- [ ] `JWT_REFRESH_SECRET` - 32+ characters
- [ ] `OPENAI_API_KEY` - Real key OR use Ollama (`OPENAI_BASE_URL`)

### Properly configured (verify)
- [x] `MONGODB_URI=mongodb://mongo:27017/infosec`
- [x] `CHROMA_HOST=chroma`
- [x] `CHROMA_PORT=8000`
- [x] `OPENAI_BASE_URL=http://host.docker.internal:11434/v1` (for Ollama)

---

## Troubleshooting

### "JWT_SECRET must be 32+ characters"
→ Generate new secrets:
```bash
docker compose exec backend node scripts/generate-secrets.js
```
Then update `.env` and restart.

### "Client validation failed: clientType"
→ Valid enum values are: `['Cloud', 'Rent', 'PS']`
   The setup script uses 'Cloud' by default.

### "Failed to pull Ollama model"
→ Check Ollama is running: `docker compose ps ollama`
→ Or skip with `--skip-ollama-pull` flag

### "ChromaDB collection qanda not found"
→ Run setup script to create and index collections
→ Or manually: `docker compose exec backend npm run migrate:chroma`

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/setup-env.js` | Main setup script (Node.js, runs in backend container) |
| `scripts/seed-users.js` | Seed users only (alternative) |
| `scripts/generate-secrets.js` | Generate JWT secrets |
| `.env.example` | Example environment configuration |

---

## Next Steps After Setup

1. **Test Login** - `admin` / `admin123`
2. **Test Gap Finder** - Go to Gap Finder page, search "password"
3. **Test Ask Module** - Go to Ask page, create new chat
4. **Import Q&A** - Settings page → Import Q&A.txt
5. **Run npm run build** to verify production build works
