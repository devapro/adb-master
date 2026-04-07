import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: number;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 24 }) => {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <div className="spinner-ring" />
    </div>
  );
};
