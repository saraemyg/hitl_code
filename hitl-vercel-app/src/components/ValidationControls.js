import React from 'react';

const ValidationControls = ({ onCorrect, onHealthy, onOtherDefect, classes }) => {
    return (
        <div>
            <button onClick={onCorrect}>Correct Defect</button>
            <button onClick={onHealthy}>Healthy</button>
            <label>
                Other Defect:
                <select onChange={(e) => onOtherDefect(e.target.value)}>
                    {classes.map((cls, index) => (
                        <option key={index} value={cls}>{cls}</option>
                    ))}
                </select>
            </label>
        </div>
    );
};

export default ValidationControls;