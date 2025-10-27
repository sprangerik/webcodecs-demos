class SimpleRateController {
    constructor(codecType, minQp, maxQp, initialBitrate, initialFramerate, timestamp) {
        this.codecType = codecType;
        this.minQp = minQp;
        this.maxQp = maxQp;
        this.targetBitrate = initialBitrate;
        this.framerate = initialFramerate;
        this.bitDebt = 0; // in bits
        this.lastBitrateUpdateTimestamp = timestamp;
        this.currentQp = Math.round((this.minQp + this.maxQp) / 2);

        console.log(`SimpleRateController created: ${codecType}, QP range: [${minQp}, ${maxQp}], target: ${initialBitrate} bps, fps: ${initialFramerate}`);
    }

    _updateDebt(timestamp) {
        if (timestamp <= this.lastBitrateUpdateTimestamp) return;

        const timeDeltaSeconds = (timestamp - this.lastBitrateUpdateTimestamp) / 1000;
        const bitsGeneratedTarget = this.targetBitrate * timeDeltaSeconds;
        this.bitDebt -= bitsGeneratedTarget;

        this.lastBitrateUpdateTimestamp = timestamp;
    }

    SetRates(targetBitrate, framerate, timestamp) {
        this._updateDebt(timestamp);
        this.targetBitrate = targetBitrate;
        this.framerate = framerate;
        console.log(`SimpleRateController SetRates: ${targetBitrate} bps, fps: ${framerate}`);
    }

    GetNextQp(timestamp, isKeyFrame) {
        this._updateDebt(timestamp);

        const targetBitsPerFrame = this.targetBitrate / this.framerate;
        const debtRatio = this.bitDebt / targetBitsPerFrame;

        let qpChange = 0;
        if (debtRatio > 2.0) { // Large overshoot
            qpChange = 2;
        } else if (debtRatio > 1.0) { // Moderate overshoot
            qpChange = 1;
        } else if (debtRatio < -2.0) { // Large undershoot
            qpChange = -2;
        } else if (debtRatio < -1.0) { // Moderate undershoot
            qpChange = -1;
        }

        this.currentQp = Math.max(this.minQp, Math.min(this.maxQp, this.currentQp + qpChange));

        let finalQp = this.currentQp;
        if (isKeyFrame) {
            finalQp = Math.min(this.maxQp, this.currentQp + 10); // Boost QP for keyframe
            console.log(`Keyframe QP boost: ${this.currentQp} -> ${finalQp}`);
        }

        console.log(`SimpleRateController GetNextQp: debt: ${this.bitDebt.toFixed(0)}, targetBits: ${targetBitsPerFrame.toFixed(0)}, debtRatio: ${debtRatio.toFixed(2)}, isKey: ${isKeyFrame}, nextQp: ${finalQp}`);
        return finalQp;
    }

    OnEncodedFrame(timestamp, encodedSizeBytes, isKeyFrame) {
        this._updateDebt(timestamp);
        const encodedSizeBits = encodedSizeBytes * 8;
        this.bitDebt += encodedSizeBits;
        console.log(`SimpleRateController OnEncodedFrame: ${isKeyFrame ? 'KEY' : 'DELTA'} size: ${encodedSizeBytes} bytes, new debt: ${this.bitDebt.toFixed(0)}`);
    }
}