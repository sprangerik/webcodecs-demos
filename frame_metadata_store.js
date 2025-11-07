
class FrameMetadataStore {
    constructor() {
        this.metadataMap = new Map();
    }

    /**
     * Adds metadata for a frame.
     * @param {number} timestamp - The unique timestamp of the VideoFrame.
     * @param {object} metadata - An object containing metadata like QP, referenceBuffers, updateBuffer.
     */
    addFrameMetadata(timestamp, metadata) {
        if (this.metadataMap.has(timestamp)) {
            console.warn(`FrameMetadataStore: Metadata for timestamp ${timestamp} already exists. Overwriting.`);
        }
        this.metadataMap.set(timestamp, metadata);
    }

    /**
     * Retrieves metadata for a frame.
     * @param {number} timestamp - The timestamp of the VideoFrame.
     * @returns {object | undefined} The metadata object, or undefined if not found.
     */
    getFrameMetadata(timestamp) {
        return this.metadataMap.get(timestamp);
    }

    /**
     * Removes metadata for a frame.
     * @param {number} timestamp - The timestamp of the VideoFrame.
     * @returns {boolean} True if an entry was removed, false otherwise.
     */
    removeFrameMetadata(timestamp) {
        return this.metadataMap.delete(timestamp);
    }

    /**
     * Clears all stored metadata.
     */
    clear() {
        this.metadataMap.clear();
    }

    /**
     * Removes metadata for frames older than the given timestamp.
     * @param {number} timestamp - The cutoff timestamp.
     */
    pruneOldMetadata(timestamp) {
        for (const key of this.metadataMap.keys()) {
            if (key < timestamp) {
                this.metadataMap.delete(key);
            }
        }
    }
}
