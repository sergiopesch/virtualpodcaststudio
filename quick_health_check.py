#!/usr/bin/env python3
"""
Quick health check for Virtual Podcast Studio
"""

import json
import os
import sys
from urllib.request import urlopen
from urllib.error import URLError

def check_frontend_env():
    """Check if OpenAI API key is set in frontend .env.local"""
    frontend_env_path = 'podcast-studio/.env.local'
    if os.path.exists(frontend_env_path):
        with open(frontend_env_path, 'r') as f:
            content = f.read()
            if 'OPENAI_API_KEY=' in content and len(content.split('OPENAI_API_KEY=')[1].split('\n')[0].strip()) > 10:
                print("✅ OpenAI API key found in podcast-studio/.env.local")
                return True
            else:
                print("❌ OPENAI_API_KEY not properly set in podcast-studio/.env.local")
                return False
    else:
        print("❌ podcast-studio/.env.local file not found")
        print("💡 Create it with: echo 'OPENAI_API_KEY=sk-...' > podcast-studio/.env.local")
        return False

def check_backend_health():
    """Check if backend is running (optional, only needed for papers API)"""
    try:
        response = urlopen('http://localhost:8000/health', timeout=5)
        if response.status == 200:
            data = json.loads(response.read().decode())
            print("✅ Backend is running (papers API available)")
            print(f"   Status: {data.get('status')}")
            return True
    except URLError:
        print("⚠️  Backend not running (papers API unavailable)")
        print("   Note: Backend is only needed for arXiv paper search.")
        print("   Realtime conversations work without it.")
        return False
    except Exception as e:
        print(f"⚠️  Backend check failed: {e}")
        return False

def check_frontend_running():
    """Check if Next.js frontend is running"""
    try:
        response = urlopen('http://localhost:3000/', timeout=5)
        if response.status == 200:
            print("✅ Frontend is running")
            return True
    except URLError:
        print("⚠️  Frontend not running")
        print("💡 Start with: cd podcast-studio && npm run dev")
        return False
    except Exception as e:
        print(f"⚠️  Frontend check failed: {e}")
        return False

def main():
    print("🏥 Virtual Podcast Studio - Health Check")
    print("=" * 50)
    
    # Check frontend .env.local (required for realtime)
    frontend_key_ok = check_frontend_env()
    
    # Check frontend (required)
    frontend_ok = check_frontend_running()
    
    # Check backend (optional, only for papers)
    backend_ok = check_backend_health()
    
    print("=" * 50)
    
    if frontend_key_ok and frontend_ok:
        print("✅ Core setup looks good!")
        print("\n📋 Status:")
        print("   • Realtime conversations: Ready")
        if backend_ok:
            print("   • Paper search (arXiv): Ready")
        else:
            print("   • Paper search (arXiv): Not available (backend offline)")
        print("\n🚀 Open http://localhost:3000/studio to start")
    else:
        print("❌ Setup issues found:")
        if not frontend_key_ok:
            print("   - Add OpenAI API key to podcast-studio/.env.local")
        if not frontend_ok:
            print("   - Start frontend: cd podcast-studio && npm run dev")
    
    # Return success if core (frontend) is working
    return frontend_key_ok and frontend_ok

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
