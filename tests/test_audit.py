"""
PlantPulse Automated Quality Audit & Contract Verification Test Suite
"""
import os
import sys
import json
import re
import urllib.request
import urllib.error
import http.server
import socketserver
import threading
import time

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_DIR = os.path.join(ROOT_DIR, "android-app", "app", "src", "main", "assets", "web")

passed_tests = []
failed_tests = []

def run_test(name, func):
    try:
        func()
        print(f"[PASS] {name}")
        passed_tests.append(name)
    except AssertionError as e:
        print(f"[FAIL] {name}: {e}")
        failed_tests.append((name, str(e)))
    except Exception as e:
        print(f"[ERROR] {name}: {e}")
        failed_tests.append((name, str(e)))

# ----------------------------------------------------
# 1. FILE SYNCHRONIZATION TEST
# ----------------------------------------------------
def test_file_synchronization():
    files_to_check = [
        "index.html", "register.html", "dashboard.html",
        "plant-detail.html", "add-plant.html", "shop.html",
        "my-orders.html", "simulator.html", "admin.html",
        "css/style.css", "js/auth.js", "js/dashboard.js",
        "js/plant-detail.js", "js/add-plant.js", "js/shop.js",
        "js/simulator.js", "js/admin.js", "js/config.js"
    ]
    for rel in files_to_check:
        root_path = os.path.join(ROOT_DIR, rel)
        asset_path = os.path.join(ASSETS_DIR, rel)
        assert os.path.exists(root_path), f"Root file missing: {rel}"
        assert os.path.exists(asset_path), f"Asset file missing: {rel}"
        with open(root_path, "rb") as f1, open(asset_path, "rb") as f2:
            assert f1.read() == f2.read(), f"File out of sync between root and Android assets: {rel}"

# ----------------------------------------------------
# 2. HTML STRUCTURE & ACCESSIBILITY TEST
# ----------------------------------------------------
def test_html_structure_and_accessibility():
    html_files = [
        "index.html", "register.html", "dashboard.html",
        "plant-detail.html", "add-plant.html", "shop.html",
        "my-orders.html", "simulator.html", "admin.html"
    ]
    for hf in html_files:
        path = os.path.join(ROOT_DIR, hf)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        # Viewport check
        assert 'name="viewport"' in content, f"Missing viewport tag in {hf}"

        # Duplicate ID check
        ids = re.findall(r'id=["\']([^"\']+)["\']', content)
        id_counts = {}
        for elem_id in ids:
            id_counts[elem_id] = id_counts.get(elem_id, 0) + 1
        duplicates = [i for i, c in id_counts.items() if c > 1]
        assert len(duplicates) == 0, f"Duplicate IDs found in {hf}: {duplicates}"

        # Check mobile menu toggle exists on internal app pages
        if hf not in ["index.html", "register.html", "privacy-policy.html"]:
            assert "mobile-menu-btn" in content, f"Missing mobile menu button in {hf}"

        # Check forms have labels with 'for' attribute
        input_ids = re.findall(r'<input[^>]+id=["\']([^"\']+)["\']', content)
        for iid in input_ids:
            if iid in ["modal-catalog-id", "code-order-id"]:  # hidden inputs
                continue
            has_for = f'for="{iid}"' in content or f"for='{iid}'" in content or 'aria-label' in content
            assert has_for, f"Input #{iid} in {hf} lacks an associated label or aria-label"

# ----------------------------------------------------
# 3. CSS TOKEN & RESPONSIVENESS INTEGRITY
# ----------------------------------------------------
def test_css_integrity():
    css_path = os.path.join(ROOT_DIR, "css", "style.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".btn.active-filter" in css, "Missing active-filter styling in style.css"
    assert ".mobile-menu-btn" in css, "Missing mobile-menu-btn styling in style.css"
    assert ".sidebar-backdrop" in css, "Missing sidebar-backdrop styling in style.css"
    assert "max-height: 90vh" in css, "Missing max-height on modal in style.css"
    assert ":focus-visible" in css, "Missing :focus-visible rules in style.css"

    # Bracket balance check
    open_brackets = css.count("{")
    close_brackets = css.count("}")
    assert open_brackets == close_brackets, f"CSS bracket mismatch: {open_brackets} open vs {close_brackets} close"

# ----------------------------------------------------
# 4. JS AUDIT: NO DUPLICATE LISTENERS & DEBOUNCED ACTIONS
# ----------------------------------------------------
def test_javascript_event_listeners():
    # plant-detail.js should not attach duplicate logout listener
    with open(os.path.join(ROOT_DIR, "js", "plant-detail.js"), "r", encoding="utf-8") as f:
        pd = f.read()
    assert "document.getElementById('logout-btn')?.addEventListener" not in pd, \
        "Duplicate logout-btn event listener found in plant-detail.js"

    # add-plant.js should not attach duplicate logout listener
    with open(os.path.join(ROOT_DIR, "js", "add-plant.js"), "r", encoding="utf-8") as f:
        ap = f.read()
    assert "document.getElementById('logout-btn')?.addEventListener" not in ap, \
        "Duplicate logout-btn event listener found in add-plant.js"

    # dashboard.js should not have conflicting alert bell listener
    with open(os.path.join(ROOT_DIR, "js", "dashboard.js"), "r", encoding="utf-8") as f:
        db = f.read()
    assert "redirectTo('dashboard.html#alerts')" not in db, \
        "Conflicting alert bell redirect listener found in dashboard.js"

    # Repeated tap / debounce check
    with open(os.path.join(ROOT_DIR, "js", "simulator.js"), "r", encoding="utf-8") as f:
        sim = f.read()
    assert "if (btn.disabled) return;" in sim, "Missing button debounce in simulator.js"

    with open(os.path.join(ROOT_DIR, "js", "admin.js"), "r", encoding="utf-8") as f:
        adm = f.read()
    assert "if (saveBtn.disabled) return;" in adm, "Missing save button debounce in admin.js"

    with open(os.path.join(ROOT_DIR, "js", "shop.js"), "r", encoding="utf-8") as f:
        shp = f.read()
    assert "if (payBtn.disabled) return;" in shp, "Missing payment button debounce in shop.js"

# ----------------------------------------------------
# 5. PHP BACKEND CONTRACT & SYNTAX VALIDATION
# ----------------------------------------------------
def test_php_backend_contracts():
    history_php = os.path.join(ROOT_DIR, "api", "readings", "history.php")
    with open(history_php, "r", encoding="utf-8") as f:
        h_code = f.read()
    # Ensure LIMIT clause does not use 'LIMIT ?' parameter binding that fails on PDO ATTR_EMULATE_PREPARES=false
    assert "LIMIT ?" not in h_code, "Unsafe 'LIMIT ?' parameter binding found in history.php"
    assert "LIMIT $limit" in h_code or "LIMIT " in h_code, "Expected safe clamped limit in history.php"

    # Check that required core routes exist and requireAuth / requireAdmin is used properly
    protected_endpoints = [
        ("api/plants/list.php", "requireAuth()"),
        ("api/plants/add.php", "requireAuth()"),
        ("api/plants/delete.php", "requireAuth()"),
        ("api/orders/list.php", "requireAuth()"),
        ("api/orders/create.php", "requireAuth()"),
        ("api/alerts/list.php", "requireAuth()"),
        ("api/admin/orders.php", "requireAdmin()"),
        ("api/admin/code_sensor.php", "requireAdmin()"),
        ("api/admin/update_status.php", "requireAdmin()")
    ]
    for ep, auth_call in protected_endpoints:
        path = os.path.join(ROOT_DIR, ep)
        assert os.path.exists(path), f"Missing endpoint file: {ep}"
        with open(path, "r", encoding="utf-8") as f:
            code = f.read()
        assert auth_call in code, f"{ep} is missing required protection call: {auth_call}"

# ----------------------------------------------------
# 6. MOCK API SERVER TESTING (SUCCESS, FAILURE, EMPTY, TIMEOUT)
# ----------------------------------------------------
class MockApiHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return  # Suppress console log spam

    def do_GET(self):
        if self.path.startswith("/api/auth/check.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "authenticated": True,
                "user": {"id": 1, "name": "Test User", "email": "test@example.com", "role": "user"}
            }).encode())
        elif self.path.startswith("/api/plants/list.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "plants": [
                    {
                        "id": 101, "name": "Living Room Rose", "type": "Rose", "location": "Indoor",
                        "emoji": "🌹", "ideal_moisture_min": 40, "ideal_moisture_max": 70,
                        "sensor_id": "SENSOR_ROSE_01", "moisture_level": 55.4, "status": "good",
                        "last_reading_time": "2026-10-11 08:30:00"
                    }
                ]
            }).encode())
        elif self.path.startswith("/api/alerts/list.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "alerts": [
                    {
                        "id": 1, "plant_id": 101, "message": "Rose moisture is optimal",
                        "alert_type": "good", "is_read": 0, "created_at": "2026-10-11 08:30:00",
                        "plant_name": "Living Room Rose", "plant_emoji": "🌹"
                    }
                ],
                "unread_count": 1
            }).encode())
        elif self.path.startswith("/api/readings/history.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "plant": {"id": 101, "name": "Living Room Rose", "emoji": "🌹"},
                "readings": [
                    {"id": 1, "client_uuid": "c1", "moisture_level": 52.0, "status": "good", "timestamp": "2026-10-11 08:00:00"},
                    {"id": 2, "client_uuid": "c2", "moisture_level": 55.4, "status": "good", "timestamp": "2026-10-11 08:30:00"}
                ]
            }).encode())
        elif self.path.startswith("/api/shop/catalog.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "catalog": [
                    {"id": 1, "name": "Rose Kit", "plant_type": "Rose", "emoji": "🌹", "price": 499.0, "description": "Calibrated kit", "default_min_moisture": 40, "default_max_moisture": 65}
                ]
            }).encode())
        elif self.path.startswith("/api/orders/list.php"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "orders": [
                    {
                        "id": 1, "plant_name": "My Rose", "plant_type": "Rose", "catalog_id": 1,
                        "catalog_name": "Rose Kit", "emoji": "🌹", "price": 499.0, "order_status": "ordered",
                        "created_at": "2026-10-11 08:00:00", "assigned_sensor_id": None,
                        "min_moisture_threshold": 40, "max_moisture_threshold": 65,
                        "shipping_name": "Test User", "shipping_address": "123 Green St"
                    }
                ]
            }).encode())
        elif self.path.startswith("/api/timeout-test"):
            time.sleep(1.5)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
        elif self.path.startswith("/api/empty-test"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "data": []}).encode())
        elif self.path.startswith("/api/error-test"):
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Simulated 500 internal server error"}).encode())
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Not found"}).encode())

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        data = json.loads(body) if body else {}

        if self.path.startswith("/api/auth/login.php"):
            if data.get("email") == "buyer@example.com" and data.get("password") == "user123":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": "Login successful",
                    "token": "mock.jwt.token",
                    "user": {"id": 1, "name": "Buyer", "email": "buyer@example.com", "role": "user"}
                }).encode())
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Invalid email or password"}).encode())
        elif self.path.startswith("/api/sensor/simulate.php"):
            moist = float(data.get("moisture_level", 50))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": "Telemetry recorded",
                "client_uuid": data.get("client_uuid"),
                "moisture_level": moist,
                "status": "good" if 40 <= moist <= 70 else ("low" if moist < 40 else "high"),
                "alert_triggered": moist < 40 or moist > 70
            }).encode())
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())

def run_mock_api_tests():
    server = socketserver.TCPServer(("127.0.0.1", 8765), MockApiHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    base_url = "http://127.0.0.1:8765/api"

    # 1. Success test: auth check
    req = urllib.request.urlopen(f"{base_url}/auth/check.php")
    res = json.loads(req.read().decode())
    assert res["success"] is True and res["authenticated"] is True, "Auth check failed"

    # 2. Success test: plants list
    req = urllib.request.urlopen(f"{base_url}/plants/list.php")
    res = json.loads(req.read().decode())
    assert len(res["plants"]) == 1, "Expected 1 plant in list"

    # 3. Success test: simulate reading POST
    post_data = json.dumps({"plant_id": 101, "moisture_level": 55.0, "client_uuid": "test-uuid-1"}).encode()
    req = urllib.request.Request(f"{base_url}/sensor/simulate.php", data=post_data, headers={"Content-Type": "application/json"})
    res = json.loads(urllib.request.urlopen(req).read().decode())
    assert res["success"] is True and res["status"] == "good", "Telemetry POST failed"

    # 4. Failure test: invalid login (401)
    login_data = json.dumps({"email": "wrong@example.com", "password": "wrong"}).encode()
    req = urllib.request.Request(f"{base_url}/auth/login.php", data=login_data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
        assert False, "Expected 401 Unauthorized"
    except urllib.error.HTTPError as err:
        assert err.code == 401, f"Expected 401, got {err.code}"

    # 5. Failure test: 500 error response
    try:
        urllib.request.urlopen(f"{base_url}/error-test")
        assert False, "Expected 500 Internal Server Error"
    except urllib.error.HTTPError as err:
        assert err.code == 500, f"Expected 500, got {err.code}"

    # 6. Empty response scenario
    req = urllib.request.urlopen(f"{base_url}/empty-test")
    res = json.loads(req.read().decode())
    assert res["success"] is True and len(res["data"]) == 0, "Empty response handling failed"

    # 7. Timeout test (simulated delay)
    start_time = time.time()
    req = urllib.request.urlopen(f"{base_url}/timeout-test")
    res = json.loads(req.read().decode())
    duration = time.time() - start_time
    assert duration >= 1.4, f"Delay expected >= 1.4s, got {duration}"

    server.shutdown()
    server.server_close()

def test_cross_device_order_sync_and_persistence():
    """
    Comprehensive multi-client verification:
    1. Admin logs in on Device A.
    2. User logs in on Device B.
    3. User places order on Device B (with validation and duplicate check).
    4. Confirm order persisted in shared backend.
    5. Confirm admin on Device A sees the new order.
    6. Admin on Device A codes sensor and updates status to shipped.
    7. User on Device B verifies updated status and sensor ID in real-time.
    8. Refresh both devices and verify consistent state.
    9. Log out from both portals.
    """
    from serve_app import PlantPulseTestHandler, SHARED_ORDERS

    server = socketserver.TCPServer(("127.0.0.1", 8769), PlantPulseTestHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    base_url = "http://127.0.0.1:8769/api"

    try:
        # Step 1: Admin logs in on Device A
        admin_login = json.dumps({"email": "admin@plantmonitor.com", "password": "admin123"}).encode()
        req = urllib.request.Request(f"{base_url}/auth/login.php", data=admin_login, headers={"Content-Type": "application/json"})
        res = json.loads(urllib.request.urlopen(req).read().decode())
        assert res["success"] is True, "Admin login failed"
        admin_token = res["token"]

        # Step 2: User logs in on Device B
        user_login = json.dumps({"email": "buyer@example.com", "password": "user123"}).encode()
        req = urllib.request.Request(f"{base_url}/auth/login.php", data=user_login, headers={"Content-Type": "application/json"})
        res = json.loads(urllib.request.urlopen(req).read().decode())
        assert res["success"] is True, "User login failed"
        user_token = res["token"]

        # Step 3: User places an order on Device B
        # 3a. Validation check: empty fields return 400
        invalid_order = json.dumps({"plant_name": ""}).encode()
        req = urllib.request.Request(f"{base_url}/orders/create.php", data=invalid_order, headers={"Content-Type": "application/json", "Authorization": f"Bearer {user_token}"})
        try:
            urllib.request.urlopen(req)
            assert False, "Expected 400 for empty required fields"
        except urllib.error.HTTPError as err:
            assert err.code == 400, f"Expected 400, got {err.code}"

        # 3b. Valid order placement
        order_payload = {
            "catalog_id": 2,
            "plant_name": "Madurai Jasmine Special",
            "plant_type": "Jasmine",
            "shipping_name": "Friend Sithi",
            "shipping_phone": "9876543210",
            "shipping_address": "Flat 4B, Green Gardens, Coimbatore",
            "payment_method": "UPI / GPay"
        }
        req = urllib.request.Request(
            f"{base_url}/orders/create.php",
            data=json.dumps(order_payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {user_token}"}
        )
        resp = urllib.request.urlopen(req)
        assert resp.status in [200, 201], f"Unexpected status: {resp.status}"
        order_res = json.loads(resp.read().decode())
        assert order_res["success"] is True, "Order placement failed"
        new_order_id = order_res["order_id"]
        assert new_order_id > 0, "Invalid order_id returned"

        # 3c. Duplicate submission check (within 15 seconds)
        req_dup = urllib.request.Request(
            f"{base_url}/orders/create.php",
            data=json.dumps(order_payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {user_token}"}
        )
        try:
            urllib.request.urlopen(req_dup)
            assert False, "Expected 429 for rapid duplicate submission"
        except urllib.error.HTTPError as err:
            assert err.code == 429, f"Expected 429 duplicate warning, got {err.code}"

        # Step 4: Confirm order is in shared backend
        backend_order = next((o for o in SHARED_ORDERS if o["id"] == new_order_id), None)
        assert backend_order is not None, "Order was not persisted in shared backend"
        assert backend_order["plant_name"] == "Madurai Jasmine Special"
        assert backend_order["order_status"] == "ordered"

        # Step 5: Admin retrieves orders on Device A without manual file edits
        req_admin = urllib.request.Request(
            f"{base_url}/admin/orders.php",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_data = json.loads(urllib.request.urlopen(req_admin).read().decode())
        assert admin_data["success"] is True, "Admin failed to fetch orders"
        orders_list = admin_data["orders"]
        assert any(o["id"] == new_order_id for o in orders_list), "Admin cannot see the order placed by user on Device B"
        admin_new_order = next(o for o in orders_list if o["id"] == new_order_id)
        assert admin_new_order["shipping_name"] == "Friend Sithi"
        assert admin_data["stats"]["pending_coding"] >= 1, "Pending coding stats not updated"

        # Step 6: Admin codes the sensor on Device A
        code_payload = {
            "order_id": new_order_id,
            "sensor_id": "SENS-JASM-7788",
            "min_moisture": 42,
            "max_moisture": 72,
            "admin_notes": "Calibrated for sandy loam mix.",
            "dispatch": True
        }
        req_code = urllib.request.Request(
            f"{base_url}/admin/code_sensor.php",
            data=json.dumps(code_payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}
        )
        code_res = json.loads(urllib.request.urlopen(req_code).read().decode())
        assert code_res["success"] is True, "Sensor coding failed"

        # Step 7: Confirm updated status persists and is reflected on User Device B
        req_user_orders = urllib.request.Request(
            f"{base_url}/orders/list.php",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user_orders_data = json.loads(urllib.request.urlopen(req_user_orders).read().decode())
        assert user_orders_data["success"] is True
        user_order = next((o for o in user_orders_data["orders"] if o["id"] == new_order_id), None)
        assert user_order is not None, "User cannot find order in my-orders"
        assert user_order["order_status"] == "shipped", f"Expected shipped status, got {user_order['order_status']}"
        assert user_order["assigned_sensor_id"] == "SENS-JASM-7788", "Assigned sensor ID not reflected on Device B"

        # Step 8: Refresh both devices and verify data remains consistent
        admin_refresh = json.loads(urllib.request.urlopen(req_admin).read().decode())
        user_refresh = json.loads(urllib.request.urlopen(req_user_orders).read().decode())
        refreshed_admin_order = next(o for o in admin_refresh["orders"] if o["id"] == new_order_id)
        refreshed_user_order = next(o for o in user_refresh["orders"] if o["id"] == new_order_id)
        assert refreshed_admin_order["order_status"] == refreshed_user_order["order_status"] == "shipped"

        # Step 9: Log out from both portals
        req_logout = urllib.request.Request(
            f"{base_url}/auth/logout.php",
            data=json.dumps({}).encode(),
            headers={"Content-Type": "application/json"}
        )
        logout_res = json.loads(urllib.request.urlopen(req_logout).read().decode())
        assert logout_res["success"] is True, "Logout failed"

    finally:
        server.shutdown()
        server.server_close()

def main():
    print("=" * 60)
    print("PlantPulse Comprehensive Senior UI/UX & Backend Audit Suite")
    print("=" * 60)

    run_test("File Synchronization (Root <-> Android Assets)", test_file_synchronization)
    run_test("HTML Semantic Structure, Unique IDs & Accessibility", test_html_structure_and_accessibility)
    run_test("CSS Design System, Focus Visible, Active Filter & Modals", test_css_integrity)
    run_test("JavaScript Duplicate Listeners & Debounce Guards", test_javascript_event_listeners)
    run_test("PHP Backend Security & Safe LIMIT Binding Contracts", test_php_backend_contracts)
    run_test("Mock API Scenarios (Success, 401, 500, Empty, Latency)", run_mock_api_tests)
    run_test("Cross-Device Order Sync & Shared Data Persistence Scenario", test_cross_device_order_sync_and_persistence)

    print("-" * 60)
    print(f"Audit Summary: {len(passed_tests)} Passed, {len(failed_tests)} Failed")
    print("-" * 60)

    if failed_tests:
        sys.exit(1)

if __name__ == "__main__":
    main()
