import React, { useState, useEffect } from 'react';
import ImageDisplay from '../components/ImageDisplay';
import ValidationControls from '../components/ValidationControls';

const IndexPage = () => {
    const [images, setImages] = useState([]);
    const [currentImage, setCurrentImage] = useState(null);
    const [detections, setDetections] = useState([]);

    useEffect(() => {
        const fetchImages = async () => {
            const response = await fetch('/api/images'); // API to fetch image list
            const data = await response.json();
            setImages(data);
        };
        fetchImages();
    }, []);

    const handleImageSelect = (image) => {
        setCurrentImage(image);
        setDetections([]); // Reset detections for new image
    };

    const handleDetectionUpdate = (newDetections) => {
        setDetections(newDetections);
    };

    return (
        <div>
            <h1>Human-in-the-Loop Validation</h1>
            <ImageDisplay 
                image={currentImage} 
                detections={detections} 
                onImageSelect={handleImageSelect} 
            />
            <ValidationControls 
                onDetectionUpdate={handleDetectionUpdate} 
                currentImage={currentImage} 
            />
        </div>
    );
};

export default IndexPage;