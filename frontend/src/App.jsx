import React from 'react';
import PinballGame from './PinballGame';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <h1 className="game-title">Neon Pinball</h1>
      <PinballGame />
      <p className="instructions">
        Use <b>Left/Right Arrow</b> or <b>A/D</b> to flip<br />
        Press <b>Space</b> to Start/Reset
      </p>
    </div>
  );
}

export default App;
