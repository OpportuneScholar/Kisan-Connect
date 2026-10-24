# 🌱 Kisan Connect (किसान कनेक्ट)
### Empowering Small and Marginal Farmers

**Kisan Connect** is a mobile-friendly AgriTech web prototype that brings together produce listings, mandi information, farm equipment, crop-health references, government schemes, weather guidance, farm-cost tracking, and farmer discussions.

**Current status:** this ZIP is a frontend prototype. Mandi and weather values include sample data, uploaded crop photos are not analysed by a real AI model, demo accounts are stored in the current browser, and listings are not shared with a server or other users. Do not use the sample values as live market or agricultural advice.
---

**Backend status:** FastAPI now provides server-side registration/login, password hashing, HttpOnly session cookies, role checks, persistent produce listings, buyer enquiries, and an admin summary endpoint. PostgreSQL is supported through `DATABASE_URL`. If it is not set, local development uses a SQLite file; this fallback is not the recommended multi-user deployment database.

## 🌟 Key Platform Modules

### 1. 🌾 Kisan Mandi (Transparent APMC Prices & Direct Sales)
- **Sample Mandi Information**: Example modal, min, and max prices across 25+ commodities and 12+ major APMC markets (Neemuch, Khanna, Azadpur, Lasalgaon, Guntur, Rajkot, etc.).
- **MSP Watchdog Alert**: Automatic alert banner notifying farmers whenever open market prices drop below the Central Minimum Support Price (MSP), guiding them to nearest FCI/NAFED procurement centers.
- **Direct Farm-Gate Listings**: Small farmers can list their harvest (Wheat, Basmati Paddy, Mustard, Organic Millets) directly with photos, quantity in quintals, asking price, and WhatsApp/phone contact to connect with potential buyers and FPOs without arhtiya commissions.
- **7-Day Dynamic Price Trajectories**: Interactive SVG price trends showing weekly price movements and market volatility ratings.

### 2. 🚜 Yantra Sahay (Custom Hiring & Co-Farming Pooling)
- **"Uber for Farm Equipment"**: Directory of nearby tractors (Mahindra, John Deere), combine harvesters, drone sprayers, laser land levelers, and solar pumps with hourly and per-acre rates.
- **Co-Farming Equipment Pooling Calculator**: Solves the small-plot penalty where contractors overcharge fragmented plots under 2 acres. By pooling contiguous acreage with 2 to 5 neighboring farms, farmers save up to 35% on machinery and diesel transit.
- **Verified Digital Booking Slip**: Generates an instant booking slip with reference code, operator direct call link, and cost breakdown.

### 3. Kisan Crop-Health Reference Guide
- **Visual Pest & Disease Diagnosis**: Farmers can upload photos of infected leaves or test with pre-loaded field specimens (Wheat Yellow Rust, Rice Blast, Cotton Pink Bollworm, Tomato Early Blight, Potato Late Blight, Mustard Aphids).
- **Dual Treatment Protocols**:
  - **Zero-Cost Organic Remedies**: Step-by-step preparation of fermented sour buttermilk spray, Jeevamrit, Neem oil 1500ppm, Dashaparni Ark, and Trichoderma.
  - **Scientific IPM Prescriptions**: ICAR & CIBRC recommended exact chemical salts, commercial formulations, dilution ratios per litre of water, and safety harvest wait times.
- **Voice Read-Out (बोलकर सुनें)**: Uses Web Speech API synthesis so farmers can listen to diagnostic advisories in Hindi or English.
- **Kisan Sahayak AI Agribot**: Multilingual chat assistant answering queries on fertilizer schedules, spray windows, Nano Urea, and organic practices.

### 4. 🏛️ Sarkari Yojana Mitra (Government Schemes Navigator)
- **1-Click Eligibility Wizard**: Instantly matches small, marginal, SC/ST, woman-headed, and tenant farmers to eligible welfare schemes.
- **Comprehensive Scheme Catalog**:
  - **PM-KISAN**: ₹6,000/year direct bank transfer.
  - **PM Fasal Bima Yojana (PMFBY)**: Comprehensive weather and pest crop insurance.
  - **PM-KUSUM**: Up to 90% subsidy for solar agricultural pumps.
  - **SMAM**: 50% to 80% subsidy on farm implements and Custom Hiring Centers.
  - **Soil Health Card Scheme**: Free 12-parameter soil fertility analysis.
  - **Kisan Credit Card (KCC)**: Collateral-free credit up to ₹1.6 Lakh, up to ₹3 Lakh at 4% concessional interest.
  - **PKVY**: ₹50,000/ha subsidy for organic farming clusters.
- **Mandatory Document Checklist**: Dynamic checklist of required documents (Aadhaar, Khasra/Khatauni, Bank Passbook, Tenancy Agreement) and direct links to official government portals.

### 5. 🌦️ Hyperlocal Mausam & Smart Agro-Advisories
- 7-day hyperlocal forecast displaying high/low temperatures, rain probability %, humidity %, and wind velocity.
- Daily agricultural spray & irrigation directives (e.g. spray windows before morning bee pollination, avoiding urea application before forecasted rainfall, frost mitigation).

### 6. 📊 Kisan Khata (Digital Farm Ledger & ROI Calculator)
- Calculates real cost of cultivation per acre (seeds, fertilizers, machinery, labor, irrigation).
- Computes gross revenue, net seasonal profit/loss, and break-even cost per quintal.
- AI Cost-Optimization tips highlighting areas where expenses exceed benchmarks and recommending bio-inputs or equipment pooling.

### 7. 👥 Kisan Chopal (Farmer Experience Exchange & FPO Hub)
- Peer knowledge network where smallholders share verified cost-reduction techniques, nano-urea trials, and community harvester pooling savings.
- Interactive upvoting and discussion submission.

### 8. 🌐 Multilingual & High Accessibility Design
- Language switcher supporting **English**, **हिन्दी (Hindi)**, **ਪੰਜਾਬੀ (Punjabi)**, **मराठी (Marathi)**, **తెలుగు (Telugu)**, and **বাংলা (Bengali)**.
- High-contrast, sunlight-readable earth-tone design (Forest Green, Golden Harvest, Terracotta).
- Mobile bottom navigation bar for field use on smartphones.

---

## Running Kisan Connect on Windows 10

### 1. Install Python dependencies
Open CMD in the extracted `Kisan Connect` folder and run:

```bat
py -m venv .venv
.venv\Scripts\activate
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
```

### 2. Run locally

```bat
py server.py
```

Open `http://127.0.0.1:8000`. The local default is SQLite and creates `kisan_connect_dev.db` in the project folder. API health: `/api/health`; interactive API docs: `/api/docs`.

### 3. Configure PostgreSQL
Create a PostgreSQL database and user, then set the connection string before starting the server. Example for the current CMD session:

```bat
set DATABASE_URL=postgresql+psycopg://kisan_user:YOUR_PASSWORD@localhost:5432/kisan_connect
set COOKIE_SECURE=false
py server.py
```

For a hosted HTTPS deployment, configure `DATABASE_URL` in the hosting provider and set `COOKIE_SECURE=true`. Never commit real passwords, API keys, or `.env` files. `.env.example` documents the supported settings; the application does not automatically load a `.env` file.

### 4. Run backend tests

```bat
py -m unittest discover -s tests -v
```

The tests use a separate temporary SQLite database and check registration, listing persistence, role enforcement, and buyer enquiries.

### 5. Optional first administrator
Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and optionally `ADMIN_NAME` in the server environment before first startup. The app creates that admin only if the email does not already exist. Admin cannot be selected during public registration.

## API overview

- `POST /api/auth/register` — register as farmer, local buyer, or bulk buyer.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` — cookie-based sessions.
- `GET /api/marketplace/listings` — public active listings.
- `POST /api/marketplace/listings`, `GET /api/marketplace/my-listings`, `DELETE /api/marketplace/listings/{id}` — farmer listing management.
- `POST /api/marketplace/listings/{id}/enquiries` — buyer purchase enquiry.
- `GET /api/marketplace/enquiries/incoming`, `PATCH /api/marketplace/enquiries/{id}` — farmer enquiry workflow.
- `GET /api/admin/summary` — admin-only counts.

The browser uses same-origin requests and HttpOnly session cookies. Roles and listing ownership are checked on the server; hiding a button in the frontend is not treated as security.

## 📂 Project Architecture
```
Kisan Connect/
├── index.html          # Core single-page application structure & modals
├── css/
│   └── styles.css      # Complete AgriTech responsive design system
├── js/
│   ├── data.js         # APMC prices, machinery, crop diseases, schemes, & dictionary
│   ├── mandi.js        # Mandi filters, MSP watchdog, & user produce listings
│   ├── machinery.js    # Custom hiring directory, pooling calculator, & booking slip
│   ├── ai-doctor.js    # Disease diagnostic engine, speech audio, & Kisan Sahayak bot
│   ├── schemes.js      # Scheme eligibility wizard & document readiness checklist
│   ├── farm-ledger.js  # Bahi-Khata ROI calculator, weather cards, & community posts
│   └── app.js          # Main bootstrap, tabs routing, multilingual manager, & toasts
├── app.py              # FastAPI routes, authentication, roles, and database models
├── server.py           # Local application launcher
├── requirements.txt    # Python dependencies
├── tests/
│   └── test_api.py      # Backend smoke tests
├── .env.example        # Configuration template
└── README.md           # Documentation
```


## Current limitations and production checklist
- Authentication, server-side role checks, listings, and enquiries are implemented, but need deployment-specific testing and operational monitoring.
- PostgreSQL must be configured for deployed multi-user use. The SQLite default is for local development only.
- Use HTTPS and set `COOKIE_SECURE=true` in production. Add rate limiting, email verification, password reset, account lockout, backups, database migrations, and audit logging before a public production launch.
- Buyer enquiries are stored in the database; there is no email/SMS notification service yet.
- Admin API currently provides summary counts; a full admin management interface is not implemented.
- Mandi/weather cards may still show sample data. Connect and verify official sources before presenting those values as live.
- Uploaded crop photos are not analysed by a real AI model. Do not treat the crop-health reference UI as a diagnosis.
- Scheme rules, links, and crop-treatment guidance need official-source verification.


## Live weather and mandi data

### Weather forecast
- The frontend calls `GET /api/weather/forecast?location=Lucknow` on the backend.
- The backend geocodes the entered place and requests a 7-day forecast from Open-Meteo. No API key is required. Results are cached in memory for 15 minutes.
- If the provider is unreachable or the location cannot be found, the UI shows an error rather than substituting sample forecasts.
- Source: https://open-meteo.com/

### Official mandi prices (preferred)
- Create an API key on https://data.gov.in/ and set `DATA_GOV_IN_API_KEY` in the deployment environment. Do not commit the key to GitHub.
- Optional: set `AGMARKNET_RESOURCE_ID` if the government portal changes the dataset resource identifier. Default is `9ef84268-d588-465a-a308-a864a43d0070`, the commonly published current daily mandi price resource.
- Endpoint: `GET /api/mandi/prices?commodity=Wheat&state=Uttar%20Pradesh&district=Jaunpur`
- The response includes minimum, maximum, modal price, market, variety and arrival date where supplied by the official feed. Rates are wholesale market records and may not reflect the exact price a farmer will receive.
- Official source catalogue: https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi

### Community price reports (fallback)
- Farmers and bulk buyers can submit reports through the Mandi page.
- Community averages appear only when at least three distinct accounts have submitted a report for the same commodity and market within the last three days. Each account contributes at most one report to a group average.
- These reports are unverified and are displayed separately from government data. They must not be described as official mandi rates.
- If the government API key is missing or the upstream API fails, the API returns available community averages and labels the source clearly.

### Deploy environment variables
Set `DATA_GOV_IN_API_KEY` in the hosting dashboard's secret/environment-variable settings. Keep `DATABASE_URL` and all credentials out of source control. The app cannot return official mandi records until a valid data.gov.in API key is configured and the upstream API is accessible.
