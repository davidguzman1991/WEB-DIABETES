import { Head, Html, Main, NextScript } from "next/document";

const SITE_URL = "https://web-diabetes-production.up.railway.app";
const OG_IMAGE_URL = `${SITE_URL}/og-image.webp`;
const OG_TITLE = "Portal del Paciente - Dr. David Guzman";
const OG_DESCRIPTION = "Acceso seguro a su informacion medica y tratamiento";

export default function Document() {
  return (
    <Html lang="es">
      <Head>
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
