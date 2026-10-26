import hashlib
import hmac
import os
import secrets
import json
import logging
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, select, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

logger = logging.getLogger("kisan_connect.crop_doctor")

ROOT = Path(__file__).resolve().parent

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kisan_connect_dev.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://", "postgresql+psycopg://", 1
    )
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

IS_SQLITE = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
SESSION_COOKIE = "kisan_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "7"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class LoginSession(Base):
    __tablename__ = "login_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

class ProduceListing(Base):
    __tablename__ = "produce_listings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    farmer_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(30))
    crop: Mapped[str] = mapped_column(String(120), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    location: Mapped[str] = mapped_column(String(180), index=True)
    audience: Mapped[str] = mapped_column(String(12), default="both")
    organic: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

class MandiPriceReport(Base):
    __tablename__ = "mandi_price_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    commodity: Mapped[str] = mapped_column(String(120), index=True)
    market: Mapped[str] = mapped_column(String(180), index=True)
    district: Mapped[str] = mapped_column(String(120), index=True)
    state: Mapped[str] = mapped_column(String(120), index=True)
    price_per_quintal: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class MandiMarket(Base):
    __tablename__ = "mandi_markets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_key: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    market: Mapped[str] = mapped_column(String(180), index=True)
    district: Mapped[str] = mapped_column(String(120), index=True)
    state: Mapped[str] = mapped_column(String(120), index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class MachineryListing(Base):
    __tablename__ = "machinery_listings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(80), index=True)
    location: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str] = mapped_column(String(1000), default="")
    phone: Mapped[str] = mapped_column(String(30))
    rate_per_acre: Mapped[float] = mapped_column(Float, default=0)
    rate_per_hour: Mapped[float] = mapped_column(Float, default=0)
    operator_included: Mapped[bool] = mapped_column(Boolean, default=False)
    fuel_included: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class MachineryRentalRequest(Base):
    __tablename__ = "machinery_rental_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("machinery_listings.id"), index=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    phone: Mapped[str] = mapped_column(String(30))
    requested_date: Mapped[str] = mapped_column(String(20))
    acres: Mapped[float] = mapped_column(Float)
    message: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

class PurchaseEnquiry(Base):
    __tablename__ = "purchase_enquiries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("produce_listings.id"), index=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    message: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

# An administrator is created only when explicit environment credentials are supplied.
def bootstrap_admin():
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    name = os.getenv("ADMIN_NAME", "Kisan Connect Admin").strip()
    if not email or len(password) < 12:
        return
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)) is None:
            db.add(User(name=name, email=email, password_hash=hash_password(password), role="admin"))
            db.commit()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$", 2)
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def user_payload(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "createdAt": user.created_at.isoformat() if user.created_at else None}


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    session_row = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_digest(token)))
    if not session_row:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    now = datetime.now(timezone.utc)
    expiry = session_row.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= now:
        db.delete(session_row)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    user = db.get(User, session_row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="This account is unavailable.")
    return user


def require_roles(*roles):
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Your account role cannot perform this action.")
        return user
    return checker


def enforce_same_origin(request: Request):
    """Reject cross-site state-changing requests while supporting trusted reverse proxies."""
    origin = request.headers.get("origin")
    if not origin:
        return

    parsed_origin = urllib.parse.urlsplit(origin)
    # Optional explicit public URL is the most reliable setting on managed reverse proxies.
    public_origin = os.getenv("PUBLIC_ORIGIN", "").strip().rstrip("/")
    if public_origin:
        expected = urllib.parse.urlsplit(public_origin)
        same_origin = parsed_origin.scheme.lower() == expected.scheme.lower() and parsed_origin.netloc.lower() == expected.netloc.lower()
    else:
        # A reverse proxy may expose an internal upstream Host to the application.
        forwarded_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
        expected_host = forwarded_host or request.headers.get("host", "")
        forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
        expected_scheme = forwarded_proto or request.url.scheme
        same_origin = parsed_origin.netloc.lower() == expected_host.lower() and parsed_origin.scheme.lower() == expected_scheme.lower()

    if not parsed_origin.netloc or not same_origin:
        raise HTTPException(status_code=403, detail="Cross-origin request blocked.")

class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["farmer", "localBuyer", "bulkBuyer"]

class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class ListingBody(BaseModel):
    farmerName: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=30)
    crop: str = Field(min_length=2, max_length=120)
    quantity: float = Field(gt=0, le=10000000)
    price: float = Field(gt=0, le=100000000)
    location: str = Field(min_length=2, max_length=180)
    audience: Literal["local", "bulk", "both"] = "both"
    organic: bool = False
    notes: str = Field(default="", max_length=1500)



class MandiReportBody(BaseModel):
    commodity: str = Field(min_length=2, max_length=120)
    market: str = Field(min_length=2, max_length=180)
    district: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=120)
    pricePerQuintal: float = Field(gt=0, le=1000000)
    note: str = Field(default="", max_length=300)


class MachineryListingBody(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    category: str = Field(min_length=2, max_length=80)
    location: str = Field(min_length=2, max_length=180)
    description: str = Field(default="", max_length=1000)
    phone: str = Field(min_length=7, max_length=30)
    ratePerAcre: float = Field(default=0, ge=0, le=1000000)
    ratePerHour: float = Field(default=0, ge=0, le=1000000)
    operatorIncluded: bool = False
    fuelIncluded: bool = False


class MachineryRentalBody(BaseModel):
    phone: str = Field(min_length=7, max_length=30)
    requestedDate: str = Field(min_length=8, max_length=20)
    acres: float = Field(gt=0, le=100000)
    message: str = Field(default="", max_length=500)

class EnquiryBody(BaseModel):
    quantity: float = Field(gt=0, le=10000000)
    message: str = Field(default="", max_length=500)

class EnquiryStatusBody(BaseModel):
    status: Literal["new", "contacted", "accepted", "declined", "closed"]

app = FastAPI(title="Kisan Connect API", version="1.0.0", docs_url="/api/docs", redoc_url=None)

@app.on_event("startup")
def startup():
    bootstrap_admin()

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Kisan Connect API", "database": "sqlite-development" if IS_SQLITE else "postgresql"}

@app.post("/api/auth/register", status_code=201)
def register(body: RegisterBody, response: Response, request: Request, db: Session = Depends(get_db)):
    enforce_same_origin(request)
    email = str(body.email).lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    db.flush()
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    db.add(LoginSession(token_hash=token_digest(token), user_id=user.id, expires_at=expires))
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_DAYS * 86400, path="/")
    return {"user": user_payload(user)}

@app.post("/api/auth/login")
def login(body: LoginBody, response: Response, request: Request, db: Session = Depends(get_db)):
    enforce_same_origin(request)
    email = str(body.email).lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    db.add(LoginSession(token_hash=token_digest(token), user_id=user.id, expires_at=expires))
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_DAYS * 86400, path="/")
    return {"user": user_payload(user)}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_payload(user)}

@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_digest(token)))
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")
    return {"ok": True}


def listing_payload(item: ProduceListing):
    created = item.created_at
    if created and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {"id": f"listing-{item.id}", "listingId": item.id, "sellerId": item.seller_id, "farmerName": item.farmer_name, "phone": item.phone, "crop": item.crop, "quantity": item.quantity, "unit": "Quintals", "price": item.price, "location": item.location, "date": created.strftime("%d %b %Y") if created else "Recently", "organic": item.organic, "notes": item.notes, "audience": item.audience, "sample": False}

@app.get("/api/marketplace/listings")
def get_listings(q: str | None = None, audience: Literal["local", "bulk", "both"] | None = None, db: Session = Depends(get_db)):
    query = select(ProduceListing).where(ProduceListing.active.is_(True)).order_by(ProduceListing.created_at.desc()).limit(200)
    if audience in ("local", "bulk"):
        query = query.where(ProduceListing.audience.in_([audience, "both"]))
    items = list(db.scalars(query))
    if q:
        needle = q.strip().casefold()
        items = [item for item in items if needle in item.crop.casefold() or needle in item.location.casefold() or needle in item.farmer_name.casefold()]
    return {"items": [listing_payload(item) for item in items]}

@app.post("/api/marketplace/listings", status_code=201)
def create_listing(body: ListingBody, user: User = Depends(require_roles("farmer")), db: Session = Depends(get_db)):
    item = ProduceListing(seller_id=user.id, farmer_name=user.name, phone=body.phone.strip(), crop=body.crop.strip(), quantity=body.quantity, price=body.price, location=body.location.strip(), audience=body.audience, organic=body.organic, notes=body.notes.strip())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"item": listing_payload(item)}

@app.get("/api/marketplace/my-listings")
def my_listings(user: User = Depends(require_roles("farmer")), db: Session = Depends(get_db)):
    items = db.scalars(select(ProduceListing).where(ProduceListing.seller_id == user.id).order_by(ProduceListing.created_at.desc()))
    return {"items": [listing_payload(item) for item in items]}

@app.delete("/api/marketplace/listings/{listing_id}")
def delete_listing(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(ProduceListing, listing_id)
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found.")
    if item.seller_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only remove your own listing.")
    item.active = False
    db.commit()
    return {"ok": True}

@app.post("/api/marketplace/listings/{listing_id}/enquiries", status_code=201)
def create_enquiry(listing_id: int, body: EnquiryBody, user: User = Depends(require_roles("localBuyer", "bulkBuyer", "admin")), db: Session = Depends(get_db)):
    listing = db.get(ProduceListing, listing_id)
    if not listing or not listing.active:
        raise HTTPException(status_code=404, detail="This listing is no longer available.")
    if listing.seller_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot enquire about your own listing.")
    if body.quantity > listing.quantity:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds the listed quantity.")
    enquiry = PurchaseEnquiry(listing_id=listing.id, buyer_id=user.id, quantity=body.quantity, message=body.message.strip())
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return {"id": enquiry.id, "status": enquiry.status, "message": "Enquiry submitted. The seller can review it after signing in."}

@app.get("/api/marketplace/enquiries/incoming")
def incoming_enquiries(user: User = Depends(require_roles("farmer", "admin")), db: Session = Depends(get_db)):
    query = select(PurchaseEnquiry, ProduceListing, User).join(ProduceListing, PurchaseEnquiry.listing_id == ProduceListing.id).join(User, PurchaseEnquiry.buyer_id == User.id)
    if user.role != "admin":
        query = query.where(ProduceListing.seller_id == user.id)
    rows = db.execute(query.order_by(PurchaseEnquiry.created_at.desc())).all()
    return {"items": [{"id": enquiry.id, "listingId": listing.id, "crop": listing.crop, "buyerName": buyer.name, "buyerRole": buyer.role, "quantity": enquiry.quantity, "message": enquiry.message, "status": enquiry.status, "createdAt": enquiry.created_at.isoformat()} for enquiry, listing, buyer in rows]}

@app.patch("/api/marketplace/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: int, body: EnquiryStatusBody, user: User = Depends(require_roles("farmer", "admin")), db: Session = Depends(get_db)):
    enquiry = db.get(PurchaseEnquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    listing = db.get(ProduceListing, enquiry.listing_id)
    if user.role != "admin" and (not listing or listing.seller_id != user.id):
        raise HTTPException(status_code=403, detail="You can only update enquiries for your own listings.")
    enquiry.status = body.status
    db.commit()
    return {"ok": True, "status": enquiry.status}

@app.get("/api/admin/summary")
def admin_summary(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return {"users": len(list(db.scalars(select(User.id)))), "activeListings": len(list(db.scalars(select(ProduceListing.id).where(ProduceListing.active.is_(True))))), "enquiries": len(list(db.scalars(select(PurchaseEnquiry.id))))}



# Public weather forecast uses Open-Meteo; no browser-side API key is required.
_weather_cache = {}
_mandi_cache = {"expires": 0, "items": []}


def _http_json(url: str, timeout: int = 12):
    request = urllib.request.Request(url, headers={"User-Agent": "KisanConnect/1.0 (agriculture prototype)"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"Upstream service returned HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def _weather_label(code: int) -> str:
    labels = {0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy rain showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm"}
    return labels.get(code, "Variable conditions")


@app.get("/api/weather/forecast")
def weather_forecast(location: str = "Lucknow"):
    place = location.strip()[:100]
    if len(place) < 2:
        raise HTTPException(status_code=400, detail="Enter a village, town or city name.")
    cache_key = place.casefold()
    cached = _weather_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]
    try:
        geocode_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({"name": place, "count": 1, "language": "en", "format": "json"})
        geodata = _http_json(geocode_url)
        places = geodata.get("results") or []
        if not places:
            raise HTTPException(status_code=404, detail="Location not found. Try a nearby town or district.")
        chosen = places[0]
        forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode({
            "latitude": chosen["latitude"], "longitude": chosen["longitude"],
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
            "timezone": "Asia/Kolkata", "forecast_days": 7
        })
        raw = _http_json(forecast_url)
        daily = raw.get("daily", {})
        days = []
        for i, date_value in enumerate(daily.get("time", [])):
            code = int((daily.get("weather_code") or [0] * 7)[i] or 0)
            days.append({"date": date_value, "condition": _weather_label(code), "weatherCode": code,
                         "tempMax": (daily.get("temperature_2m_max") or [None] * 7)[i],
                         "tempMin": (daily.get("temperature_2m_min") or [None] * 7)[i],
                         "rainChance": (daily.get("precipitation_probability_max") or [None] * 7)[i],
                         "windKmH": (daily.get("wind_speed_10m_max") or [None] * 7)[i]})
        current = raw.get("current", {})
        result = {"source": "Open-Meteo", "sourceUrl": "https://open-meteo.com/", "location": ", ".join(x for x in [chosen.get("name"), chosen.get("admin1"), chosen.get("country")] if x),
                  "timezone": raw.get("timezone", "Asia/Kolkata"), "updatedAt": current.get("time"),
                  "current": {"temperature": current.get("temperature_2m"), "feelsLike": current.get("apparent_temperature"), "humidity": current.get("relative_humidity_2m"), "precipitation": current.get("precipitation"), "windKmH": current.get("wind_speed_10m"), "condition": _weather_label(int(current.get("weather_code") or 0))}, "days": days}
        _weather_cache[cache_key] = (time.time() + 900, result)
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Weather provider is temporarily unavailable. Please retry shortly.")


def _gov_mandi_prices(commodity: str, state: str, district: str, market: str, limit: int):
    api_key = os.getenv("DATA_GOV_IN_API_KEY", "").strip()
    if not api_key:
        return None
    resource_id = os.getenv("AGMARKNET_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070").strip()
    params = {"api-key": api_key, "format": "json", "limit": min(max(limit, 1), 100), "sort[arrival_date]": "desc"}
    # The AGMARKNET resource exposes state as a keyword field; using filters[state]
    # can return an empty set even when matching records exist.
    for field, value in (("commodity", commodity), ("state.keyword", state), ("district", district), ("market", market)):
        if value:
            params[f"filters[{field}]"] = value
    url = f"https://api.data.gov.in/resource/{urllib.parse.quote(resource_id)}?{urllib.parse.urlencode(params)}"
    data = _http_json(url, timeout=15)
    records = data.get("records") or []
    rows = []
    for row in records:
        try:
            rows.append({"commodity": row.get("commodity", ""), "variety": row.get("variety", ""), "market": row.get("market", ""),
                         "district": row.get("district", ""), "state": row.get("state", ""), "arrivalDate": row.get("arrival_date", ""),
                         "minPrice": float(row.get("min_price")), "maxPrice": float(row.get("max_price")), "modalPrice": float(row.get("modal_price")),
                         "unit": "₹/quintal", "source": "AGMARKNET / data.gov.in", "verifiedSource": True})
        except (TypeError, ValueError):
            continue
    return rows


@app.get("/api/mandi/prices")
def mandi_prices(commodity: str = "", state: str = "", district: str = "", market: str = "", limit: int = 30, db: Session = Depends(get_db)):
    commodity, state, district, market = [x.strip()[:120] for x in (commodity, state, district, market)]
    official_status = "not_configured"
    try:
        official = _gov_mandi_prices(commodity, state, district, market, limit)
        # Market names can vary in capitalization/spelling across the portal. If an exact
        # market filter returns nothing, retry the same crop/state/district without it,
        # then match the market locally without case sensitivity.
        if official == [] and market:
            broader = _gov_mandi_prices(commodity, state, district, "", limit)
            if broader is not None:
                official = [row for row in broader if market.casefold() in str(row.get("market", "")).casefold()]
        if official:
            return {"source": "AGMARKNET / data.gov.in", "mode": "official", "officialStatus": "available", "items": official, "updatedAt": datetime.now(timezone.utc).isoformat(),
                    "message": "Official market records; arrival date is shown per record. Prices can vary by variety and quality."}
        if official is not None:
            official_status = "no_matching_records"
    except Exception:
        official_status = "temporarily_unavailable"
    if os.getenv("DATA_GOV_IN_API_KEY", "").strip() and official_status == "not_configured":
        official_status = "temporarily_unavailable"
    query = select(MandiPriceReport)
    if commodity:
        query = query.where(func.lower(MandiPriceReport.commodity).contains(commodity.casefold()))
    if state:
        query = query.where(func.lower(MandiPriceReport.state) == state.casefold())
    if district:
        query = query.where(func.lower(MandiPriceReport.district) == district.casefold())
    if market:
        query = query.where(func.lower(MandiPriceReport.market).contains(market.casefold()))
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)
    query = query.where(MandiPriceReport.created_at >= cutoff).order_by(MandiPriceReport.created_at.desc()).limit(500)
    reports = list(db.scalars(query))
    groups = {}
    for item in reports:
        key = (item.commodity.casefold(), item.market.casefold(), item.district.casefold(), item.state.casefold())
        groups.setdefault(key, []).append(item)
    averages = []
    for values in groups.values():
        # Count each account once per crop/market window to reduce duplicate-report manipulation.
        latest_by_reporter = {}
        for report in values:
            previous = latest_by_reporter.get(report.reporter_id)
            if previous is None or report.created_at > previous.created_at:
                latest_by_reporter[report.reporter_id] = report
        distinct_reports = list(latest_by_reporter.values())
        if len(distinct_reports) < 3:
            continue
        prices = sorted(x.price_per_quintal for x in distinct_reports)
        averages.append({"commodity": distinct_reports[0].commodity, "market": distinct_reports[0].market, "district": distinct_reports[0].district, "state": distinct_reports[0].state,
                         "averagePrice": round(sum(prices) / len(prices), 2), "minReportedPrice": round(prices[0], 2), "maxReportedPrice": round(prices[-1], 2),
                         "reportCount": len(distinct_reports), "lastReportedAt": max(x.created_at for x in distinct_reports).isoformat(), "unit": "₹/quintal",
                         "source": "Community reports", "verifiedSource": False})
    message = "Community averages appear only after at least 3 distinct accounts report the same crop and market within the last 3 days. These are not official prices."
    if official_status == "temporarily_unavailable":
        message += " The government data provider is currently unavailable; showing community reports only."
    elif official_status == "no_matching_records":
        message += " The official feed responded, but no government records matched these filters. Try a different crop, district, or mandi."
    else:
        message += " Configure DATA_GOV_IN_API_KEY to enable official AGMARKNET records."
    return {"source": "Community reports", "mode": "community", "officialStatus": official_status, "items": averages[:limit], "updatedAt": datetime.now(timezone.utc).isoformat(), "message": message}


@app.get("/api/mandi/markets")
def mandi_markets(state: str = "", district: str = "", q: str = "", db: Session = Depends(get_db)):
    """Merge current official names with community-added names stored permanently in the database."""
    state, district, q = state.strip()[:120], district.strip()[:120], q.strip()[:100]
    if not state or not district:
        return {"source": "Kisan Connect + AGMARKNET", "items": [], "savedItems": [], "suggestions": [],
                "message": "Choose a state and district to load market names."}
    saved = list(db.scalars(select(MandiMarket).where(
        func.lower(MandiMarket.state) == state.casefold(),
        func.lower(MandiMarket.district) == district.casefold()
    ).order_by(MandiMarket.market.asc()).limit(500)))
    saved_names = {row.market.strip() for row in saved if row.market.strip()}
    official_names = set()
    try:
        rows = _gov_mandi_prices("", state, district, "", 100)
        for row in rows or []:
            name = str(row.get("market", "")).strip()
            if name:
                official_names.add(name)
    except Exception:
        # Community-saved markets must remain available even if the official feed fails.
        pass
    names = sorted(official_names, key=str.casefold)
    suggestions = sorted(saved_names | official_names, key=str.casefold)
    if q:
        needle = q.casefold()
        suggestions = [name for name in suggestions if needle in name.casefold()]
    return {"source": "Kisan Connect + AGMARKNET", "items": names, "savedItems": sorted(saved_names, key=str.casefold),
            "suggestions": suggestions[:100],
            "message": "Official and community-saved markets." if suggestions else "No saved match yet. Type the local mandi name and submit a report to save it."}


@app.post("/api/mandi/reports", status_code=201)
def submit_mandi_report(body: MandiReportBody, user: User = Depends(require_roles("farmer", "bulkBuyer", "localBuyer")), db: Session = Depends(get_db)):
    clean = lambda value: " ".join(value.strip().split())
    commodity, market, district, state = (clean(body.commodity), clean(body.market), clean(body.district), clean(body.state))
    # Save each new market once. Later users can autocomplete the same canonical name.
    market_key = "|".join(part.casefold() for part in (state, district, market))
    saved_market = db.scalar(select(MandiMarket).where(MandiMarket.market_key == market_key))
    if saved_market:
        market = saved_market.market
    else:
        db.add(MandiMarket(market_key=market_key, market=market, district=district, state=state, created_by=user.id))
    item = MandiPriceReport(reporter_id=user.id, commodity=commodity, market=market, district=district,
                            state=state, price_per_quintal=body.pricePerQuintal, note=body.note.strip())
    db.add(item)
    db.commit()
    return {"ok": True, "market": market, "message": "Price report submitted. This mandi name is now saved for future suggestions. Community averages still require three distinct recent accounts."}


@app.get("/api/machinery/listings")
def get_machinery_listings(q: str = "", category: str = "", db: Session = Depends(get_db)):
    query = select(MachineryListing).where(MachineryListing.active.is_(True)).order_by(MachineryListing.created_at.desc()).limit(300)
    items = list(db.scalars(query))
    if q.strip():
        needle = q.strip().casefold()
        items = [item for item in items if needle in item.name.casefold() or needle in item.category.casefold() or needle in item.location.casefold() or needle in item.description.casefold()]
    if category.strip():
        items = [item for item in items if item.category.casefold() == category.strip().casefold()]
    return {"items": [{"id": item.id, "name": item.name, "category": item.category, "location": item.location,
        "description": item.description, "phone": item.phone, "ownerName": (db.get(User, item.owner_id).name if db.get(User, item.owner_id) else "Farmer"),
        "ratePerAcre": item.rate_per_acre, "ratePerHour": item.rate_per_hour, "operatorIncluded": item.operator_included,
        "fuelIncluded": item.fuel_included, "createdAt": item.created_at.isoformat() if item.created_at else None} for item in items]}


@app.post("/api/machinery/listings", status_code=201)
def create_machinery_listing(body: MachineryListingBody, user: User = Depends(require_roles("farmer")), db: Session = Depends(get_db)):
    if body.ratePerAcre <= 0 and body.ratePerHour <= 0:
        raise HTTPException(status_code=422, detail="Enter a rental rate per acre or per hour.")
    item = MachineryListing(owner_id=user.id, name=" ".join(body.name.split()), category=" ".join(body.category.split()),
        location=" ".join(body.location.split()), description=body.description.strip(), phone=body.phone.strip(),
        rate_per_acre=body.ratePerAcre, rate_per_hour=body.ratePerHour,
        operator_included=body.operatorIncluded, fuel_included=body.fuelIncluded)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"item": {"id": item.id, "name": item.name, "category": item.category, "location": item.location,
        "description": item.description, "phone": item.phone, "ownerName": user.name, "ratePerAcre": item.rate_per_acre,
        "ratePerHour": item.rate_per_hour, "operatorIncluded": item.operator_included, "fuelIncluded": item.fuel_included,
        "createdAt": item.created_at.isoformat() if item.created_at else None}}


@app.get("/api/machinery/rentals/incoming")
def incoming_machinery_rentals(user: User = Depends(require_roles("farmer")), db: Session = Depends(get_db)):
    rows = db.execute(
        select(MachineryRentalRequest, MachineryListing, User)
        .join(MachineryListing, MachineryRentalRequest.listing_id == MachineryListing.id)
        .join(User, MachineryRentalRequest.requester_id == User.id)
        .where(MachineryListing.owner_id == user.id)
        .order_by(MachineryRentalRequest.created_at.desc())
    ).all()
    return {"items": [{"id": rental.id, "listingId": listing.id, "machineName": listing.name,
        "requesterName": requester.name, "phone": rental.phone, "requestedDate": rental.requested_date,
        "acres": rental.acres, "message": rental.message, "status": rental.status,
        "createdAt": rental.created_at.isoformat() if rental.created_at else None}
        for rental, listing, requester in rows]}
@app.post("/api/machinery/listings/{listing_id}/rentals", status_code=201)
def request_machinery_rental(listing_id: int, body: MachineryRentalBody, user: User = Depends(require_roles("farmer", "localBuyer", "bulkBuyer")), db: Session = Depends(get_db)):
    item = db.get(MachineryListing, listing_id)
    if not item or not item.active:
        raise HTTPException(status_code=404, detail="This machine listing is no longer available.")
    if item.owner_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot request to rent your own machine.")
    rental = MachineryRentalRequest(listing_id=item.id, requester_id=user.id, phone=body.phone.strip(),
        requested_date=body.requestedDate, acres=body.acres, message=body.message.strip())
    db.add(rental)
    db.commit()
    return {"ok": True, "message": "Rental request sent to the machine owner. The owner can contact you using the phone number you provided."}




class CropDoctorBody(BaseModel):
    imageBase64: str = Field(min_length=100, max_length=11_200_000)
    mimeType: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    crop: str = Field(default="", max_length=100)

@app.post("/api/crop-doctor/analyze")
def crop_doctor_analyze(body: CropDoctorBody):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.error("Crop Doctor request rejected: GEMINI_API_KEY is missing from the backend environment.")
        raise HTTPException(status_code=503, detail="AI Crop Doctor is not configured on the backend. Verify GEMINI_API_KEY in the backend service environment, then restart/redeploy it.")
    if len(body.imageBase64) > 11_000_000:
        raise HTTPException(status_code=413, detail="Image is too large. Upload a smaller image (maximum 8 MB).")
    try:
        prompt = (
            "You are a cautious agricultural crop-health assistant. Inspect this plant image. "
            "Return JSON with fields: observations, possibleCauses (array), confidence (low/medium/high), "
            "safeNextSteps (array), whenToContactExpert. Do not prescribe pesticide dosage or claim certainty. "
            "Ask for a clearer photo if needed. Crop context: " + (body.crop or "not specified")
        )
        payload = {"contents":[{"parts":[{"text":prompt},{"inline_data":{"mime_type":body.mimeType,"data":body.imageBase64}}]}],
                   "generationConfig":{"responseMimeType":"application/json","temperature":0.2}}
        endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + urllib.parse.quote(api_key)
        req = urllib.request.Request(endpoint, data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=35) as response:
            result = json.loads(response.read().decode())
        candidates = result.get("candidates") or []
        parts = ((candidates[0].get("content") or {}).get("parts") or []) if candidates else []
        raw = next((part.get("text") for part in parts if part.get("text")), "")
        if not raw:
            raise ValueError("No analysis returned")
        parsed = json.loads(raw)
        return {"source":"Gemini Vision","disclaimer":"AI suggestions can be wrong. Confirm diagnosis with a qualified agricultural expert; follow only approved product labels.","analysis":parsed}
    except HTTPException:
        raise
    except urllib.error.HTTPError as exc:
        # Do not log the request URL: the Gemini API key is included in its query string.
        try:
            provider_error = exc.read().decode("utf-8", errors="replace")[:1200]
        except Exception:
            provider_error = ""
        logger.error("Gemini Crop Doctor HTTP failure status=%s provider_response=%s", exc.code, provider_error or "(empty)")
        if exc.code in (401, 403):
            detail = "Gemini API access was denied. Verify GEMINI_API_KEY in the backend environment and confirm Gemini API access is enabled."
        elif exc.code == 429:
            detail = "Gemini quota or rate limit reached. Check API quota/billing and retry later."
        elif exc.code in (400, 404):
            detail = "Gemini rejected the request or model. Check the model/API access and image format in backend logs."
        else:
            detail = "Gemini is temporarily unable to analyse this photo. Check backend logs and retry."
        raise HTTPException(status_code=502, detail=detail) from exc
    except urllib.error.URLError as exc:
        logger.error("Gemini Crop Doctor network failure: %s", getattr(exc, "reason", "unknown network error"))
        raise HTTPException(status_code=502, detail="The backend could not connect to Gemini. Check service network access and retry.") from exc
    except TimeoutError as exc:
        logger.error("Gemini Crop Doctor request timed out after 35 seconds.")
        raise HTTPException(status_code=504, detail="Gemini analysis timed out. Try a smaller photo.") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Gemini Crop Doctor returned an invalid response (%s).", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Gemini returned an unreadable response. Please retry.") from exc
    except Exception as exc:
        logger.exception("Unexpected Crop Doctor failure (%s).", type(exc).__name__)
        raise HTTPException(status_code=502, detail="AI analysis failed unexpectedly. Check backend logs and retry.") from exc

@app.get("/api/schemes/updates")
def scheme_updates():
    """Read a configured official JSON feed; without it, return no invented announcements."""
    feed_url = os.getenv("SCHEME_FEED_URL", "").strip()
    if not feed_url:
        return {"source":"official_portals","items":[],"checkedAt":datetime.now(timezone.utc).isoformat(),
                "message":"No official JSON scheme feed is configured. No new schemes are being invented; check myScheme.gov.in, PIB and India.gov.in for current announcements."}
    if not feed_url.startswith("https://"):
        raise HTTPException(status_code=500, detail="SCHEME_FEED_URL must use HTTPS.")
    try:
        payload = _http_json(feed_url, timeout=15)
        records = payload.get("items") or payload.get("records") or payload.get("results") or []
        items=[]
        for item in records[:50]:
            title=str(item.get("title") or item.get("name") or "").strip()[:240]
            url=str(item.get("url") or item.get("link") or "").strip()
            if not title or not url.startswith("https://"):
                continue
            items.append({"title":title,"summary":str(item.get("summary") or item.get("description") or "")[:1000],
                          "date":str(item.get("date") or item.get("publishedAt") or "")[:80],"url":url})
        return {"source":"configured_official_feed","items":items,"checkedAt":datetime.now(timezone.utc).isoformat(),
                "message":f"Checked the configured feed. {len(items)} item(s) returned; verify each announcement on its official portal."}
    except Exception:
        raise HTTPException(status_code=502, detail="The configured official scheme feed is temporarily unavailable.")


app.mount("/css", StaticFiles(directory=ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT / "js"), name="js")

@app.get("/", include_in_schema=False)
def homepage():
    return FileResponse(ROOT / "index.html")

@app.get("/{asset_path:path}", include_in_schema=False)
def frontend_assets(asset_path: str):
    candidate = (ROOT / asset_path).resolve()
    if not candidate.is_relative_to(ROOT) or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(candidate)
