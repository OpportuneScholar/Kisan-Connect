import os
import unittest

os.environ["DATABASE_URL"] = "sqlite:///./kisan_connect_test.db"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
import app as api

class MarketplaceApiTests(unittest.TestCase):
    def setUp(self):
        api.Base.metadata.drop_all(bind=api.engine)
        api.Base.metadata.create_all(bind=api.engine)
        self.client = TestClient(api.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def register(self, name, email, role):
        response = self.client.post("/api/auth/register", json={
            "name": name, "email": email, "password": "SecureTestPass123", "role": role
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["user"]

    def test_same_origin_guard_accepts_public_origin_behind_reverse_proxy(self):
        response = self.client.post(
            "/api/auth/register",
            headers={
                "origin": "https://kisan-connect.getvoroa.com",
                "x-forwarded-host": "kisan-connect.getvoroa.com",
                "x-forwarded-proto": "https",
            },
            json={"name": "Proxy Test", "email": "proxy@example.com", "password": "SecureTestPass123", "role": "farmer"},
        )
        self.assertEqual(response.status_code, 201, response.text)

    def test_same_origin_guard_accepts_configured_public_origin(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {"PUBLIC_ORIGIN": "https://kisan-connect.getvoroa.com"}):
            response = self.client.post(
                "/api/auth/register",
                headers={"origin": "https://kisan-connect.getvoroa.com"},
                json={"name": "Public Origin Test", "email": "public-origin@example.com", "password": "SecureTestPass123", "role": "farmer"},
            )
        self.assertEqual(response.status_code, 201, response.text)

    def test_same_origin_guard_still_rejects_foreign_origin(self):
        response = self.client.post(
            "/api/auth/register",
            headers={"origin": "https://attacker.example"},
            json={"name": "Blocked Test", "email": "blocked@example.com", "password": "SecureTestPass123", "role": "farmer"},
        )
        self.assertEqual(response.status_code, 403, response.text)

    def test_farmer_can_publish_and_public_can_read_listing(self):
        self.register("Test Farmer", "farmer@example.com", "farmer")
        response = self.client.post("/api/marketplace/listings", json={
            "farmerName": "Client-supplied name", "phone": "9876543210", "crop": "Wheat",
            "quantity": 10, "price": 2400, "location": "Lucknow", "audience": "both"
        })
        self.assertEqual(response.status_code, 201, response.text)
        item = response.json()["item"]
        self.assertEqual(item["farmerName"], "Test Farmer")
        public = self.client.get("/api/marketplace/listings?q=Wheat")
        self.assertEqual(len(public.json()["items"]), 1)

    def test_buyer_can_enquire_but_cannot_publish_listing(self):
        self.register("Test Farmer", "farmer@example.com", "farmer")
        listing = self.client.post("/api/marketplace/listings", json={
            "farmerName": "Test Farmer", "phone": "9876543210", "crop": "Wheat",
            "quantity": 10, "price": 2400, "location": "Lucknow"
        }).json()["item"]
        self.client.post("/api/auth/logout", json={})
        self.register("Test Buyer", "buyer@example.com", "localBuyer")
        blocked = self.client.post("/api/marketplace/listings", json={
            "farmerName": "Test Buyer", "phone": "9876543210", "crop": "Rice",
            "quantity": 5, "price": 2000, "location": "Lucknow"
        })
        self.assertEqual(blocked.status_code, 403)
        enquiry = self.client.post(f"/api/marketplace/listings/{listing['listingId']}/enquiries", json={
            "quantity": 2, "message": "Interested"
        })
        self.assertEqual(enquiry.status_code, 201, enquiry.text)


    def test_weather_forecast_uses_provider_and_returns_seven_day_shape(self):
        import unittest.mock as mock
        geocode = {"results": [{"name": "Lucknow", "admin1": "Uttar Pradesh", "country": "India", "latitude": 26.8, "longitude": 80.9}]}
        forecast = {"timezone": "Asia/Kolkata", "current": {"time": "2026-10-24T08:00", "temperature_2m": 28, "relative_humidity_2m": 55, "apparent_temperature": 29, "precipitation": 0, "weather_code": 1, "wind_speed_10m": 9},
                    "daily": {"time": ["2026-10-24"], "weather_code": [1], "temperature_2m_max": [32], "temperature_2m_min": [21], "precipitation_probability_max": [10], "wind_speed_10m_max": [12]}}
        with mock.patch.object(api, "_http_json", side_effect=[geocode, forecast]):
            response = self.client.get("/api/weather/forecast?location=Lucknow")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["source"], "Open-Meteo")
        self.assertEqual(response.json()["days"][0]["tempMax"], 32)

    def test_community_mandi_average_requires_three_distinct_reporters(self):
        farmers = [("Farmer One", "one@example.com"), ("Farmer Two", "two@example.com"), ("Farmer Three", "three@example.com")]
        for name, email in farmers:
            self.register(name, email, "farmer")
            response = self.client.post("/api/mandi/reports", json={"commodity": "Wheat", "market": "Jaunpur Mandi", "district": "Jaunpur", "state": "Uttar Pradesh", "pricePerQuintal": 2400})
            self.assertEqual(response.status_code, 201, response.text)
            self.client.post("/api/auth/logout", json={})
        result = self.client.get("/api/mandi/prices?commodity=Wheat&district=Jaunpur")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["mode"], "community")
        self.assertEqual(len(result.json()["items"]), 1)
        self.assertEqual(result.json()["items"][0]["reportCount"], 3)
        self.assertEqual(result.json()["items"][0]["averagePrice"], 2400)


    def test_mandi_market_list_uses_official_state_district_records(self):
        from unittest.mock import patch
        rows = [
            {"commodity": "Wheat", "market": "Lucknow", "district": "Lucknow", "state": "Uttar Pradesh",
             "arrivalDate": "24/10/2026", "minPrice": 2300, "maxPrice": 2500, "modalPrice": 2400},
            {"commodity": "Rice", "market": "Mohanlalganj", "district": "Lucknow", "state": "Uttar Pradesh",
             "arrivalDate": "24/10/2026", "minPrice": 2000, "maxPrice": 2200, "modalPrice": 2100},
        ]
        with patch.object(api, "_gov_mandi_prices", return_value=rows):
            response = self.client.get("/api/mandi/markets?state=Uttar%20Pradesh&district=Lucknow")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["items"], ["Lucknow", "Mohanlalganj"])

    def test_data_gov_state_filter_uses_keyword_field(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {"DATA_GOV_IN_API_KEY": "test-key"}), patch.object(api, "_http_json", return_value={"records": []}) as request:
            api._gov_mandi_prices("Wheat", "Uttar Pradesh", "Lucknow", "", 10)
        url = request.call_args.args[0]
        self.assertIn("filters%5Bstate.keyword%5D=Uttar+Pradesh", url)


    def test_new_community_mandi_name_is_saved_and_suggested_to_other_users(self):
        self.register("Mandi Farmer", "mandi-farmer@example.com", "farmer")
        submitted = self.client.post("/api/mandi/reports", json={
            "commodity": "Wheat", "market": "Bela Local Mandi", "district": "Pratapgarh",
            "state": "Uttar Pradesh", "pricePerQuintal": 2450
        })
        self.assertEqual(submitted.status_code, 201, submitted.text)
        self.client.post("/api/auth/logout", json={})
        suggestions = self.client.get("/api/mandi/markets?state=Uttar%20Pradesh&district=Pratapgarh&q=Bela")
        self.assertEqual(suggestions.status_code, 200, suggestions.text)
        self.assertIn("Bela Local Mandi", suggestions.json()["suggestions"])

    def test_farmer_can_publish_machine_and_buyer_can_request_rental(self):
        self.register("Machine Farmer", "machine-farmer@example.com", "farmer")
        listing = self.client.post("/api/machinery/listings", json={
            "name": "Mahindra Tractor", "category": "Tractors", "location": "Malihabad, Lucknow",
            "description": "Available on weekends", "phone": "9876543210",
            "ratePerAcre": 800, "ratePerHour": 0, "operatorIncluded": True, "fuelIncluded": False
        })
        self.assertEqual(listing.status_code, 201, listing.text)
        machine_id = listing.json()["item"]["id"]
        self.client.post("/api/auth/logout", json={})
        self.register("Machine Buyer", "machine-buyer@example.com", "localBuyer")
        result = self.client.post(f"/api/machinery/listings/{machine_id}/rentals", json={
            "phone": "9876501234", "requestedDate": "2026-11-01", "acres": 2, "message": "Need morning slot"
        })
        self.assertEqual(result.status_code, 201, result.text)
        self.assertIn("Rental request sent", result.json()["message"])

    def test_farmer_can_view_rental_requests_for_owned_machines(self):
        self.register("Owner Farmer", "owner-farmer@example.com", "farmer")
        listing = self.client.post("/api/machinery/listings", json={
            "name": "Rotavator", "category": "Rotavators", "location": "Lucknow",
            "phone": "9876543210", "ratePerAcre": 500
        }).json()["item"]
        self.client.post("/api/auth/logout", json={})
        self.register("Rental Buyer", "rental-buyer@example.com", "localBuyer")
        self.client.post(f"/api/machinery/listings/{listing['id']}/rentals", json={
            "phone": "9876501234", "requestedDate": "2026-11-01", "acres": 1
        })
        self.client.post("/api/auth/logout", json={})
        self.client.post("/api/auth/login", json={"email": "owner-farmer@example.com", "password": "SecureTestPass123"})
        incoming = self.client.get("/api/machinery/rentals/incoming")
        self.assertEqual(incoming.status_code, 200, incoming.text)
        self.assertEqual(len(incoming.json()["items"]), 1)
        self.assertEqual(incoming.json()["items"][0]["machineName"], "Rotavator")

    def test_anonymous_user_cannot_publish_listing(self):
        response = self.client.post("/api/marketplace/listings", json={
            "farmerName": "Anonymous", "phone": "9876543210", "crop": "Rice",
            "quantity": 5, "price": 2000, "location": "Lucknow"
        })
        self.assertEqual(response.status_code, 401)

    def test_crop_doctor_reports_missing_backend_key_clearly(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            response = self.client.post("/api/crop-doctor/analyze", json={
                "imageBase64": "A" * 120, "mimeType": "image/jpeg", "crop": "Wheat"
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["detail"])

    def test_crop_doctor_translates_gemini_permission_error(self):
        import urllib.error
        from unittest.mock import patch
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            with patch("app.urllib.request.urlopen", side_effect=urllib.error.HTTPError(
                "https://example.invalid", 403, "Forbidden", {}, None
            )):
                response = self.client.post("/api/crop-doctor/analyze", json={
                    "imageBase64": "A" * 120, "mimeType": "image/jpeg", "crop": "Wheat"
                })
        self.assertEqual(response.status_code, 502)
        self.assertIn("access was denied", response.json()["detail"])

    def test_crop_doctor_translates_gemini_quota_error(self):
        import urllib.error
        from unittest.mock import patch
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            with patch("app.urllib.request.urlopen", side_effect=urllib.error.HTTPError(
                "https://example.invalid", 429, "Too Many Requests", {}, None
            )):
                response = self.client.post("/api/crop-doctor/analyze", json={
                    "imageBase64": "A" * 120, "mimeType": "image/jpeg", "crop": "Wheat"
                })
        self.assertEqual(response.status_code, 502)
        self.assertIn("quota or rate limit", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
