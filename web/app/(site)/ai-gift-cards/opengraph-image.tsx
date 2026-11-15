import { ImageResponse } from 'next/og';

export const alt =
  'Giftly — AI gift card shopping in Qatar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fff8ec',
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #1c1c1c',
              borderRadius: 18,
              background: '#72c2b8',
              fontSize: 34,
              fontWeight: 800,
              color: '#1c1c1c',
            }}
          >
            G
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#1c1c1c' }}>
            Giftly
          </div>
          <div
            style={{
              marginLeft: 'auto',
              padding: '10px 18px',
              border: '3px solid #1c1c1c',
              borderRadius: 999,
              background: '#fff4d6',
              fontSize: 20,
              fontWeight: 700,
              color: '#1c1c1c',
            }}
          >
            AI gift card shopping · Qatar
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              maxWidth: 940,
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.04,
              color: '#1c1c1c',
            }}
          >
            AI gift card shopping in Qatar
          </div>
          <div style={{ fontSize: 28, color: '#4b4b4b' }}>
            Discover local businesses, compare gift cards and prepare an order
            through MCP-compatible assistants.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {['Local businesses', 'Gift cards', 'Experiences'].map((name) => (
            <div
              key={name}
              style={{
                padding: '12px 20px',
                border: '3px solid #1c1c1c',
                borderRadius: 999,
                background: '#cdb8f2',
                fontSize: 21,
                fontWeight: 700,
                color: '#1c1c1c',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
