/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      // Methodology moved onto the homepage as a collapsible section.
      { source: "/methodology", destination: "/#methodology", permanent: true },
      // V1 pages; V1 is archived at the v1-final tag.
      { source: "/module/:id", destination: "/", permanent: true },
      { source: "/run", destination: "/", permanent: true },
    ]
  },
}

export default nextConfig
