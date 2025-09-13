#!/usr/bin/env python3
"""
Test script to verify the complete audio conversation flow
"""
import asyncio
import websockets
import json
import base64
import logging
from typing import List, Dict, Any
import struct
import math

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_test_pcm16(duration_seconds: float = 1.0, frequency: int = 440) -> bytes:
    """Generate test PCM16 audio data (sine wave)"""
    sample_rate = 24000
    samples = int(sample_rate * duration_seconds)
    
    pcm_data = []
    for i in range(samples):
        # Generate sine wave
        sample_value = int(32767 * 0.5 * math.sin(2 * math.pi * frequency * i / sample_rate))
        pcm_data.append(struct.pack('<h', sample_value))  # Little-endian 16-bit
    
    return b''.join(pcm_data)

async def test_complete_audio_flow():
    """Test the complete audio conversation flow"""
    events_received = []
    
    try:
        logger.info("🔗 Connecting to WebSocket...")
        ws_url = "ws://localhost:8000/ws/conversation"
        
        async with websockets.connect(ws_url) as websocket:
            logger.info("✅ Connected to WebSocket successfully")
            
            # Start receiving messages
            async def message_handler():
                try:
                    while True:
                        response = await websocket.recv()
                        data = json.loads(response)
                        event_type = data.get('type')
                        events_received.append(event_type)
                        logger.info(f"📨 Received event: {event_type}")
                        
                        if event_type == 'session_ready':
                            logger.info("🎉 Session is ready for audio testing!")
                        elif event_type == 'audio_delta':
                            logger.info(f"🔊 Received audio delta (length: {len(data.get('audio', ''))})")
                        elif event_type == 'text_delta':
                            logger.info(f"💬 Received text delta: {data.get('text', '')[:50]}...")
                        elif event_type == 'transcription_delta':
                            logger.info(f"📝 Transcription update: {data.get('text', '')[:50]}...")
                        elif event_type == 'response_done':
                            logger.info("✅ AI response completed")
                        elif event_type == 'error':
                            logger.error(f"❌ Error received: {data.get('message', 'Unknown error')}")
                            
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Connection closed by server")
                except Exception as e:
                    logger.error(f"Error in message handler: {e}")
            
            # Start message handler
            message_task = asyncio.create_task(message_handler())
            
            # Wait for session to be ready
            await asyncio.sleep(3)
            
            # Test 1: Send text message
            logger.info("📤 Test 1: Sending text message...")
            text_message = {
                "type": "text",
                "text": "Hello Dr. Sarah! Can you tell me about transformers in AI?"
            }
            await websocket.send(json.dumps(text_message))
            await asyncio.sleep(5)
            
            # Test 2: Send audio data
            logger.info("📤 Test 2: Sending audio data...")
            test_audio = generate_test_pcm16(duration_seconds=2.0)
            audio_base64 = base64.b64encode(test_audio).decode('utf-8')
            
            # Send audio in chunks (simulate real-time streaming)
            chunk_size = 1920  # 40ms worth of PCM16 data
            for i in range(0, len(audio_base64), chunk_size):
                chunk = audio_base64[i:i+chunk_size]
                audio_message = {
                    "type": "audio",
                    "audio": chunk
                }
                await websocket.send(json.dumps(audio_message))
                await asyncio.sleep(0.04)  # 40ms intervals
            
            logger.info("✅ Audio chunks sent, waiting for responses...")
            await asyncio.sleep(10)
            
            # Cancel message handler
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass
            
            logger.info(f"📋 Events received: {events_received}")
            return events_received
            
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        return []

def analyze_test_results(events: List[str]) -> Dict[str, Any]:
    """Analyze the test results and identify issues"""
    analysis = {
        'session_ready': 'session_ready' in events,
        'audio_response': 'audio_delta' in events,
        'text_response': 'text_delta' in events,
        'transcription': 'transcription_delta' in events or 'transcription_complete' in events,
        'response_completion': 'response_done' in events,
        'errors': [event for event in events if 'error' in event.lower()],
        'total_events': len(events),
        'unique_events': list(set(events))
    }
    
    return analysis

async def main():
    logger.info("🚀 Starting comprehensive audio flow test...")
    
    events = await test_complete_audio_flow()
    analysis = analyze_test_results(events)
    
    logger.info("📊 Test Results Analysis:")
    logger.info(f"  ✅ Session Ready: {analysis['session_ready']}")
    logger.info(f"  🔊 Audio Response: {analysis['audio_response']}")
    logger.info(f"  💬 Text Response: {analysis['text_response']}")
    logger.info(f"  📝 Transcription: {analysis['transcription']}")
    logger.info(f"  ✅ Response Completion: {analysis['response_completion']}")
    logger.info(f"  ❌ Errors: {len(analysis['errors'])}")
    logger.info(f"  📈 Total Events: {analysis['total_events']}")
    logger.info(f"  🔍 Unique Events: {analysis['unique_events']}")
    
    # Identify potential issues
    issues = []
    if not analysis['session_ready']:
        issues.append("Session not initializing properly")
    if not analysis['text_response'] and not analysis['audio_response']:
        issues.append("No AI responses received")
    if not analysis['transcription']:
        issues.append("Audio transcription not working")
    if analysis['errors']:
        issues.append(f"Errors occurred: {analysis['errors']}")
    
    if issues:
        logger.warning("⚠️ Issues identified:")
        for issue in issues:
            logger.warning(f"  - {issue}")
    else:
        logger.info("🎉 All core functionality appears to be working!")
    
    return analysis

if __name__ == "__main__":
    result = asyncio.run(main())