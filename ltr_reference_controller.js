class LtrReferenceController {
    constructor(buffers, simpleRateController) {
        this.buffers = buffers;
        this.simpleRateController = simpleRateController;
    }

    GetNextEncodeOptions(needsKeyFrame) {
        return {
            keyFrame: needsKeyFrame,
            referenceBuffers: [this.buffers[0]],
            updateBuffer: this.buffers[0]
        };
    }
}
