/**
 * @fileoverview Manages Long-Term Reference (LTR) frame buffers for WebCodecs VideoEncoder.
 * This controller decides which frames should be marked as LTR frames and which
 * buffers to use for reference and updates, based on a two-buffer system.
 */
class LtrReferenceController {
    /**
     * Initializes the LTR reference controller.
     * @param {Array<object>} buffers - An array of frame buffer objects provided by the encoder.
     *                                 This array MUST contain at least two buffers.
     * @throws {Error} if the number of available buffers is less than 2.
     */
    constructor(buffers) {
        if (buffers.length < 2) {
            throw new Error(`LtrReferenceController requires at least 2 buffers, but got ${buffers.length}`);
        }
        this.availableBuffers = buffers;
        // We only use the first two buffers for this demo's LTR logic.
        this.buffers = [
            { state: 'unused', frameId: -1, buffer: this.availableBuffers[0] }, // Buffer 0
            { state: 'unused', frameId: -1, buffer: this.availableBuffers[1] }  // Buffer 1
        ];
        this.pendingLtrFrameId = -1;
    }

    /**
     * Determines the encode options for the next frame, including LTR settings.
     * @param {boolean} needsKeyFrame - Whether a key frame is required.
     * @param {number} frameId - The unique identifier for the current frame.
     * @returns {{encodeOptions: object, isLtr: boolean}} - The encoder options and a flag indicating if this frame is an LTR frame.
     */
    GetNextEncodeOptions(needsKeyFrame, frameId) {
        const isKey = needsKeyFrame;
        let encodeOptions = { keyFrame: isKey };
        let isLtr = false;

        if (isKey) {
            // On a keyframe, use buffer 0 for the new LTR frame.
            this.buffers[0].state = 'good';
            this.buffers[0].frameId = frameId;
            // Reset buffer 1.
            this.buffers[1].state = 'unused';
            this.buffers[1].frameId = -1;
            encodeOptions.referenceBuffers = []; // Keyframes have no references
            encodeOptions.updateBuffer = this.buffers[0].buffer;
            this.pendingLtrFrameId = -1; // No LTR pending after a keyframe
            // console.log(`LTR: KeyFrame ${frameId}, using buffer 0`);
        } else {
            // For delta frames, reference all currently 'good' buffers.
            const goodBuffers = this.buffers.filter(b => b.state === 'good');
            encodeOptions.referenceBuffers = goodBuffers.map(b => b.buffer);

            // Check if we can mark this frame as a new LTR frame.
            // This requires an 'unused' buffer and no other LTR frame pending acknowledgment.
            const unusedBufferIndex = this.buffers.findIndex(b => b.state === 'unused');
            if (unusedBufferIndex !== -1 && this.pendingLtrFrameId === -1) {
                isLtr = true;
                const bufferToUse = this.buffers[unusedBufferIndex];
                bufferToUse.state = 'pending'; // Mark as pending until ACKed
                bufferToUse.frameId = frameId;
                this.pendingLtrFrameId = frameId;
                encodeOptions.updateBuffer = bufferToUse.buffer;
                // console.log(`LTR: DeltaFrame ${frameId}, marking as LTR, using buffer ${unusedBufferIndex}, refs: [${goodBuffers.map(b => this.availableBuffers.indexOf(b.buffer))}], pendingLtrFrameId: ${this.pendingLtrFrameId}`);
            } else {
                // Not producing a new LTR frame in this case.
                // console.log(`LTR: DeltaFrame ${frameId}, NOT LTR, refs: [${goodBuffers.map(b => this.availableBuffers.indexOf(b.buffer))}]`);
            }
        }

        return { encodeOptions, isLtr };
    }

    /**
     * Processes the acknowledgment (ACK) of a received LTR frame.
     * @param {number} frameId - The frameId of the ACKed LTR frame.
     */
    OnReceivedLtrAck(frameId) {
        // console.log(`LTR: OnReceivedLtrAck for frameId: ${frameId}, pendingLtrFrameId: ${this.pendingLtrFrameId}`);
        if (frameId === this.pendingLtrFrameId) {
            const pendingIndex = this.buffers.findIndex(b => b.state === 'pending');
            if (pendingIndex !== -1) {
                // The pending LTR frame is now confirmed as received.
                // Mark all other buffers as 'unused'.
                this.buffers.forEach((b, index) => {
                    if (index !== pendingIndex) {
                        b.state = 'unused';
                        b.frameId = -1;
                    }
                });
                // Mark the ACKed buffer as 'good'.
                this.buffers[pendingIndex].state = 'good';
                this.pendingLtrFrameId = -1;
                // console.log(`LTR: ACK matches! Buffer ${pendingIndex} is now good. States: ${this.buffers.map(b => b.state)}`);
            } else {
                 console.warn(`LTR: ACK received for ${frameId}, but no buffer is pending!`);
            }
        } else {
            console.warn(`LTR: Received ACK for ${frameId}, but expected ${this.pendingLtrFrameId}`);
        }
    }

    /**
     * Gets the frame IDs of the buffers currently marked as 'good'.
     * These are the frames that can be used as references for encoding future frames.
     * @returns {Array<number>} An array of frame IDs.
     */
    GetLastGoodFrameIds() {
        return this.buffers.filter(b => b.state === 'good').map(b => b.frameId);
    }
}