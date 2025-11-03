class EncodedFrame {
    constructor(encodedChunk, frameId, dependencies, timestamp) {
        this.encodedChunk = encodedChunk;
        this.frameId = frameId;
        this.dependencies = dependencies;
        this.timestamp = timestamp;
    }
}
