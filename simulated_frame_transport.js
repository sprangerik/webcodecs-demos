/**
 * @fileoverview Simulates a network transport layer for WebCodecs encoded frames.
 * This class introduces configurable bandwidth limitations, round-trip time (RTT) delay,
 * and packet loss to test the resilience of video streaming setups.
 */
class SimulatedFrameTransport {
    /**
     * Initializes the SimulatedFrameTransport.
     * @param {function(EncodedFrame, object): void} onFrameReceived - Callback function invoked when a frame is successfully received at the destination.
     * @param {number} [rttDelayMs=0] - Initial round-trip time in milliseconds.
     * @param {number} [lossPercent=0] - Initial packet loss percentage (0-100).
     * @param {LtrReferenceController} [ltrController=null] - Optional LTR controller to notify of ACKs for LTR frames.
     */
    constructor(onFrameReceived, rttDelayMs = 0, lossPercent = 0, ltrController = null) {
        this.onFrameReceived = onFrameReceived;
        this.rttDelayMs = rttDelayMs;
        this.lossPercent = lossPercent;
        this.bandwidthBps = 1000000; // Default 1 Mbps
        this.isRunning = true;
        this.queue = []; // This queue is not currently used, consider removal or implementation.
        this.nextAvailableSendTime = performance.now(); // Time when the transport is free for the next send.
        this.nextAvailableReturnTime = performance.now(); // Time when the return path is free.
        this.ltrController = ltrController;
    }

    /**
     * Sets the simulated network bandwidth.
     * @param {number} bandwidthBps - Bandwidth in bits per second.
     */
    SetRate(bandwidthBps) {
        this.bandwidthBps = bandwidthBps;
    }

    /**
     * Sets the simulated round-trip time.
     * @param {number} rttDelayMs - RTT in milliseconds.
     */
    SetRttDelay(rttDelayMs) {
        this.rttDelayMs = rttDelayMs;
    }

    /**
     * Sets the simulated packet loss percentage.
     * @param {number} lossPercent - Loss percentage (0-100).
     */
    SetLossPercent(lossPercent) {
        this.lossPercent = lossPercent;
    }

    /**
     * Sends an encoded frame through the simulated network.
     * @param {EncodedFrame} encodedFrame - The frame to send.
     * @param {object} meta - Metadata associated with the frame.
     */
    SendFrame(encodedFrame, meta) {
        if (!this.isRunning) return;

        const frameSizeBits = encodedFrame.encodedChunk.byteLength * 8;
        // Calculate how long it takes to send the frame over the network.
        const transmissionTimeMs = (frameSizeBits / this.bandwidthBps) * 1000;

        const now = performance.now();
        // Determine the earliest time the frame can start sending, considering bandwidth contention.
        const earliestSendTime = Math.max(now, this.nextAvailableSendTime);
        // The time when the frame will finish transmission.
        const finishTime = earliestSendTime + transmissionTimeMs;

        // Update the next available send time for subsequent frames.
        this.nextAvailableSendTime = finishTime;

        // Calculate the total delay until the frame is delivered to the receiver.
        // This includes any queuing delay, transmission time, and half the RTT (one-way delay).
        const deliveryDelayMs = (earliestSendTime - now) + transmissionTimeMs + (this.rttDelayMs / 2);

        // console.log(`SimTransport: SendFrame ts: ${encodedFrame.timestamp}, size: ${encodedFrame.encodedChunk.byteLength}, transTime: ${transmissionTimeMs.toFixed(1)}, rtt/2: ${this.rttDelayMs / 2}, totalDelay: ${deliveryDelayMs.toFixed(1)}`);

        setTimeout(() => {
            if (!this.isRunning) return;

            // Simulate packet loss.
            const shouldDrop = Math.random() * 100 < this.lossPercent;
            if (shouldDrop) {
                // console.log(`SimTransport: Dropping frame ts: ${encodedFrame.timestamp} (ID: ${encodedFrame.frameId})`);
                
                // Simplified Retransmission Simulation:
                // Assume a NACK is received after RTT/2, and retransmission starts.
                // This doesn't model complex scenarios like NACK aggregation or backoff.
                const nowAfterDrop = performance.now();
                const earliestReturnTime = Math.max(nowAfterDrop, this.nextAvailableReturnTime);
                const returnTripDelay = (this.rttDelayMs / 2);
                this.nextAvailableReturnTime = earliestReturnTime + returnTripDelay;
                const retransmitDelay = (earliestReturnTime - nowAfterDrop) + returnTripDelay;

                setTimeout(() => {
                    if (this.isRunning) {
                        // console.log(`SimTransport: Retransmitting frame ts: ${encodedFrame.timestamp} (ID: ${encodedFrame.frameId})`);
                        this.SendFrame(encodedFrame, meta); // Re-queue the frame.
                    }
                }, retransmitDelay);
            } else {
                // Frame successfully delivered.
                this.onFrameReceived(encodedFrame, meta);

                // LTR ACK Simulation:
                // If it's an LTR frame and an LTR controller is present, simulate an ACK.
                if (encodedFrame.isLtr && this.ltrController) {
                    const ackDelay = this.rttDelayMs / 2; // ACK travels back in RTT/2.
                    // console.log(`SimTransport: Scheduling ACK for LTR frame ${encodedFrame.frameId} in ${ackDelay}ms`);
                    setTimeout(() => {
                        if (this.isRunning) {
                            // console.log(`SimTransport: Sending ACK for LTR frame ${encodedFrame.frameId} to controller`);
                            this.ltrController.OnReceivedLtrAck(encodedFrame.frameId);
                        }
                    }, ackDelay);
                }
            }
        }, deliveryDelayMs);
    }

    /**
     * Stops the transport simulation. No more frames will be processed or scheduled.
     */
    Stop() {
        this.isRunning = false;
        // Clear any pending timeouts? (Potentially many)
        // For simplicity in this demo, we are not clearing timeouts, they will just not execute the main logic.
    }
}
