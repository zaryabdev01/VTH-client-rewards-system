/** @type {import('next').NextConfig} */
const embed = (process.env.EMBED_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default {
  distDir: process.env.NEXT_DIST || ".next",
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bcryptjs", "nodemailer"],
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      // Staff portal & APIs can never be framed.
      { source: "/staff/:path*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      // The public spin experience may be embedded on the VTH website (list its origins in EMBED_ALLOWED_ORIGINS).
      { source: "/((?!staff).*)", headers: [...base, { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${embed.join(" ")}`.trim() }] },
    ];
  },
};
