import { Head, Html, Main, NextScript } from "next/document";

const SITE_URL = "https://portal.medicodiabetes.com";
const OG_IMAGE_URL = `${SITE_URL}/og-image.webp`;
const OG_TITLE = "Portal del Paciente - Dr. David Guzman";
const OG_DESCRIPTION = "Acceso seguro a su información médica y tratamiento";

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0ea5a4" />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
