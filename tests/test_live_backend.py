"""
PlantPulse — Comprehensive Live Backend API Verification Suite
Target: https://plantpulse-backend-qhlo.onrender.com/
"""

import sys
import json
import requests

BASE_URL = "https://plantpulse-backend-qhlo.onrender.com/api"

def run_tests():
    print("====================================================")
    print("🧪 Testing PlantPulse Live Cloud Backend API")
    print(f"Target Base URL: {BASE_URL}")
    print("====================================================\n")

    passed = 0
    total = 0
    session_buyer = requests.Session()
    session_admin = requests.Session()

    def check(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  ✅ PASS: {name}")
            if details:
                print(f"         {details}")
        else:
            print(f"  ❌ FAIL: {name}")
            if details:
                print(f"         {details}")

    # Test 1: Health Check
    print("[1] Health Check Endpoint")
    try:
        r = requests.get(f"{BASE_URL}/health.php", timeout=10)
        data = r.json()
        check("Health Check Returns HTTP 200 & Status Healthy", 
              r.status_code == 200 and data.get("status") == "healthy",
              f"HTTP {r.status_code} | DB: {data.get('database', {}).get('status')}")
    except Exception as e:
        check("Health Check Returns HTTP 200 & Status Healthy", False, str(e))

    # Test 2: Hardware Sensor Catalog
    print("\n[2] Sensor Catalog Endpoint (/shop/catalog.php)")
    try:
        r = requests.get(f"{BASE_URL}/shop/catalog.php", timeout=10)
        data = r.json()
        items = data.get("catalog", [])
        check("Fetch Hardware Sensor Catalog",
              r.status_code == 200 and data.get("success") and len(items) >= 5,
              f"Found {len(items)} hardware sensors in catalog (INR ₹)")
    except Exception as e:
        check("Fetch Hardware Sensor Catalog", False, str(e))

    # Test 3: Buyer Authentication
    print("\n[3] Buyer Authentication (/auth/login.php)")
    buyer_token = None
    try:
        r = session_buyer.post(f"{BASE_URL}/auth/login.php", 
                              json={"email": "buyer@example.com", "password": "user123"}, 
                              timeout=10)
        data = r.json()
        buyer_token = data.get("token")
        check("Buyer Persona Login (buyer@example.com / user123)",
              r.status_code == 200 and data.get("success") and buyer_token is not None,
              f"User: {data.get('user', {}).get('name')} | Role: {data.get('user', {}).get('role')}")
    except Exception as e:
        check("Buyer Persona Login", False, str(e))

    # Test 4: Admin Authentication
    print("\n[4] Admin Authentication (/auth/login.php)")
    admin_token = None
    try:
        r = session_admin.post(f"{BASE_URL}/auth/login.php", 
                              json={"email": "admin@plantmonitor.com", "password": "admin123"}, 
                              timeout=10)
        data = r.json()
        admin_token = data.get("token")
        check("Admin Studio Login (admin@plantmonitor.com / admin123)",
              r.status_code == 200 and data.get("success") and data.get("user", {}).get("role") == "admin",
              f"Admin Token: {admin_token[:25]}...")
    except Exception as e:
        check("Admin Studio Login", False, str(e))

    # Test 5: Auth Check Session Endpoint
    print("\n[5] Session State Verification (/auth/check.php)")
    try:
        headers = {"Authorization": f"Bearer {buyer_token}"} if buyer_token else {}
        r = session_buyer.get(f"{BASE_URL}/auth/check.php", headers=headers, timeout=10)
        data = r.json()
        check("Verify Authenticated Session via Cookie/Bearer",
              r.status_code == 200 and data.get("authenticated") is True,
              f"Authenticated as: {data.get('user', {}).get('email')}")
    except Exception as e:
        check("Verify Authenticated Session", False, str(e))

    # Test 6: Plants List Endpoint
    print("\n[6] Monitored Plants Endpoint (/plants/list.php)")
    first_plant_id = None
    try:
        headers = {"Authorization": f"Bearer {buyer_token}"} if buyer_token else {}
        r = session_buyer.get(f"{BASE_URL}/plants/list.php", headers=headers, timeout=10)
        data = r.json()
        plants = data.get("plants", [])
        if plants:
            first_plant_id = plants[0].get("id")
        check("Fetch Monitored Plants List",
              r.status_code == 200 and data.get("success") and len(plants) >= 4,
              f"Loaded {len(plants)} plants: {', '.join([p['name'] for p in plants[:3]])}...")
    except Exception as e:
        check("Fetch Monitored Plants List", False, str(e))

    # Test 7: Historical Telemetry Readings Endpoint
    print("\n[7] Historical Telemetry Readings (/readings/history.php)")
    try:
        pid = first_plant_id or 1
        headers = {"Authorization": f"Bearer {buyer_token}"} if buyer_token else {}
        r = session_buyer.get(f"{BASE_URL}/readings/history.php?plant_id={pid}", headers=headers, timeout=10)
        data = r.json()
        readings = data.get("readings", [])
        check("Fetch Plant Moisture History Time-Series",
              r.status_code == 200 and data.get("success") and len(readings) > 0,
              f"Plant #{pid} has {len(readings)} historical data points")
    except Exception as e:
        check("Fetch Plant Moisture History", False, str(e))

    # Test 8: Buyer Orders Endpoint
    print("\n[8] Buyer Orders Tracking (/orders/list.php)")
    try:
        headers = {"Authorization": f"Bearer {buyer_token}"} if buyer_token else {}
        r = session_buyer.get(f"{BASE_URL}/orders/list.php", headers=headers, timeout=10)
        data = r.json()
        orders = data.get("orders", [])
        check("Fetch Buyer Hardware Sensor Orders",
              r.status_code == 200 and data.get("success") and len(orders) >= 3,
              f"Loaded {len(orders)} customer orders (delivered, shipped, coding)")
    except Exception as e:
        check("Fetch Buyer Hardware Sensor Orders", False, str(e))

    # Test 9: System Alerts Endpoint
    print("\n[9] Soil Moisture Alerts Endpoint (/alerts/list.php)")
    try:
        headers = {"Authorization": f"Bearer {buyer_token}"} if buyer_token else {}
        r = session_buyer.get(f"{BASE_URL}/alerts/list.php", headers=headers, timeout=10)
        data = r.json()
        alerts = data.get("alerts", [])
        check("Fetch Real-Time Moisture Alerts",
              r.status_code == 200 and data.get("success") and len(alerts) > 0,
              f"Received {len(alerts)} alerts (Unread count: {data.get('unread_count')})")
    except Exception as e:
        check("Fetch Real-Time Moisture Alerts", False, str(e))

    # Test 10: Hardware Sensor Telemetry Ingestion (ESP32 Simulation)
    print("\n[10] Hardware Sensor Ingestion Endpoint (/sensor/ingest.php)")
    try:
        # Send telemetry as an ESP32 hardware device
        telemetry_payload = {
            "sensor_id": "ESP32-ROSE-001",
            "api_key": "api_key_rose_998877",
            "moisture_level": 64.5
        }
        r = requests.post(f"{BASE_URL}/sensor/ingest.php", json=telemetry_payload, timeout=10)
        data = r.json()
        check("Hardware Sensor Data Ingestion (ESP32 Mock)",
              r.status_code == 200 and data.get("success") is True,
              f"Status: {data.get('status')} | New Reading ID: {data.get('reading_id')}")
    except Exception as e:
        check("Hardware Sensor Data Ingestion", False, str(e))

    # Test 11: Admin Orders & Coding Queue
    print("\n[11] Admin Coding Studio Endpoint (/admin/orders.php)")
    try:
        headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
        r = session_admin.get(f"{BASE_URL}/admin/orders.php", headers=headers, timeout=10)
        data = r.json()
        admin_orders = data.get("orders", [])
        check("Admin Orders Queue & Firmware Programming Panel",
              r.status_code == 200 and data.get("success") and len(admin_orders) >= 3,
              f"Admin access granted: {len(admin_orders)} total system orders queued")
    except Exception as e:
        check("Admin Orders Queue", False, str(e))

    print("\n====================================================")
    print(f"📊 SUMMARY: {passed}/{total} TESTS PASSED ({(passed/total)*100:.1f}%)")
    print("====================================================\n")

    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
