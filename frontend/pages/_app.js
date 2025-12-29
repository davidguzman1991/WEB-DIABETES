import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta
          property="og:title"
          content="Portal del Paciente – Dr. David Guzmán"
        />
        <meta
          property="og:description"
          content="Acceso seguro a su información médica y tratamiento"
        />
        <meta
          property="og:image"
          content="https://web-diabetes-production.up.railway.app/og-image.jpg"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://web-diabetes-production.up.railway.app/"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Portal del Paciente – Dr. David Guzmán"
        />
        <meta
          name="twitter:description"
          content="Acceso seguro a su información médica y tratamiento"
        />
        <meta
          name="twitter:image"
          content="https://web-diabetes-production.up.railway.app/og-image.jpg"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
