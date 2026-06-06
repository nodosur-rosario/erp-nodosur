import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'ERP Nodo Sur - Sistema de Gestión Comercial';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #05070D 0%, #091827 80%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#F8FBFF', // Soft White
          position: 'relative',
        }}
      >
        {/* Background Decorative Tech Elements */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0, 216, 255, 0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(45, 246, 224, 0.1) 0%, transparent 70%)', borderRadius: '50%' }} />

        {/* Main Content Glassmorphism Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(9, 24, 39, 0.6)', // Midnight Blue with opacity
            border: '2px solid rgba(0, 216, 255, 0.2)', // Electric Cyan border
            borderRadius: '32px',
            padding: '70px 100px',
            boxShadow: '0 40px 80px rgba(5, 7, 13, 0.8)', // Deep Space shadow
          }}
        >
          {/* Nodo Sur Logo Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px' }}>
            <svg width="80" height="80" viewBox="0 0 512 512" fill="none">
              <path d="M256 140 L160 240 M256 140 L352 240 M160 240 L256 360 M352 240 L256 360" stroke="#00D8FF" strokeWidth="24" strokeLinecap="round"/>
              <circle cx="256" cy="140" r="36" fill="#00D8FF"/>
              <circle cx="160" cy="240" r="36" fill="#00D8FF"/>
              <circle cx="352" cy="240" r="36" fill="#00D8FF"/>
              <circle cx="256" cy="360" r="56" fill="#2DF6E0"/> 
            </svg>
            <span style={{ fontSize: '80px', fontWeight: '800', letterSpacing: '-0.05em' }}>nodosur</span>
          </div>

          <h1
            style={{
              fontSize: '56px',
              fontWeight: '700',
              textAlign: 'center',
              margin: '0 0 24px 0',
              letterSpacing: '-0.02em',
              color: '#00D8FF', // Electric Cyan
            }}
          >
            ERP • Gestión Comercial
          </h1>

          <p
            style={{
              fontSize: '32px',
              color: '#B9C5D1', // Silver Gray
              textAlign: 'center',
              margin: 0,
              maxWidth: '850px',
              lineHeight: 1.4,
            }}
          >
            Hacemos que la tecnología trabaje para vos. Menos tareas repetitivas, más control y rentabilidad para tu negocio.
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
