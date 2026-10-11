"""
Local Development & Testing Server for PlantPulse Web App + Mock API
"""
import http.server
import socketserver
import os
import json
import time

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class PlantPulseTestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api_get()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.handle_api_post()
        else:
            self.send_response(405)
            self.end_headers()

    def handle_api_get(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        if self.path.startswith("/api/auth/check.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "authenticated": True,
                "user": {"id": 1, "name": "Yasar Arafath", "email": "yasar@plantpulse.app", "role": "admin"}
            }).encode())
        elif self.path.startswith("/api/plants/list.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "plants": [
                    {
                        "id": 1,
                        "name": "Terrace Rose",
                        "type": "Rose",
                        "location": "Terrace",
                        "emoji": "🌹",
                        "ideal_moisture_min": 40,
                        "ideal_moisture_max": 65,
                        "sensor_id": "SENS-ROSE-101",
                        "moisture_level": 54.2,
                        "status": "good",
                        "last_reading_time": "2026-10-11 08:45:00"
                    },
                    {
                        "id": 2,
                        "name": "Balcony Jasmine",
                        "type": "Jasmine",
                        "location": "Balcony",
                        "emoji": "🌸",
                        "ideal_moisture_min": 45,
                        "ideal_moisture_max": 70,
                        "sensor_id": "SENS-JAS-202",
                        "moisture_level": 32.0,
                        "status": "low",
                        "last_reading_time": "2026-10-11 08:50:00"
                    }
                ]
            }).encode())
        elif self.path.startswith("/api/alerts/list.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "alerts": [
                    {
                        "id": 1,
                        "plant_id": 2,
                        "message": "🌸 ALERT: Balcony Jasmine needs water. Current moisture: 32%.",
                        "alert_type": "low",
                        "is_read": 0,
                        "created_at": "2026-10-11 08:50:00",
                        "plant_name": "Balcony Jasmine",
                        "plant_emoji": "🌸"
                    }
                ],
                "unread_count": 1
            }).encode())
        elif self.path.startswith("/api/readings/history.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "plant": {"id": 1, "name": "Terrace Rose", "emoji": "🌹"},
                "readings": [
                    {"id": 1, "client_uuid": "u1", "moisture_level": 50.0, "status": "good", "timestamp": "2026-10-11T08:00:00Z"},
                    {"id": 2, "client_uuid": "u2", "moisture_level": 52.5, "status": "good", "timestamp": "2026-10-11T08:30:00Z"},
                    {"id": 3, "client_uuid": "u3", "moisture_level": 54.2, "status": "good", "timestamp": "2026-10-11T08:45:00Z"}
                ]
            }).encode())
        elif self.path.startswith("/api/shop/catalog.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "catalog": [
                    {
                        "id": 1,
                        "name": "Smart Rose Sensor Kit",
                        "plant_type": "Rose",
                        "emoji": "🌹",
                        "price": 549.00,
                        "description": "Pre-coded firmware for Rose soil moisture dynamics (40-65%).",
                        "default_min_moisture": 40,
                        "default_max_moisture": 65
                    },
                    {
                        "id": 2,
                        "name": "Smart Jasmine Sensor Kit",
                        "plant_type": "Jasmine",
                        "emoji": "🌸",
                        "price": 549.00,
                        "description": "Pre-coded firmware for fragrant Jasmine soil hydration (45-70%).",
                        "default_min_moisture": 45,
                        "default_max_moisture": 70
                    },
                    {
                        "id": 3,
                        "name": "Succulent & Cactus Sensor",
                        "plant_type": "Succulent",
                        "emoji": "🌵",
                        "price": 499.00,
                        "description": "Dry soil calibration to prevent root rot in cacti and succulents.",
                        "default_min_moisture": 10,
                        "default_max_moisture": 30
                    }
                ]
            }).encode())
        elif self.path.startswith("/api/orders/list.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "orders": [
                    {
                        "id": 101,
                        "plant_name": "Terrace Rose",
                        "plant_type": "Rose",
                        "catalog_id": 1,
                        "catalog_name": "Smart Rose Sensor Kit",
                        "emoji": "🌹",
                        "price": 549.00,
                        "order_status": "shipped",
                        "created_at": "2026-10-10 14:00:00",
                        "assigned_sensor_id": "SENS-ROSE-101",
                        "min_moisture_threshold": 40,
                        "max_moisture_threshold": 65,
                        "shipping_name": "Yasar Arafath",
                        "shipping_address": "42 Green Lane, Bangalore"
                    }
                ]
            }).encode())
        elif self.path.startswith("/api/admin/orders.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "stats": {
                    "total_orders": 1,
                    "pending_coding": 0,
                    "coded_orders": 1,
                    "dispatched_orders": 1
                },
                "orders": [
                    {
                        "id": 101,
                        "plant_name": "Terrace Rose",
                        "plant_type": "Rose",
                        "user_name": "Yasar Arafath",
                        "user_email": "yasar@plantpulse.app",
                        "catalog_name": "Smart Rose Sensor Kit",
                        "emoji": "🌹",
                        "price": 549.00,
                        "order_status": "shipped",
                        "created_at": "2026-10-10 14:00:00",
                        "assigned_sensor_id": "SENS-ROSE-101",
                        "min_moisture_threshold": 40,
                        "max_moisture_threshold": 65,
                        "shipping_name": "Yasar Arafath",
                        "shipping_address": "42 Green Lane, Bangalore",
                        "shipping_phone": "+91 98765 43210",
                        "admin_notes": "Calibrated for red clay mix."
                    }
                ]
            }).encode())
        else:
            self.wfile.write(json.dumps({"success": True}).encode())

    def handle_api_post(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(body)
        except:
            data = {}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        if self.path.startswith("/api/auth/login.php"):
            self.wfile.write(json.dumps({
                "success": True,
                "message": "Login successful",
                "token": "test-jwt-token-2026",
                "user": {"id": 1, "name": "Yasar Arafath", "email": "yasar@plantpulse.app", "role": "admin"}
            }).encode())
        elif self.path.startswith("/api/alerts/mark_read.php"):
            self.wfile.write(json.dumps({"success": True, "message": "Alerts marked as read"}).encode())
        elif self.path.startswith("/api/sensor/simulate.php"):
            moist = float(data.get("moisture_level", 50))
            self.wfile.write(json.dumps({
                "success": True,
                "message": "Telemetry processed",
                "client_uuid": data.get("client_uuid", "sim_123"),
                "moisture_level": moist,
                "status": "good" if 40 <= moist <= 70 else ("low" if moist < 40 else "high"),
                "alert_triggered": moist < 40 or moist > 70,
                "alert_message": f"Moisture alert at {moist}%" if moist < 40 or moist > 70 else ""
            }).encode())
        else:
            self.wfile.write(json.dumps({"success": True, "message": "Success"}).encode())

if __name__ == "__main__":
    PORT = 8088
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), PlantPulseTestHandler) as httpd:
        print(f"Serving PlantPulse test server at http://127.0.0.1:{PORT}")
        httpd.serve_forever()
