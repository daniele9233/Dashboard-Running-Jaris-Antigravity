import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.running_dashboard
    
    # Check Garmin tokens
    token = await db.garmin_tokens.find_one()
    print("=== GARMIN TOKENS ===")
    print(f"Token exists: {bool(token)}")
    if token:
        print(f"Email: {token.get('email', 'N/A')}")
        print(f"Has token_dump: {bool(token.get('token_dump'))}")
        dump_len = len(token.get('token_dump', '')) if token.get('token_dump') else 0
        print(f"Token dump length: {dump_len} chars")
    else:
        print("No Garmin tokens found in MongoDB")
    
    # Check runs with dynamics
    print("\n=== RUNS WITH DYNAMICS ===")
    runs_with_osc = await db.runs.count_documents({"avg_vertical_oscillation": {"$ne": None}})
    runs_with_ratio = await db.runs.count_documents({"avg_vertical_ratio": {"$ne": None}})
    runs_with_gct = await db.runs.count_documents({"avg_ground_contact_time": {"$ne": None}})
    runs_with_stride = await db.runs.count_documents({"avg_stride_length": {"$ne": None}})
    total_runs = await db.runs.count_documents({})
    
    print(f"Total runs: {total_runs}")
    print(f"Runs with vertical oscillation: {runs_with_osc}")
    print(f"Runs with vertical ratio: {runs_with_ratio}")
    print(f"Runs with ground contact time: {runs_with_gct}")
    print(f"Runs with stride length: {runs_with_stride}")
    
    # Show a sample run with dynamics
    if runs_with_osc > 0:
        sample = await db.runs.find_one({"avg_vertical_oscillation": {"$ne": None}})
        print(f"\nSample run with dynamics:")
        print(f"  Date: {sample.get('date')}")
        print(f"  Distance: {sample.get('distance_km')} km")
        print(f"  avg_vertical_oscillation: {sample.get('avg_vertical_oscillation')}")
        print(f"  avg_vertical_ratio: {sample.get('avg_vertical_ratio')}")
        print(f"  avg_ground_contact_time: {sample.get('avg_ground_contact_time')}")
        print(f"  avg_stride_length: {sample.get('avg_stride_length')}")

asyncio.run(check())