/**
 * Represents an encoded video frame and its associated metadata.
 * This class bundles an EncodedVideoChunk with information necessary
 * for transport, reordering, and decoding, especially in scenarios
 * involving out-of-order delivery and Long-Term Reference (LTR) frames.
 */
class EncodedFrame {
    constructor(encodedChunk, frameId, dependencies, timestamp, isLtr = false) {
        this.encodedChunk = encodedChunk; // The EncodedVideoChunk data
        this.frameId = frameId;           // A unique, monotonically increasing ID for this frame
        this.dependencies = dependencies; // Array of frameIds this frame depends on
        this.timestamp = timestamp;       // Original capture timestamp of the frame
        this.isLtr = isLtr;             // Boolean flag indicating if this is an LTR frame
    }
}
