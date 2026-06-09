'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, StepBack, StepForward, RotateCcw, FastForward } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function PlaybackControls({ playbackState, setPlaybackState, maxIndex, disabled }) {
  const { playing, speed, currentIndex } = playbackState;
  const intervalRef = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setPlaybackState(prev => {
          if (prev.currentIndex < maxIndex) {
            return { ...prev, currentIndex: prev.currentIndex + 1 };
          }
          clearInterval(intervalRef.current);
          return { ...prev, playing: false };
        });
      }, 1000 / speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, maxIndex, setPlaybackState]);

  const togglePlay = () => {
    if (currentIndex >= maxIndex && !playing) {
      // If at the end, restart
      setPlaybackState(prev => ({ ...prev, currentIndex: 0, playing: true }));
    } else {
      setPlaybackState(prev => ({ ...prev, playing: !prev.playing }));
    }
  };

  const handleStepForward = () => {
    setPlaybackState(prev => ({ ...prev, playing: false, currentIndex: Math.min(maxIndex, prev.currentIndex + 1) }));
  };

  const handleStepBack = () => {
    setPlaybackState(prev => ({ ...prev, playing: false, currentIndex: Math.max(0, prev.currentIndex - 1) }));
  };
  
  const handleReset = () => {
    setPlaybackState(prev => ({...prev, playing: false, currentIndex: 0}));
  };

  const handleSpeedChange = (value) => {
    setPlaybackState(prev => ({ ...prev, speed: value[0] }));
  };
  
  const handleSeek = (value) => {
    setPlaybackState(prev => ({ ...prev, playing: false, currentIndex: value[0] }));
  };

  return (
    <div className="flex flex-col gap-2 p-4 pt-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
            <Button onClick={handleReset} variant="ghost" size="icon" disabled={disabled} aria-label="Reset Playback">
                <RotateCcw className="h-5 w-5" />
            </Button>
            <Button onClick={handleStepBack} variant="ghost" size="icon" disabled={disabled || currentIndex <= 0} aria-label="Step Back">
                <StepBack className="h-5 w-5" />
            </Button>
            <Button onClick={togglePlay} variant="ghost" size="icon" disabled={disabled} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-6 w-6 text-accent" /> : <Play className="h-6 w-6 text-accent" />}
            </Button>
            <Button onClick={handleStepForward} variant="ghost" size="icon" disabled={disabled || currentIndex >= maxIndex} aria-label="Step Forward">
                <StepForward className="h-5 w-5" />
            </Button>
        </div>

        <div className="flex-1">
          <Slider
            value={[currentIndex]}
            onValueChange={handleSeek}
            max={maxIndex}
            step={1}
            disabled={disabled}
            aria-label="Seek playback position"
          />
          <div className="text-center text-xs text-muted-foreground mt-1">
            Candle {currentIndex + 1} of {maxIndex + 1}
          </div>
        </div>

        <div className="flex items-center gap-3 w-40">
          <FastForward className="h-5 w-5 text-muted-foreground" />
          <Slider
            value={[speed]}
            onValueChange={handleSpeedChange}
            min={0.5}
            max={10}
            step={0.5}
            disabled={disabled}
            aria-label={`Playback speed: ${speed}x`}
          />
           <Label className="w-12 text-sm text-muted-foreground">{speed.toFixed(1)}x</Label>
        </div>
      </div>
    </div>
  );
}
