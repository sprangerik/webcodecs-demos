class SimulatedFrameTransport {
    constructor(frameReceiverCallback) {
        this.frameReceiverCallback = frameReceiverCallback;
        this.bandwidthBps = 500 * 1000; // Default to 500 kbps
        this.frameQueue = [];
        this.isDelivering = false;
        this.timeoutId = null;
    }

    SetRate(bandwidthBps) {
        this.bandwidthBps = bandwidthBps;
    }

    SendFrame(frame, metadata) {
        this.frameQueue.push({ frame, metadata });

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
        const { frame, metadata } = this.frameQueue.shift();

        let transmissionTimeMs = 0;
        if (this.bandwidthBps > 0) {
            const frameSizeBytes = frame.byteLength;
            const frameSizeBits = frameSizeBytes * 8;
            transmissionTimeMs = (frameSizeBits / this.bandwidthBps) * 1000;
        } else {
            transmissionTimeMs = 3600000; // Effectively infinite delay
        }

        this.timeoutId = setTimeout(() => {
            if (this.frameReceiverCallback) {
                this.frameReceiverCallback(frame, metadata);
            }
            // Start processing the next frame only after this one is delivered.
            this.DeliverNextFrame();
        }, transmissionTimeMs);
    }

    Stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.frameQueue = [];
        this.isDelivering = false;
    }
}
