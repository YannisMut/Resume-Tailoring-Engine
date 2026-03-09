export const metadata = {
  title: 'Resume Tailoring Engine',
  description: 'AI-powered resume tailoring — upload, tailor, download.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
