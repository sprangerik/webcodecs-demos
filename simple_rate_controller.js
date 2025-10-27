class SimpleRateController {
    constructor(codecType, minQp, maxQp, targetBitrate) {
        this.codecType = codecType;
        this.minQp = minQp;
        this.maxQp = maxQp;
        this.targetBitrate = targetBitrate;
        console.log(`SimpleRateController created: ${codecType}, minQp: ${minQp}, maxQp: ${maxQp}, target: ${targetBitrate}`);
    }

    SetTargetRate(targetBitrate) {
        this.targetBitrate = targetBitrate;
        console.log(`SimpleRateController SetTargetRate: ${targetBitrate}`);
    }

    GetNextQp() {
        const nextQp = Math.round((this.minQp + this.maxQp) / 2);
        console.log(`SimpleRateController GetNextQp: ${nextQp}`);
        return nextQp;
    }

    OnEncodedFrame(qp, encodedSize) {
        console.log(`SimpleRateController OnEncodedFrame: qp: ${qp}, size: ${encodedSize}`);
        // Future logic will use this to adjust QP
    }
}
