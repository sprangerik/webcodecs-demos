class LtrReferenceController {
    constructor(buffers, simpleRateController) {
        this.availableBuffers = buffers;
        this.simpleRateController = simpleRateController;
        if (this.availableBuffers.length < 2) {
            console.warn("LTR Controller ideally needs at least 2 buffers, got", this.availableBuffers.length);
        }
        this.buffers = [
            { state: 'unused', frameId: -1, buffer: this.availableBuffers[0] },
            { state: 'unused', frameId: -1, buffer: this.availableBuffers[1] }
        ];
        this.pendingLtrFrameId = -1;
    }

    GetNextEncodeOptions(needsKeyFrame, frameId) {
        const isKey = needsKeyFrame;
        let encodeOptions = { keyFrame: isKey };
        let isLtr = false;

        if (isKey) {
            this.buffers[0].state = 'good';
            this.buffers[0].frameId = frameId;
            this.buffers[1].state = 'unused';
            this.buffers[1].frameId = -1;
            encodeOptions.referenceBuffers = [];
            encodeOptions.updateBuffer = this.buffers[0].buffer;
            this.pendingLtrFrameId = -1;
            console.log(`LTR: KeyFrame ${frameId}, using buffer 0`);
        } else {
            const goodBuffers = this.buffers.filter(b => b.state === 'good');
            encodeOptions.referenceBuffers = goodBuffers.map(b => b.buffer);

            const unusedBufferIndex = this.buffers.findIndex(b => b.state === 'unused');
            if (unusedBufferIndex !== -1 && this.pendingLtrFrameId === -1) {
                isLtr = true;
                const bufferToUse = this.buffers[unusedBufferIndex];
                bufferToUse.state = 'pending';
                bufferToUse.frameId = frameId;
                this.pendingLtrFrameId = frameId;
                encodeOptions.updateBuffer = bufferToUse.buffer;
                console.log(`LTR: DeltaFrame ${frameId}, marking as LTR, using buffer ${unusedBufferIndex}, refs: [${goodBuffers.map(b => this.availableBuffers.indexOf(b.buffer))}], pendingLtrFrameId: ${this.pendingLtrFrameId}`);
            } else {
                // No unused buffer, or LTR ack is pending, so don't update any LTR buffer
                // This means we are not producing a new LTR frame in this case.
                 console.log(`LTR: DeltaFrame ${frameId}, NOT LTR, refs: [${goodBuffers.map(b => this.availableBuffers.indexOf(b.buffer))}]`);
            }
        }
        
        return { encodeOptions, isLtr };
    }

    OnReceivedLtrAck(frameId) {
        console.log(`LTR: OnReceivedLtrAck for frameId: ${frameId}, pendingLtrFrameId: ${this.pendingLtrFrameId}`);
        if (frameId === this.pendingLtrFrameId) {
            const pendingIndex = this.buffers.findIndex(b => b.state === 'pending');
            if (pendingIndex !== -1) {
                // Mark current good buffers as unused
                this.buffers.forEach(b => {
                    if (b.state === 'good') {
                        b.state = 'unused';
                        b.frameId = -1;
                    }
                });
                // Mark the pending buffer as good
                this.buffers[pendingIndex].state = 'good';
                this.pendingLtrFrameId = -1;
                console.log(`LTR: ACK matches! Buffer ${pendingIndex} is now good. States: ${this.buffers.map(b => b.state)}`);
            } else {
                 console.warn(`LTR: ACK received for ${frameId}, but no buffer is pending!`);
            }
        } else {
            console.warn(`LTR: Received ACK for ${frameId}, but expected ${this.pendingLtrFrameId}`);
        }
    }

    GetLastGoodFrameIds() {
        return this.buffers.filter(b => b.state === 'good').map(b => b.frameId);
    }
}