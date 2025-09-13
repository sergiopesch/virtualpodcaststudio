#!/usr/bin/env python3
"""
Quick test script to verify the audio studio fixes
"""

import asyncio
import json
import websockets
import base64
import os
from dotenv import load_dotenv

load_dotenv()

async def test_backend_connection():
    """Test if backend WebSocket is working and OpenAI key is configured"""
    print("🔍 Testing backend connection...")
    
    # Check if OpenAI API key is set
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment")
        return False
    else:
        print("✅ OpenAI API key is configured")
    
    try:
        # Connect to backend WebSocket
        uri = "ws://localhost:8000/ws/conversation"
        print(f"📡 Connecting to {uri}...")
        
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to backend WebSocket")
            
            # Wait for session_ready message
            print("⏳ Waiting for session_ready...")
            
            timeout = 15  # 15 seconds timeout
            session_ready = False
            
            try:
                while timeout > 0:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    msg_type = data.get('type')
                    print(f"📨 Received: {msg_type}")
                    
                    if msg_type in ['session_ready', 'session_updated']:
                        print("✅ Session is ready! Backend → OpenAI connection working")
                        session_ready = True
                        
                        # Test sending a text message
                        print("📝 Testing text message...")
                        await websocket.send(json.dumps({
                            "type": "text",
                            "text": "Hello, can you hear me?"
                        }))
                        
                        # Wait for response
                        response_timeout = 5
                        while response_timeout > 0:
                            message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                            data = json.loads(message)
                            response_type = data.get('type')
                            print(f"📨 Response: {response_type}")
                            
                            if response_type == 'text_delta':
                                print(f"💬 Got text response: {data.get('text', '')[:50]}...")
                                return True
                            elif response_type == 'response_done':
                                print("✅ Full response received!")
                                return True
                            elif response_type == 'error':
                                print(f"❌ Error in response: {data.get('message')}")
                                return False
                            
                            response_timeout -= 1
                            
                        if session_ready:
                            print("⚠️ Session ready but no text response received")
                            return True  # At least session works
                            
                    elif msg_type == 'error':
                        print(f"❌ Error from backend: {data.get('message')}")
                        return False
                    
                    timeout -= 1
                    
                print("❌ Timeout waiting for session_ready")
                return False
                
            except asyncio.TimeoutError:
                print("❌ Timeout waiting for messages")
                return session_ready
                
    except Exception as e:
        print(f"❌ Failed to connect to backend: {e}")
        print("💡 Make sure backend is running: cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000")
        return False

async def main():
    print("🎯 Testing Audio Studio fixes...")
    print("=" * 50)
    
    success = await test_backend_connection()
    
    print("=" * 50)
    if success:
        print("✅ Backend connection test PASSED")
        print("🎤 You can now test the frontend audio recording")
        print("   1. Start frontend: cd podcast-studio && npm run dev")
        print("   2. Go to http://localhost:3000/studio")
        print("   3. Click 'Start Voice Recording'")
        print("   4. Speak and watch for audio logs in browser console")
    else:
        print("❌ Backend connection test FAILED")
        print("🔧 Please check:")
        print("   1. Backend is running on port 8000")
        print("   2. OPENAI_API_KEY is set in backend/.env")
        print("   3. Internet connection is working")

if __name__ == "__main__":
    asyncio.run(main())
