import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let model;

export const loadModel = async () => {
    model = await cocoSsd.load();
};

export const detectObjects = async (image) => {
    if (!model) {
        throw new Error("Model not loaded. Please load the model before detection.");
    }

    const predictions = await model.detect(image);
    return predictions;
};