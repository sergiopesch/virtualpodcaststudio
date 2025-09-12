// Simple test to check if MediaRecorder works
async function testRecording() {
  console.log('Testing MediaRecorder API...');
  
  try {
    // Test microphone access
    console.log('Requesting microphone access...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('✅ Microphone access granted');
    
    // Test MediaRecorder support
    const mimeTypes = [
      'audio/webm;codecs=pcm',
      'audio/webm;codecs=opus', 
      'audio/webm',
      'audio/mp4'
    ];
    
    console.log('Testing MediaRecorder mime types:');
    for (const mimeType of mimeTypes) {
      const supported = MediaRecorder.isTypeSupported(mimeType);
      console.log(`  ${mimeType}: ${supported ? '✅' : '❌'}`);
    }
    
    // Create MediaRecorder
    const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
    console.log(`Using mime type: ${supportedType}`);
    
    const recorder = new MediaRecorder(stream, { mimeType: supportedType });
    
    recorder.ondataavailable = (event) => {
      console.log('📊 Audio data available:', event.data.size, 'bytes');
    };
    
    recorder.onerror = (error) => {
      console.error('❌ MediaRecorder error:', error);
    };
    
    // Start recording for 2 seconds
    console.log('🎤 Starting recording...');
    recorder.start(100);
    
    setTimeout(() => {
      console.log('⏹️ Stopping recording...');
      recorder.stop();
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Recording test completed');
    }, 2000);
    
  } catch (error) {
    console.error('❌ Recording test failed:', error);
  }
}

// Run test when page loads
if (typeof window !== 'undefined') {
  testRecording();
}
