import React from 'react';
import { AbsoluteFill } from 'remotion';

export const MazeRace: React.FC<{ data_json: any, topic: string }> = ({ data_json, topic }) => {
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#1a1a2e', 
      justifyContent: 'center', 
      alignItems: 'center',
      color: 'white',
      fontFamily: '"Montserrat", sans-serif'
    }}>
      <h1 style={{ fontSize: 80, fontWeight: 900 }}>Maze Race Engine Loading...</h1>
    </AbsoluteFill>
  );
};
