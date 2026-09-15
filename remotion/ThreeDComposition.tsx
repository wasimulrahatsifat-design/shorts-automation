import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Sequence, Audio } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Text, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DataJson } from './Composition';

const ImagePlane = ({ url, height }: { url: string, height: number }) => {
  try {
    const texture = useTexture(url);
    return (
      <mesh position={[0, height / 2, 0.76]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    );
  } catch (e) {
    return null;
  }
};

const Pillar = ({ item, index, maxVal, totalItems, fps, frame }: { item: any, index: number, maxVal: number, totalItems: number, fps: number, frame: number }) => {
  const delay = index * 10 + 20;
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const targetHeight = maxVal === 0 ? 0.1 : (item.value / maxVal) * 5;
  const currentHeight = progress * targetHeight + 0.01;

  // Layout calculations
  const spacing = 3;
  const totalWidth = (totalItems - 1) * spacing;
  const x = (index * spacing) - (totalWidth / 2);
  
  return (
    <group position={[x, 0, 0]}>
      {/* 3D Box for the pillar */}
      <mesh position={[0, currentHeight / 2, 0]}>
        <boxGeometry args={[1.5, currentHeight, 1.5]} />
        <meshStandardMaterial color={`hsl(${(index * 360) / totalItems}, 70%, 50%)`} />
      </mesh>

      {/* Image plane on front of pillar */}
      {item.image_url && <React.Suspense fallback={null}>
        <ImagePlane url={item.image_url} height={currentHeight} />
      </React.Suspense>}

      {/* Label Text */}
      <Text
        position={[0, currentHeight + 0.5, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        {item.label}
      </Text>

      {/* Value Text */}
      <Text
        position={[0, currentHeight + 0.1, 1]}
        fontSize={0.3}
        color="yellow"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        {Math.round(item.value * progress).toLocaleString()}
      </Text>
    </group>
  );
};

const CameraController = ({ fps, frame }: { fps: number, frame: number }) => {
  const { camera } = useThree();
  
  const cameraProgress = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 10 },
  });
  
  const startX = -3;
  const endX = 3;
  const cameraX = startX + (endX - startX) * cameraProgress;
  
  camera.position.x = cameraX;
  camera.position.y = 4;
  camera.position.z = 12;
  camera.lookAt(0, 2, 0); // Look slightly up towards the pillars
  
  return null;
};

const Scene = ({ items, fps, frame }: { items: any[], fps: number, frame: number }) => {
  const maxVal = Math.max(...(items || []).map(d => d.value), 1);
  const totalItems = items.length;

  return (
    <>
      <CameraController fps={fps} frame={frame} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      
      {/* Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Camera Controller is implicit in ThreeCanvas, we just map pillars */}
      {(items || []).map((item, index) => (
        <Pillar key={index} item={item} index={index} maxVal={maxVal} totalItems={totalItems} fps={fps} frame={frame} />
      ))}
    </>
  );
};

export const ThreeDComposition: React.FC<{ topic: string, data_json: DataJson }> = ({ topic, data_json }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const { script, items, show_subtitles, tts_url } = data_json || {};

  const titleOpacity = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const subtitleOpacity = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Audio Track */}
      {tts_url && <Audio src={tts_url} />}

      <ThreeCanvas
        width={width}
        height={height}
      >
        <Scene items={items || []} fps={fps} frame={frame} />
      </ThreeCanvas>

      {/* 2D Overlay: Title */}
      <div style={{
        position: 'absolute',
        top: 80,
        width: '100%',
        textAlign: 'center',
        fontSize: 70,
        fontWeight: 'bold',
        color: 'white',
        textShadow: '0 4px 10px rgba(0,0,0,0.8)',
        opacity: titleOpacity
      }}>
        {topic}
      </div>

      {/* 2D Overlay: Subtitles */}
      {show_subtitles !== false && (
        <Sequence from={15}>
          <div style={{
            position: 'absolute',
            bottom: 100,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontSize: 50,
            fontWeight: 800,
            textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.4)',
            padding: '25px',
            borderRadius: 20,
            border: '4px solid rgba(255,255,255,0.1)',
            opacity: subtitleOpacity
          }}>
            {script}
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
