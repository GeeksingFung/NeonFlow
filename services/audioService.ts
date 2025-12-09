/**
 * Audio Service
 * Handles the complexity of setting up the AudioContext and capturing system audio.
 */

export class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  /**
   * Captures system audio via getDisplayMedia.
   * Note: The user MUST select "Share Audio" in the browser prompt.
   */
  async startSystemCapture(): Promise<MediaStream> {
    try {
      // Use 'as any' to support newer properties like systemAudio that might not be in all TS defs
      const displayMediaOptions: any = {
        video: true, // video is required for getDisplayMedia
        audio: {
          // We disable processing to get the rawest audio possible for music
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Removed sampleRate constraint as it can cause failures if system rate differs
        },
        // Hint to the browser to include system audio by default (tries to check the box)
        systemAudio: "include", 
        // Hint to prefer current tab if useful, though 'include' is the key for audio
        selfBrowserSurface: "include" 
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Check if user actually shared audio
      if (stream.getAudioTracks().length === 0) {
        // Stop video tracks immediately if we failed to get audio
        stream.getTracks().forEach(track => track.stop());
        throw new Error("NO_AUDIO_TRACK");
      }

      this.stream = stream;
      return stream;
    } catch (error) {
      console.error("Error starting system capture:", error);
      throw error;
    }
  }

  setupAudioContext(stream: MediaStream): AnalyserNode {
    // Create new context
    // Use standard AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    // Create source from stream
    this.source = this.audioContext.createMediaStreamSource(stream);
    
    // Create analyzer
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048; // High resolution for visuals
    this.analyser.smoothingTimeConstant = 0.8; // Smooth out jitter
    
    // Connect source to analyzer
    // Note: We typically DO NOT connect to destination (speakers) to avoid feedback loops
    // since we are capturing system output that is already playing.
    this.source.connect(this.analyser);

    return this.analyser;
  }

  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.source = null;
    this.analyser = null;
    this.stream = null;
  }
}

export const audioService = new AudioService();