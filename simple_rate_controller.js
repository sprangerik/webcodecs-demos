class SimpleRateController {
    constructor(codecType, minQp, maxQp, initialBitrate, initialFramerate, timestamp, maxBufferLevelMs, targetFullnessPercent, alpha, Kp_buffer) {
        this.codecType = codecType;
        this.minQp = minQp;
        this.maxQp = maxQp;
        this.targetBitrate = initialBitrate;
        this.framerate = initialFramerate;
        this.maxBufferLevelMs = maxBufferLevelMs;
        this.targetFullnessPercent = targetFullnessPercent;

        // Bit depth in bits, represents current buffer level.
        // Start at target minus one frame size.
        this.bitDebt = ((this.maxBufferLevelMs / 1000) * this.targetBitrate) * (this.targetFullnessPercent / 100) - (1000 / initialFramerate) * initialBitrate; 
        this.lastUpdateTime = timestamp;
        this.currentQp = this.minQp + 0.2 * (this.maxQp - this.minQp); // Float QP

        // Calculated buffer levels
        // maxBufferLevelBits: how many bits the buffer can hold corresponds to maxBufferLevelMs at targetBitrate.
        this.maxBufferLevelBits = (this.maxBufferLevelMs / 1000) * this.targetBitrate;
        // targetBufferLevelBits: how many bits we want in the buffer based on targetFullnessPercent.
        this.targetBufferLevelBits = this.maxBufferLevelBits * (this.targetFullnessPercent / 100);

        // Proportional gain for buffer fullness error
        this.Kp_buffer = Kp_buffer; // Re-tuned for new calculation
        this.overshootPenalty = 1.5; // Penalize overshooting more heavily

        // Statistics for QP-to-size relationship
        this.alpha = alpha; // Smoothing factor for exponential moving average
        this.avgQp = this.currentQp;
        this.avgSizeRatio = 1.0; // Assuming 1.0 means target size at avgQp

        // Last reported QP (for filtering)
        this.lastReportedQp = this.currentQp;

        // console.log(`SimpleRateController created: ${codecType}, QP range: [${minQp}, ${maxQp}], target: ${initialBitrate} bps, fps: ${initialFramerate}, maxBufferMs: ${maxBufferLevelMs}, targetFullness: ${targetFullnessPercent}%`);
        // console.log(`MaxBufferBits: ${this.maxBufferLevelBits.toFixed(0)}, TargetBufferBits: ${this.targetBufferLevelBits.toFixed(0)}`);
    }

    _updateBufferLevel(timestamp) {
        if (timestamp <= this.lastUpdateTime) return;

        const timeDeltaSeconds = (timestamp - this.lastUpdateTime) / 1000;
        const bitsGeneratedTarget = this.targetBitrate * timeDeltaSeconds;
        this.bitDebt -= bitsGeneratedTarget;
        // Ensure bitDebt doesn't go below 0
        this.bitDebt = Math.max(0, this.bitDebt);
        this.lastUpdateTime = timestamp;

        // Clamp bitDebt to max buffer level
        this.bitDebt = Math.min(this.bitDebt, this.maxBufferLevelBits);
    }

    _qpDiffToSizeRatioMap = new Map([
        // Rought estimates based on quick AV1 test run.
        // AVG_Frame_Size_Change -> QP_Change
        [0.001798, 62],
        [0.0022725, 61],
        [0.002734666667, 60],
        [0.00327625, 59],
        [0.0038926, 58],
        [0.0045205, 57],
        [0.005228571429, 56],
        [0.006012125, 55],
        [0.006848, 54],
        [0.0077772, 53],
        [0.008757090909, 52],
        [0.009830583333, 51],
        [0.010989, 50],
        [0.01220735714, 49],
        [0.013513, 48],
        [0.0149413125, 47],
        [0.01644858824, 46],
        [0.01803994444, 45],
        [0.01972410526, 44],
        [0.0215269, 43],
        [0.02345085714, 42],
        [0.02547804545, 41],
        [0.027639, 40],
        [0.02996491667, 39],
        [0.03247976, 38],
        [0.0352165, 37],
        [0.03819137037, 36],
        [0.04141142857, 35],
        [0.04489486207, 34],
        [0.04864216667, 33],
        [0.05272322581, 32],
        [0.057143, 31],
        [0.06187972727, 30],
        [0.06700241176, 29],
        [0.07254808571, 28],
        [0.07858286111, 27],
        [0.08514808108, 26],
        [0.0923025, 25],
        [0.1000787692, 24],
        [0.10856685, 23],
        [0.1178304878, 22],
        [0.127863619, 21],
        [0.1388542093, 20],
        [0.1507857727, 19],
        [0.1638243111, 18],
        [0.1780848696, 17],
        [0.1936230426, 16],
        [0.210651, 15],
        [0.2293387347, 14],
        [0.2498109, 13],
        [0.2724238431, 12],
        [0.2973803654, 11],
        [0.3251005094, 10],
        [0.3559042407, 9],
        [0.3904522, 8],
        [0.4295251071, 7],
        [0.4740472456, 6],
        [0.5253890172, 5],
        [0.5850772034, 4],
        [0.6556816, 3],
        [0.7409670164, 2],
        [0.845917371, 1],
        [1, 0], // No change in size ratio means no change in QP
        [1.171000081, -1],
        [1.407699344, -2],
        [1.7023176, -3],
        [2.062292661, -4],
        [2.491604569, -5],
        [2.986493649, -6],
        [3.530314161, -7],
        [4.109266055, -8],
        [4.723143704, -9],
        [5.364622, -10],
        [6.045292173, -11],
        [6.759121647, -12],
        [7.51296962, -13],
        [8.319530735, -14],
        [9.178770667, -15],
        [10.08341436, -16],
        [11.05165061, -17],
        [12.08214564, -18],
        [13.18532373, -19],
        [14.35463051, -20],
        [15.60263471, -21],
        [16.94503307, -22],
        [18.38445148, -23],
        [19.92337918, -24],
        [21.55114013, -25],
        [23.26729843, -26],
        [25.07703061, -27],
        [27.0122496, -28],
        [29.058076, -29],
        [31.23626485, -30],
        [33.54250956, -31],
        [36.03576142, -32],
        [38.75189083, -33],
        [41.641135, -34],
        [44.74287264, -35],
        [48.05498607, -36],
        [51.60463027, -37],
        [55.40147972, -38],
        [59.44019667, -39],
        [63.70789739, -40],
        [68.29124259, -41],
        [73.29697105, -42],
        [78.8087617, -43],
        [84.80100947, -44],
        [91.30833383, -45],
        [98.47234553, -46],
        [106.4021573, -47],
        [115.1888475, -48],
        [124.9340925, -49],
        [135.8147662, -50],
        [148.1286566, -51],
        [162.0354666, -52],
        [177.7844835, -53],
        [196.2252964, -54],
        [217.8315121, -55],
        [243.5757121, -56],
        [274.5109572, -57],
        [311.7553418, -58],
        [359.7676065, -59],
        [422.0774087, -60],
        [503.340873, -61],
        [628.64946, -62],
    ]);

    _qpChangeFromSizeRatioChange(sizeRatioChange) {
        let lowerSizeRatio = -1, upperSizeRatio = -1;
        let lowerQpChange = -1, upperQpChange = -1;

        // Iterate through the map to find the bounding ratios and QP changes
        // The map is sorted by sizeRatioChange (ascending)
        const sortedEntries = Array.from(this._qpDiffToSizeRatioMap.entries()).sort((a, b) => a[0] - b[0]);

        for (const [mapSizeRatio, mapQpChange] of sortedEntries) {
            if (mapSizeRatio <= sizeRatioChange) {
                lowerSizeRatio = mapSizeRatio;
                lowerQpChange = mapQpChange;
            }
            if (mapSizeRatio >= sizeRatioChange) {
                upperSizeRatio = mapSizeRatio;
                upperQpChange = mapQpChange;
                break; // Found the upper bound, can stop
            }
        }

        // Handle cases where sizeRatioChange is outside the map's range
        if (upperSizeRatio === -1) return lowerQpChange; // Larger than max mapped ratio, use max QP change
        if (lowerSizeRatio === -1) return upperQpChange; // Smaller than min mapped ratio, use min QP change

        if (lowerSizeRatio === upperSizeRatio) {
            return lowerQpChange;
        }

        // Linear interpolation for QP change
        return lowerQpChange + (upperQpChange - lowerQpChange) *
               (sizeRatioChange - lowerSizeRatio) / (upperSizeRatio - lowerSizeRatio);
    }

    SetRates(targetBitrate, framerate, newMaxBufferLevelMs, newTargetFullnessPercent, timestamp, newAlpha, newKpBuffer) {
        this._updateBufferLevel(timestamp);
        this.targetBitrate = targetBitrate;
        this.framerate = framerate;
        this.maxBufferLevelMs = newMaxBufferLevelMs;
        this.targetFullnessPercent = newTargetFullnessPercent;
        this.alpha = newAlpha;
        this.Kp_buffer = newKpBuffer;
        this.maxBufferLevelBits = (this.maxBufferLevelMs / 1000) * this.targetBitrate;
        this.targetBufferLevelBits = this.maxBufferLevelBits * (this.targetFullnessPercent / 100);
        // console.log(`SimpleRateController SetRates: ${targetBitrate} bps, fps: ${framerate}, maxBufferMs: ${this.maxBufferLevelMs}, targetFullness: ${this.targetFullnessPercent}%, alpha: ${this.alpha}, Kp_buffer: ${this.Kp_buffer}`);
    }

    GetNextQp(timestamp, isKeyFrame) {
        this._updateBufferLevel(timestamp);

        // Calculate buffer fullness error
        let bufferError = this.bitDebt - this.targetBufferLevelBits;

        // Apply asymmetric penalty for overshooting
        if (bufferError > 0) {
            bufferError *= this.overshootPenalty;
        }

        // Determine desired frame size change based on buffer error
        // A positive bufferError (buffer too full) means we want a smaller frame.
        // A negative bufferError (buffer too empty) means we want a larger frame.
        const targetFrameSizeBits = this.targetBitrate / this.framerate;

        // Calculate the desired frame size in bits
        const desiredFrameSizeBits = targetFrameSizeBits - (this.Kp_buffer * bufferError);

        // Calculate the ratio of desired frame size to the current average frame size
        // This is the 'AVG_Frame_Size_Change' that _qpChangeFromSizeRatioChange expects
        const sizeChangeRatio = desiredFrameSizeBits / (this.avgSizeRatio * targetFrameSizeBits);

        // Clamp sizeChangeRatio to reasonable bounds (e.g., 0.001 to 628 based on _qpDiffToSizeRatioMap)
        const clampedSizeChangeRatio = Math.max(0.001, Math.min(628, sizeChangeRatio));

        // Get the QP change from the map
        const qpChange = this._qpChangeFromSizeRatioChange(clampedSizeChangeRatio);

        // Apply the QP change to the average QP
        let nextQp = this.avgQp + qpChange;

        // Clamp QP to min/max allowed values
        nextQp = Math.max(this.minQp, Math.min(this.maxQp, nextQp));

        let qpToDither = nextQp;
        if (isKeyFrame) {
            // Keyframes typically get a slightly higher QP to ensure they are smaller
            // and easier to transmit, or lower to improve quality. This needs tuning.
            // For now, let's apply a small boost to make them slightly smaller by increasing QP.
            qpToDither = Math.min(this.maxQp, nextQp + 5); 
            // console.log(`Keyframe QP adjustment: ${nextQp.toFixed(2)} -> ${qpToDither.toFixed(2)}`);
        }

        // Dithered rounding
        const floorQp = Math.floor(qpToDither);
        const fraction = qpToDither - floorQp;
        let ditheredQp = floorQp;
        if (Math.random() < fraction) {
            ditheredQp = Math.min(this.maxQp, floorQp + 1);
        }
        ditheredQp = Math.max(this.minQp, ditheredQp);

        this.currentQp = ditheredQp; // Update currentQp with the new dithered QP
        this.lastReportedQp = ditheredQp; // Update last reported QP for potential filtering

        // console.log(`SimpleRateController GetNextQp: bitDebt: ${this.bitDebt.toFixed(0)}, targetFullness: ${this.targetFullnessPercent}%, error: ${bufferError.toFixed(2)}, clampedSizeChangeRatio: ${clampedSizeChangeRatio.toFixed(2)}, qpChange: ${qpChange.toFixed(2)}, nextQp: ${ditheredQp}`);
        return ditheredQp;
    }

    OnEncodedFrame(timestamp, encodedSizeBytes, qp, isKeyFrame) {
        this._updateBufferLevel(timestamp);
        const encodedSizeBits = encodedSizeBytes * 8;
        this.bitDebt += encodedSizeBits;
        // Clamp bitDebt after adding new frame as well
        this.bitDebt = Math.min(this.bitDebt, this.maxBufferLevelBits);

        // Update QP-to-size statistics
        const targetFrameSizeBits = this.targetBitrate / this.framerate;
        const actualSizeRatio = encodedSizeBits / targetFrameSizeBits;

        this.avgQp = this.alpha * qp + (1 - this.alpha) * this.avgQp;
        this.avgSizeRatio = this.alpha * actualSizeRatio + (1 - this.alpha) * this.avgSizeRatio;

        // console.log(`SimpleRateController OnEncodedFrame: ${isKeyFrame ? 'KEY' : 'DELTA'} size: ${encodedSizeBytes} bytes, QP: ${qp}, actualSizeRatio: ${actualSizeRatio.toFixed(2)}, avgQp: ${this.avgQp.toFixed(2)}, avgSizeRatio: ${this.avgSizeRatio.toFixed(2)}, new debt: ${this.bitDebt.toFixed(0)}`);
    }
}
