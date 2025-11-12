class EncodedFrame {
    constructor(encodedChunk, frameId, dependencies, timestamp, isLtr = false) {
        this.encodedChunk = encodedChunk;
        this.frameId = frameId;
        this.dependencies = dependencies;
        this.timestamp = timestamp;
        this.isLtr = isLtr;
    }
}
