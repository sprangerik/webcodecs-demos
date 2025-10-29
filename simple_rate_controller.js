class SimpleRateController {
    constructor(codecType, minQp, maxQp, initialBitrate, initialFramerate, timestamp) {
        this.codecType = codecType;
        this.minQp = minQp;
        this.maxQp = maxQp;
        this.targetBitrate = initialBitrate;
        this.framerate = initialFramerate;
        this.bitDebt = 0; // in bits
        this.lastBitrateUpdateTimestamp = timestamp;
        this.currentQp = (this.minQp + this.maxQp) / 2; // Float QP

        // PID coefficients
        this.Kp = 0.000003;
        this.Ki = 0.0000003;
        this.Kd = 0.000005;

        this.previousBitDebt = 0;
        this.lastQpUpdateTimestamp = timestamp;

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

        const now = timestamp;
        const timeDelta = (now - this.lastQpUpdateTimestamp) / 1000;

        let qpAdjustment = 0;
        if (timeDelta > 0) {
            // P term: Proportional to the current error (bitDebt)
            const pTerm = this.Kp * this.bitDebt;

            // I term: Proportional to the integral of the error (already in bitDebt)
            const iTerm = this.Ki * this.bitDebt * timeDelta; // Scale by timeDelta

            // D term: Proportional to the rate of change of the error
            const debtChange = this.bitDebt - this.previousBitDebt;
            const dTerm = this.Kd * (debtChange / timeDelta);

            qpAdjustment = pTerm + iTerm + dTerm;
            this.previousBitDebt = this.bitDebt;
            this.lastQpUpdateTimestamp = now;
        }

        // Only apply adjustment if it's significant to cross the 0.5 threshold for a QP change
        if (Math.abs(qpAdjustment) > 0.5) {
            this.currentQp += qpAdjustment;
        }
        this.currentQp = Math.max(this.minQp, Math.min(this.maxQp, this.currentQp));

        let qpToDither = this.currentQp;
        if (isKeyFrame) {
            qpToDither = Math.min(this.maxQp, this.currentQp + 10); // Boost QP for keyframe
            console.log(`Keyframe QP boost: ${this.currentQp.toFixed(2)} -> ${qpToDither.toFixed(2)}`);
        }

        // Dithered rounding
        const floorQp = Math.floor(qpToDither);
        const fraction = qpToDither - floorQp;
        let ditheredQp = floorQp;
        if (Math.random() < fraction) {
            ditheredQp = Math.min(this.maxQp, floorQp + 1);
        }
        ditheredQp = Math.max(this.minQp, ditheredQp);

        console.log(`SimpleRateController GetNextQp: debt: ${this.bitDebt.toFixed(0)}, adj: ${qpAdjustment.toFixed(2)}, floatQp: ${this.currentQp.toFixed(2)}, nextQp: ${ditheredQp}`);
        return ditheredQp;
    }

    OnEncodedFrame(timestamp, encodedSizeBytes, isKeyFrame) {
        this._updateDebt(timestamp);
        const encodedSizeBits = encodedSizeBytes * 8;
        this.bitDebt += encodedSizeBits;
        console.log(`SimpleRateController OnEncodedFrame: ${isKeyFrame ? 'KEY' : 'DELTA'} size: ${encodedSizeBytes} bytes, new debt: ${this.bitDebt.toFixed(0)}`);
    }
}
