/**
 * Audio optimization utilities for faster transcription
 */

export interface AudioOptimizationOptions {
  targetSampleRate?: number; // 16000 is optimal for Whisper
  maxDurationMs?: number; // Trim long recordings
  compressionQuality?: number; // 0.3-0.7 balance size vs quality
}

export class AudioProcessor {
  static async optimizeForTranscription(
    audioBlob: Blob,
    options: AudioOptimizationOptions = {}
  ): Promise<Blob> {
    const {
      targetSampleRate = 16000, // Whisper's native sample rate
      maxDurationMs = 30000, // 30 seconds max
      compressionQuality = 0.5,
    } = options;

    try {
      // Convert to optimal format for Whisper processing
      const audioBuffer = await this.blobToAudioBuffer(audioBlob);

      // Resample to Whisper's preferred rate (16kHz)
      const optimizedBuffer = this.resampleAudio(audioBuffer, targetSampleRate);

      // Trim if too long
      const trimmedBuffer = this.trimAudio(optimizedBuffer, maxDurationMs);

      // Convert back to optimized blob
      const optimizedBlob = await this.audioBufferToBlob(
        trimmedBuffer,
        compressionQuality
      );

      console.log(
        `[AudioOptimization] Original: ${audioBlob.size}b, Optimized: ${optimizedBlob.size}b`
      );

      return optimizedBlob;
    } catch (error) {
      console.warn("[AudioOptimization] Failed, using original:", error);
      return audioBlob; // Fallback to original
    }
  }

  private static async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  private static resampleAudio(
    buffer: AudioBuffer,
    targetRate: number
  ): AudioBuffer {
    if (buffer.sampleRate === targetRate) return buffer;

    // Simple resampling - in production, use a proper resampling library
    const ratio = buffer.sampleRate / targetRate;
    const newLength = Math.floor(buffer.length / ratio);

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      newLength,
      targetRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const oldData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);

      for (let i = 0; i < newLength; i++) {
        newData[i] = oldData[Math.floor(i * ratio)];
      }
    }

    return newBuffer;
  }

  private static trimAudio(
    buffer: AudioBuffer,
    maxDurationMs: number
  ): AudioBuffer {
    const maxSamples = (maxDurationMs / 1000) * buffer.sampleRate;
    if (buffer.length <= maxSamples) return buffer;

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const trimmedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      maxSamples,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const oldData = buffer.getChannelData(channel);
      const newData = trimmedBuffer.getChannelData(channel);
      newData.set(oldData.subarray(0, maxSamples));
    }

    return trimmedBuffer;
  }

  private static async audioBufferToBlob(
    buffer: AudioBuffer,
    quality: number
  ): Promise<Blob> {
    // Convert AudioBuffer to WAV format optimized for Whisper
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    // Create WAV header
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(channel)[i])
        );
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }
}
