#!/usr/bin/env python3
"""
Quick health check for backend without extra dependencies
"""

import json
import os
import sys
from urllib.request import urlopen
from urllib.error import URLError

def check_backend_health():
    """Check if backend is running"""
    try:
        response = urlopen('http://localhost:8000/health', timeout=5)
        if response.status == 200:
            data = json.loads(response.read().decode())
            print("✅ Backend is running")
            print(f"   Status: {data.get('status')}")
            return True
    except URLError as e:
        print(f"❌ Backend not accessible: {e}")
        print("💡 Start with: cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def check_openai_key():
    """Check if OpenAI API key is set"""
    # Check backend directory for .env file
    backend_env_path = 'backend/.env'
    if os.path.exists(backend_env_path):
        with open(backend_env_path, 'r') as f:
            content = f.read()
            if 'OPENAI_API_KEY=' in content and len(content.split('OPENAI_API_KEY=')[1].split('\n')[0].strip()) > 10:
                print("✅ OpenAI API key found in backend/.env")
                return True
            else:
                print("❌ OPENAI_API_KEY not properly set in backend/.env")
                return False
    else:
        print("❌ backend/.env file not found")
        return False

def main():
    print("🏥 Virtual Podcast Studio - Health Check")
    print("=" * 50)
    
    # Check OpenAI key first
    key_ok = check_openai_key()
    
    # Check backend
    backend_ok = check_backend_health()
    
    print("=" * 50)
    
    if key_ok and backend_ok:
        print("✅ Basic setup looks good!")
        print("\n📋 Next steps:")
        print("1. Start frontend: cd podcast-studio && npm run dev")
        print("2. Open http://localhost:3000/studio")
        print("3. See README.md Troubleshooting section")
    else:
        print("❌ Setup issues found:")
        if not key_ok:
            print("   - Fix OpenAI API key in backend/.env")
        if not backend_ok:
            print("   - Start backend server")
    
    return key_ok and backend_ok

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
