import { NextApiRequest, NextApiResponse } from 'next';
import { loadModel, detectObjects } from '../../utils/yolo';

let model;

const handler = async (req, res) => {
    if (req.method === 'POST') {
        try {
            if (!model) {
                model = await loadModel('path/to/best0331.pt');
            }

            const { image } = req.body;

            if (!image) {
                return res.status(400).json({ error: 'Image is required' });
            }

            const results = await detectObjects(model, image);
            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: 'Error processing image' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

export default handler;