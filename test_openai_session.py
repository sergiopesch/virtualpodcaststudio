#!/usr/bin/env python3
"""
Test script to verify OpenAI Realtime API session configuration
"""
import asyncio
import json
import os
import uuid
import websockets
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def test_openai_session():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OpenAI API key not found")
        return False
    
    # Minimal session configuration
    session_config = {
        "modalities": ["text", "audio"],
        "instructions": "You are a helpful assistant.",
        "voice": "alloy",
        "input_audio_format": "pcm16",
        "output_audio_format": "pcm16",
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 500
        },
        "temperature": 0.8
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1"
    }
    
    print("🧪 Testing OpenAI Realtime API session configuration...")
    print(f"📝 Session config:\n{json.dumps(session_config, indent=2)}")
    
    try:
        # Connect to OpenAI Realtime API
        print("🔌 Connecting to OpenAI Realtime API...")
        model = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-10-01")
        ws = await websockets.connect(
            f"wss://api.openai.com/v1/realtime?model={model}",
            extra_headers=headers,
            ping_interval=20,
            ping_timeout=20,
            close_timeout=5
        )
        print("✅ Connected successfully")
        
        # Send session update
        session_update = {
            "event_id": str(uuid.uuid4()),
            "type": "session.update",
            "session": session_config
        }
        
        print("📤 Sending session configuration...")
        await ws.send(json.dumps(session_update))
        
        # Listen for response
        print("👂 Listening for session response...")
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=10.0)
            data = json.loads(response)
            
            print(f"📨 Received response: {data.get('type')}")
            
            if data.get('type') == 'session.created':
                print("✅ Session created successfully!")
                print(f"📋 Session details: {json.dumps(data, indent=2)}")
                return True
            elif data.get('type') == 'error':
                print(f"❌ Session configuration error: {data.get('error', {}).get('message', 'Unknown error')}")
                return False
            else:
                print(f"ℹ️ Unexpected response type: {data.get('type')}")
                return False
                
        except asyncio.TimeoutError:
            print("⏰ Timeout waiting for session response")
            return False
            
    except Exception as e:
        print(f"❌ Connection or configuration error: {e}")
        return False
    finally:
        if 'ws' in locals():
            await ws.close()

if __name__ == "__main__":
    result = asyncio.run(test_openai_session())
    if result:
        print("\n🎉 OpenAI session test passed!")
    else:
        print("\n💥 OpenAI session test failed!")
        exit(1)
