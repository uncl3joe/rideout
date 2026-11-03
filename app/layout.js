import './globals.css';

export const metadata = {
  title: 'Ride Out Customs – Werkstatt-Terminal',
  description: 'Internes Werkstatt-Terminal für Ride Out Customs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
