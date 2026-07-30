import clsx from 'clsx';
import { A } from '@/assets';
import type { MascotMood } from '@/types';

interface Props {
  mood?: MascotMood;
  size?: number;
  className?: string;
  pose?: 'idle' | 'pointLeft' | 'pointRight' | 'present' | 'wave';
  animate?: boolean;
}

export const moodSrc: Record<MascotMood, string> = {
  neutral: A.mascot.expressions.neutral,
  happy: A.mascot.expressions.happy,
  happy_soft: A.mascot.expressions.happy_soft,
  excited: A.mascot.expressions.excited,
  excited_big: A.mascot.expressions.excited_big,
  thinking: A.mascot.expressions.thinking,
  thinking_side: A.mascot.expressions.thinking_side,
  concerned: A.mascot.expressions.concerned,
  concerned_soft: A.mascot.expressions.concerned_soft,
  confused: A.mascot.expressions.confused,
  confused_tilt: A.mascot.expressions.confused_tilt,
  warning: A.mascot.expressions.warning,
  warning_alert: A.mascot.expressions.warning_alert,
  pointing_left: A.mascot.poses.pointing_left,
  pointing_right: A.mascot.poses.pointing_right,
  pointing_left_explain: A.mascot.poses.pointing_left_explain,
  pointing_right_explain: A.mascot.poses.pointing_right_explain,
  presenting: A.mascot.poses.presenting,
  presenting_open_hand: A.mascot.poses.presenting_open_hand,
  idle: A.mascot.base.idle,
  idle_soft_wave: A.mascot.poses.idle_soft_wave,
};

export function MascotSprite({ mood = 'idle', size = 96, className, pose, animate = true }: Props) {
  let src = moodSrc[mood];
  if (pose === 'pointLeft') src = A.mascot.poses.pointing_left;
  if (pose === 'pointRight') src = A.mascot.poses.pointing_right;
  if (pose === 'present') src = A.mascot.poses.presenting;
  if (pose === 'wave') src = A.mascot.poses.idle_soft_wave;
  return (
    <img
      src={src}
      alt="mascot"
      draggable={false}
      style={{ width: size, height: size }}
      className={clsx('object-contain pointer-events-none', animate && 'animate-floatY', className)}
    />
  );
}
