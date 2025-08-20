import React from 'react';

const ValidationControls = ({
    onValidate,
    onOtherDefect,
    classes = [] // <-- Default to empty array
}) => (
    <div>
        Other Defect:
        <select onChange={(e) => onOtherDefect(e.target.value)}>
            {classes.map((cls, index) => (
                <option key={index} value={cls}>{cls}</option>
            ))}
        </select>
        <button onClick={onValidate}>Validate</button>
    </div>
);

export default ValidationControls;