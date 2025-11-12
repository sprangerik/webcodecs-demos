/**
 * Handles the reordering and assembly of EncodedFrame objects received potentially out of order.
 * It buffers frames until their dependencies are met and then sends them for decoding
 * in the correct order based on frameId.
 */
class FrameAssembler {
    /**
     * @param {function(EncodedFrame): void} onReadyToRenderCallback - Callback function to be invoked when a frame is ready to be decoded.
     */
    constructor(onReadyToRenderCallback) {
        this.onReadyToRenderCallback = onReadyToRenderCallback;
        this.decodedFrames = new Map(); // Stores frameId of frames sent for decoding
        this.bufferedFrames = new Map(); // Stores EncodedFrame objects waiting for dependencies
        this.decoderNeedsKeyFrame = false; // Flag indicating the decoder requires a keyframe
        this.lastDecodedFrameId = -1;    // Highest frameId sent for decoding
    }

    /**
     * Called when a new EncodedFrame is received from the transport.
     * The frame is either decoded immediately if its dependencies are met or buffered.
     * @param {EncodedFrame} encodedFrame - The received frame.
     */
    OnFrameReceived(encodedFrame) {
        // console.log(`FrameAssembler: OnFrameReceived - frameId: ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, dependencies: [${encodedFrame.dependencies}], ts: ${encodedFrame.timestamp}`);
        
        // Discard old non-LTR frames. LTR frames might be retransmitted and useful even if older.
        if (!encodedFrame.isLtr && encodedFrame.frameId <= this.lastDecodedFrameId) {
            // console.warn(`FrameAssembler: Discarding old non-LTR frame ${encodedFrame.frameId}, last decoded was ${this.lastDecodedFrameId}`);
            return;
        }

        if (this._canDecode(encodedFrame)) {
            this._decodeAndProcess(encodedFrame);
        } else {
            // console.log(`FrameAssembler: Buffering frame ${encodedFrame.frameId}`);
            this.bufferedFrames.set(encodedFrame.frameId, encodedFrame);
        }
    }

    /**
     * Checks if a frame can be decoded based on the current state.
     * A frame can be decoded if:
     *  - The decoder needs a keyframe, and this frame is a keyframe.
     *  - It's a keyframe (and the decoder doesn't need one specifically).
     *  - All its dependencies have already been sent for decoding.
     * @param {EncodedFrame} encodedFrame - The frame to check.
     * @returns {boolean} True if the frame can be decoded, false otherwise.
     * @private
     */
    _canDecode(encodedFrame) {
        if (this.decoderNeedsKeyFrame) {
            return encodedFrame.encodedChunk.type === 'key';
        }
        if (encodedFrame.encodedChunk.type === 'key') {
            return true;
        }
        const depsMet = encodedFrame.dependencies.every(depId => this.decodedFrames.has(depId));
        // console.log(`FrameAssembler: _canDecode - frameId: ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, depsMet: ${depsMet}`);
        return depsMet;
    }

    /**
     * Processes a frame that is ready to be decoded. This includes:
     *  - Sending it to the onReadyToRenderCallback.
     *  - Marking the frame as decoded.
     *  - Updating the lastDecodedFrameId.
     *  - Removing it from the buffer.
     *  - Checking and processing any buffered frames that can now be decoded.
     * @param {EncodedFrame} encodedFrame - The frame to decode and process.
     * @private
     */
    _decodeAndProcess(encodedFrame) {
        // Only process if not already sent for decoding
        if (this.decodedFrames.has(encodedFrame.frameId)) {
            // console.log(`FrameAssembler: Frame ${encodedFrame.frameId} already decoded`);
            return; 
        }

        // console.log(`FrameAssembler: Decoding frame ${encodedFrame.frameId}, type: ${encodedFrame.encodedChunk.type}, dependencies: [${encodedFrame.dependencies}]`);
        this.onReadyToRenderCallback(encodedFrame); // This will trigger decoder.decode()
        this.decodedFrames.set(encodedFrame.frameId, true); // Mark as sent for decoding
        if (encodedFrame.frameId > this.lastDecodedFrameId) {
            this.lastDecodedFrameId = encodedFrame.frameId;
        }
        this.bufferedFrames.delete(encodedFrame.frameId); // Remove from buffer if it was there

        if (encodedFrame.encodedChunk.type === 'key' && this.decoderNeedsKeyFrame) {
            this.decoderNeedsKeyFrame = false;
            // console.log('FrameAssembler: Keyframe decoded, decoderNeedsKeyFrame is now false.');
        }

        // Check buffered frames that might now be decodable
        // Sort buffered frames by frameId to ensure in-order decoding attempts
        const sortedBufferedFrames = Array.from(this.bufferedFrames.values()).sort((a, b) => a.frameId - b.frameId);

        for (const bufferedFrame of sortedBufferedFrames) {
            if (this.bufferedFrames.has(bufferedFrame.frameId) && this._canDecode(bufferedFrame)) {
                this._decodeAndProcess(bufferedFrame); // Recursive call to process newly decodable frames
            }
        }
    }

    /**
     * Resets the internal state of the FrameAssembler.
     */
    reset() {
        this.decodedFrames.clear();
        this.bufferedFrames.clear();
        this.decoderNeedsKeyFrame = false; 
        this.lastDecodedFrameId = -1;
        // console.log("FrameAssembler: Reset complete.");
    }
}
