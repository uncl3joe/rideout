/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Screenshots werden (verkleinert) an eine Server-Action geschickt.
    serverActions: { bodySizeLimit: '6mb' },
  },
};
export default nextConfig;
