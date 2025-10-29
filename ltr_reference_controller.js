class LtrReferenceController {
    constructor(buffers) {
        this.buffers = buffers;
    }

    GetNextEncodeOptions(needsKeyFrame) {
        return {
            keyFrame: needsKeyFrame,
            referenceBuffers: [this.buffers[0]],
            updateBuffer: this.buffers[0]
        };
    }
}
