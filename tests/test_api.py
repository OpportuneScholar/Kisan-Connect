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

    def test_anonymous_user_cannot_publish_listing(self):
        response = self.client.post("/api/marketplace/listings", json={
            "farmerName": "Anonymous", "phone": "9876543210", "crop": "Rice",
            "quantity": 5, "price": 2000, "location": "Lucknow"
        })
        self.assertEqual(response.status_code, 401)

if __name__ == "__main__":
    unittest.main()
