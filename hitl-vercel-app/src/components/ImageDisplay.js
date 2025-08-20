import React from 'react';

const ImageDisplay = ({ imageSrc, boundingBoxes = [], labels = [] }) => {
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={imageSrc} alt="Detected" style={{ width: '500px', height: '500px' }} />
            {boundingBoxes.map((box, index) => (
                <div
                    key={index}
                    style={{
                        position: 'absolute',
                        border: '2px solid green',
                        left: box.x1,
                        top: box.y1,
                        width: box.x2 - box.x1,
                        height: box.y2 - box.y1,
                    }}
                >
                    <span style={{
                        position: 'absolute',
                        backgroundColor: 'rgba(0, 255, 0, 0.7)',
                        color: 'black',
                        padding: '2px',
                        top: box.y1 - 20,
                        left: box.x1,
                    }}>
                        {labels[index]}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default ImageDisplay;