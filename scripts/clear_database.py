"""
PlantPulse — Database Clearing Utility
Clears all mock, sample, and seed data from the live database.
Resets all tables to a clean state for production use.
"""

import ssl
import sys
import pymysql

def clear_database():
    host = "gateway01.ap-southeast-1.prod.aws.tidbcloud.com"
    port = 4000
    user = "3VEVapfdKd76Mj2.root"
    password = "GGItfuRlQalZdYH6"
    database = "plantpulse"
    ca_path = "isrgrootx1.pem"

    print("=========================================")
    print("🧹 PlantPulse Database Clearing Engine")
    print(f"Connecting to: {host}:{port} ({database})...")
    print("=========================================")

    ctx = ssl.create_default_context(cafile=ca_path)
    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        ssl=ctx,
        autocommit=True
    )
    cur = conn.cursor()

    tables = ["alerts", "moisture_readings", "orders", "plants", "users"]

    print("\nDisabling foreign key checks...")
    cur.execute("SET FOREIGN_KEY_CHECKS = 0;")

    for table in tables:
        print(f"Clearing table: {table}...")
        cur.execute(f"TRUNCATE TABLE {table};")

    cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
    print("Re-enabled foreign key checks.")

    # Verify counts
    print("\nVerifying table counts:")
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table};")
        count = cur.fetchone()[0]
        print(f"  - {table}: {count} records")

    cur.execute("SELECT COUNT(*) FROM sensor_catalog;")
    catalog_count = cur.fetchone()[0]
    print(f"  - sensor_catalog: {catalog_count} catalog items")

    conn.close()
    print("\n✅ Database cleared successfully! Completely clean state.")

if __name__ == "__main__":
    clear_database()
