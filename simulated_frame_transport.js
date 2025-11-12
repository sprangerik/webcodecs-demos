class SimulatedFrameTransport {
    constructor(onFrameReceived, rttDelayMs = 0, lossPercent = 0, ltrController = null) {
        this.onFrameReceived = onFrameReceived;
        this.rttDelayMs = rttDelayMs;
        this.lossPercent = lossPercent;
        this.bandwidthBps = 1000000; // Default 1 Mbps
        this.isRunning = true;
        this.queue = [];
        this.nextAvailableSendTime = performance.now();
        this.nextAvailableReturnTime = performance.now();
        this.ltrController = ltrController;
    }

    SetRate(bandwidthBps) {
        this.bandwidthBps = bandwidthBps;
    }

    SetRttDelay(rttDelayMs) {
        this.rttDelayMs = rttDelayMs;
    }

    SetLossPercent(lossPercent) {
        this.lossPercent = lossPercent;
    }

    SendFrame(encodedFrame, meta) {
        if (!this.isRunning) return;

        const frameSizeBits = encodedFrame.encodedChunk.byteLength * 8;
        const transmissionTimeMs = (frameSizeBits / this.bandwidthBps) * 1000;

        const now = performance.now();
        const earliestSendTime = Math.max(now, this.nextAvailableSendTime);
        const finishTime = earliestSendTime + transmissionTimeMs;

        this.nextAvailableSendTime = finishTime;

        const deliveryDelayMs = (earliestSendTime - now) + transmissionTimeMs + (this.rttDelayMs / 2);

        // console.log(`SimTransport: SendFrame ts: ${encodedFrame.timestamp}, size: ${encodedFrame.encodedChunk.byteLength}, transTime: ${transmissionTimeMs.toFixed(1)}, rtt/2: ${this.rttDelayMs / 2}, totalDelay: ${deliveryDelayMs.toFixed(1)}`);

        setTimeout(() => {
            if (this.isRunning) {
                const shouldDrop = Math.random() * 100 < this.lossPercent;
                if (shouldDrop) {
                    console.log(`SimTransport: Dropping frame ts: ${encodedFrame.timestamp} (ID: ${encodedFrame.frameId})`);
                    // Simulate NACK and retransmission
                    const nowAfterDrop = performance.now();
                    const earliestReturnTime = Math.max(nowAfterDrop, this.nextAvailableReturnTime);
                    const returnTripDelay = (this.rttDelayMs / 2);
                    this.nextAvailableReturnTime = earliestReturnTime + returnTripDelay;
                    const retransmitDelay = (earliestReturnTime - nowAfterDrop) + returnTripDelay;

                    setTimeout(() => {
                        if (this.isRunning) {
                            console.log(`SimTransport: Retransmitting frame ts: ${encodedFrame.timestamp} (ID: ${encodedFrame.frameId})`);
                            this.SendFrame(encodedFrame, meta);
                        }
                    }, retransmitDelay);
                } else {
                    this.onFrameReceived(encodedFrame, meta);

                    // If it's an LTR frame, simulate ACK
                    if (encodedFrame.isLtr && this.ltrController) {
                        const ackDelay = this.rttDelayMs / 2;
                        console.log(`SimTransport: Scheduling ACK for LTR frame ${encodedFrame.frameId} in ${ackDelay}ms`);
                        setTimeout(() => {
                            if (this.isRunning) {
                                console.log(`SimTransport: Sending ACK for LTR frame ${encodedFrame.frameId} to controller`);
                                this.ltrController.OnReceivedLtrAck(encodedFrame.frameId);
                            }
                        }, ackDelay);
                    }
                }
            }
        }, deliveryDelayMs);
    }

    Stop() {
        this.isRunning = false;
    }
}
