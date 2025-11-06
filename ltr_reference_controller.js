class LtrReferenceController {
    constructor(buffers, simpleRateController) {
        this.buffers = buffers;
        this.simpleRateController = simpleRateController;
        this.frameIndex = 0;
        if (this.buffers.length < 2) {
            console.warn("LTR Controller ideally needs at least 2 buffers, got", this.buffers.length);
        }
    }

    GetNextEncodeOptions(needsKeyFrame) {
        const isKey = needsKeyFrame || this.frameIndex === 0;
        let encodeOptions = { keyFrame: isKey };

        if (this.buffers.length === 0) {
            // return encodeOptions; // No buffers to use
        } else if (this.buffers.length === 1) {
            encodeOptions.referenceBuffers = isKey ? [] : [this.buffers[0]];
            encodeOptions.updateBuffer = this.buffers[0];
        } else {
            // Alternate between buffer 0 and 1
            const refIndex = (this.frameIndex > 0) ? (this.frameIndex - 1) % 2 : 0;
            const updateIndex = this.frameIndex % 2;

            if (isKey) {
                encodeOptions.referenceBuffers = [];
                encodeOptions.updateBuffer = this.buffers[0]; // Start with buffer 0 for keyframes
            } else {
                encodeOptions.referenceBuffers = [this.buffers[refIndex]];
                encodeOptions.updateBuffer = this.buffers[updateIndex];
            }
        }

        this.frameIndex++;
        console.log("LtrReferenceController.GetNextEncodeOptions:", encodeOptions);
        return encodeOptions;
    }
}