import unittest
import sys
import os

# Add the project root to the path so we can import main
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path setup
from main import app
from fastapi.testclient import TestClient

class TestMain(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Welcome to Trading Journal v3")

if __name__ == "__main__":
    unittest.main()