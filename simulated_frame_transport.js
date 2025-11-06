class SimulatedFrameTransport {
    constructor(frameReceiverCallback) {
        this.frameReceiverCallback = frameReceiverCallback;
        this.bandwidthBps = 500 * 1000; // Default to 500 kbps
        this.frameQueue = [];
        this.isDelivering = false;
        this.timeoutId = null;
        this.keyFrameNeeded = false;
    }

    SetRate(bandwidthBps) {
        this.bandwidthBps = bandwidthBps;
    }

    SetKeyFrameNeeded() {
        this.keyFrameNeeded = true;
    }

    ClearKeyFrameNeeded() {
        this.keyFrameNeeded = false;
    }

    SendFrame(encodedFrame, meta) {
        this.frameQueue.push({ encodedFrame, meta });

        if (!this.isDelivering) {
            this.DeliverNextFrame();
        }
    }

    DeliverNextFrame() {
        if (this.frameQueue.length === 0) {
            this.isDelivering = false;
            return;
        }

        this.isDelivering = true;
        const { encodedFrame, meta } = this.frameQueue.shift();

        this.timeoutId = setTimeout(() => {
            if (this.frameReceiverCallback) {
                this.frameReceiverCallback(encodedFrame, meta);
            }
            // Start processing the next frame only after this one is delivered.
            this.DeliverNextFrame();
        }, 0);
    }

    Stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.frameQueue = [];
        this.isDelivering = false;
        this.keyFrameNeeded = false;
    }
}
