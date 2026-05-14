"""Test DB connection with the configured DATABASE_URL."""
import sys
sys.path.insert(0, "/root/projects/Trading Journal v3/backend")

# Force-load .env before importing config
from pathlib import Path
from decouple import Config, RepositoryEnv

env_path = Path("/root/projects/Trading Journal v3/backend/.env")
if env_path.exists():
    config = Config(RepositoryEnv(env_path))
    url = config("DATABASE_URL")
    # Show masked URL
    if "@" in url:
        proto_rest = url.split("@")
        user_part = proto_rest[0].split("://")[-1]
        rest = "@".join(proto_rest[1:])
        if ":" in user_part:
            user, pw = user_part.rsplit(":", 1)
            masked = f"postgresql://{user}:***{pw[-2:] if len(pw) > 1 else ''}@{rest}"
        else:
            masked = url
    else:
        masked = url
    print(f"Connecting with: {masked}")

    import psycopg2
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM trades WHERE status != 'deleted'")
        count = cur.fetchone()[0]
        print(f"SUCCESS! Connected. {count} active trades in DB.")
        conn.close()
    except Exception as e:
        print(f"FAILED: {e}")
else:
    print("No .env file found at backend/.env")
