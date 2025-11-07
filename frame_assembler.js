class FrameAssembler {
    constructor(onReadyToRenderCallback) {
        this.onReadyToRenderCallback = onReadyToRenderCallback;
        this.decodedFrames = new Map(); // Stores frameId of decoded frames
        this.bufferedFrames = new Map(); // Stores EncodedFrame objects that are waiting for dependencies
        this.decoderNeedsKeyFrame = false; // New flag
    }

    OnFrameReceived(encodedFrame) {
        console.log(`FrameAssembler: OnFrameReceived - frameId: ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, dependencies: [${encodedFrame.dependencies}], ts: ${encodedFrame.timestamp}`);
        if (this._canDecode(encodedFrame)) {
            this._decodeAndProcess(encodedFrame);
        } else {
            this.bufferedFrames.set(encodedFrame.frameId, encodedFrame);
        }
    }

    _canDecode(encodedFrame) {
        if (this.decoderNeedsKeyFrame) {
            return encodedFrame.encodedChunk.type === 'key';
        }
        if (encodedFrame.encodedChunk.type === 'key') {
            return true;
        }
        const depsMet = encodedFrame.dependencies.every(depId => this.decodedFrames.has(depId));
        console.log(`FrameAssembler: _canDecode - frameId: ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, depsMet: ${depsMet}`);
        return depsMet;
    }

    _decodeAndProcess(encodedFrame) {
        // Only process if not already decoded
        if (this.decodedFrames.has(encodedFrame.frameId)) {
            // console.log(`FrameAssembler: Frame ${encodedFrame.frameId} already decoded`);
            return; // Already processed, prevent duplicate
        }

        // console.log(`FrameAssembler: Decoding frame ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, dependencies: [${encodedFrame.dependencies}]`);
        this._clearOldState(encodedFrame.encodedChunk.timestamp);
        this.onReadyToRenderCallback(encodedFrame); // This will trigger decoder.decode()
        this.decodedFrames.set(encodedFrame.frameId, true); // Mark as decoded (true for simplicity)
        this.bufferedFrames.delete(encodedFrame.frameId); // Remove from buffer if it was there

        if (encodedFrame.encodedChunk.type === 'key' && this.decoderNeedsKeyFrame) {
            this.decoderNeedsKeyFrame = false;
            // console.log('FrameAssembler: Keyframe decoded, decoderNeedsKeyFrame is now false.');
        }

        // Check buffered frames that might now be decodable
        // Iterate over a copy to avoid issues with map modification during iteration
        const bufferedFramesCopy = new Map(this.bufferedFrames);
        for (const [frameId, bufferedFrame] of bufferedFramesCopy.entries()) {
            if (this._canDecode(bufferedFrame)) {
                this._decodeAndProcess(bufferedFrame); // Recursive call
            }
        }
    }

    _clearOldState(currentTimestamp) {
        // Clear decoded frames older than currentTimestamp
        for (const [frameId, _] of this.decodedFrames.entries()) {
            // We don't store the timestamp in decodedFrames, so we can't clear by timestamp directly.
            // For now, we'll assume that if a frame is decoded, its dependencies are met.
            // A more robust solution would store the timestamp in decodedFrames.
            // For this iteration, we'll only clear buffered frames by timestamp.
        }

        // Clear buffered frames older than currentTimestamp
        const framesToClear = [];
        for (const [frameId, bufferedFrame] of this.bufferedFrames.entries()) {
            if (bufferedFrame.encodedChunk.timestamp < currentTimestamp) {
                framesToClear.push(frameId);
            }
        }
        for (const frameId of framesToClear) {
            this.bufferedFrames.delete(frameId);
        }
    }

    // Clear state when stopping or reconfiguring
    reset() {
        this.decodedFrames.clear();
        this.bufferedFrames.clear();
        this.decoderNeedsKeyFrame = false; // Reset this flag as well
    }
}
