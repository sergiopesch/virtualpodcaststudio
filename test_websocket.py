#!/usr/bin/env python3
"""
Test script to verify WebSocket connection to the backend
"""
import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Test WebSocket connection to backend conversation endpoint"""
    try:
        logger.info("🔗 Connecting to WebSocket...")
        ws_url = "ws://localhost:8000/ws/conversation"
        
        async with websockets.connect(ws_url) as websocket:
            logger.info("✅ Connected to WebSocket successfully")
            
            # Test ping message
            ping_msg = json.dumps({"type": "ping"})
            await websocket.send(ping_msg)
            logger.info("📤 Sent ping message")
            
            # Wait for responses
            timeout = 10
            start_time = asyncio.get_event_loop().time()
            
            while (asyncio.get_event_loop().time() - start_time) < timeout:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    data = json.loads(response)
                    logger.info(f"📨 Received: {data}")
                    
                    if data.get('type') == 'session_ready':
                        logger.info("🎉 Session is ready for audio!")
                        return True
                        
                except asyncio.TimeoutError:
                    logger.info("⏳ Waiting for session_ready...")
                    continue
                    
            logger.warning("⚠️ Timeout waiting for session_ready")
            return False
            
    except Exception as e:
        logger.error(f"❌ WebSocket connection failed: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_websocket_connection())
    print(f"\nWebSocket test result: {'✅ SUCCESS' if result else '❌ FAILED'}")