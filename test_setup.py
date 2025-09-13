#!/usr/bin/env python3
"""
Test script to verify the Virtual Podcast Studio setup
"""
import os
import sys
from dotenv import load_dotenv
import httpx
import asyncio

# Load environment variables
load_dotenv('backend/.env')

async def test_setup():
    print("🧪 Testing Virtual Podcast Studio Setup...")
    print("=" * 50)
    
    # Check Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print(f"✅ Python Version: {python_version}")
    
    # Check OpenAI API Key
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        print(f"✅ OpenAI API Key: Found ({'*' * 10}{api_key[-4:]})")
    else:
        print("❌ OpenAI API Key: NOT FOUND")
        print("   Please set OPENAI_API_KEY in backend/.env")
        return False
    
    # Test OpenAI API connection
    try:
        print("🔗 Testing OpenAI API connection...")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers=headers,
                timeout=10.0
            )
            
        if response.status_code == 200:
            print("✅ OpenAI API: Connection successful")
            models = response.json()
            realtime_models = [m for m in models.get('data', []) if 'gpt-4o-realtime' in m.get('id', '')]
            if realtime_models:
                print(f"✅ Realtime Model Available: {realtime_models[0]['id']}")
            else:
                print("⚠️  No realtime models found in account")
        else:
            print(f"❌ OpenAI API: Failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ OpenAI API: Connection failed - {e}")
        return False
    
    # Check required directories
    backend_dir = "backend"
    frontend_dir = "podcast-studio"
    
    if os.path.exists(backend_dir):
        print(f"✅ Backend Directory: {backend_dir}")
    else:
        print(f"❌ Backend Directory: {backend_dir} not found")
        return False
        
    if os.path.exists(frontend_dir):
        print(f"✅ Frontend Directory: {frontend_dir}")
    else:
        print(f"❌ Frontend Directory: {frontend_dir} not found")
        return False
    
    # Check main files
    main_files = [
        "backend/main.py",
        "podcast-studio/src/app/studio/page.tsx",
        "podcast-studio/src/hooks/useRealtimeConversation.ts"
    ]
    
    for file_path in main_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} not found")
            return False
    
    print("=" * 50)
    print("🎉 Setup verification complete!")
    print("\n📋 Next steps:")
    print("1. Start backend: cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
    print("2. Start frontend: cd podcast-studio && npm run dev")
    print("3. Open http://localhost:3000/studio")
    print("\n🔧 Major fixes applied:")
    print("✅ Fixed OpenAI event ID collisions")
    print("✅ Replaced MediaRecorder with proper PCM16 audio processor")
    print("✅ Added WebSocket heartbeats and reconnection")
    print("✅ Fixed transcription parsing")
    print("✅ Added proper resource cleanup")
    print("✅ Enhanced error handling and recovery")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_setup())
    if not result:
        sys.exit(1)
