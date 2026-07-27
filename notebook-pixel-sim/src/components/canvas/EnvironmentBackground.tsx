import { A } from '@/assets';

interface Props {
  /** "desk" is the canonical canvas background. */
  variant?: 'desk' | 'studio' | 'shelf';
}

export function EnvironmentBackground({ variant = 'desk' }: Props) {
  const src = variant === 'studio' ? A.env.studio : variant === 'shelf' ? A.env.shelf : A.env.desk;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        draggable={false}
      />
      {/* Soft warm vignette so the notebook hero pops, but bg stays readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 55%, rgba(255,236,180,0.18) 0%, rgba(255,236,180,0) 35%, rgba(20,12,5,0.18) 75%, rgba(20,12,5,0.32) 100%)',
        }}
      />
    </div>
  );
}
