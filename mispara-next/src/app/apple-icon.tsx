import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#09090b',
          border: '8px solid #f59e0b',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 96,
          color: '#f59e0b',
        }}
      >
        ✂
      </div>
    ),
    { ...size }
  );
}