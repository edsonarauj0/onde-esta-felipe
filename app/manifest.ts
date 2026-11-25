import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Onde está o Felipe?',
    short_name: 'Onde Felipe',
    description: 'Acompanhe os voos, pernoites e folgas do Felipe em tempo real.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0284c7',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
