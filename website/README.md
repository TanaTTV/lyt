# lyt product site

A dependency-free static site built with Node 20. It produces search-friendly
HTML, canonical URLs, Open Graph metadata, JSON-LD, `robots.txt`, and a sitemap.

## Build

```powershell
npm run build
```

The default canonical URL is `https://tanattv.github.io/lyt`. Set the final URL
before publishing somewhere else:

```powershell
$env:SITE_URL = "https://example.com"
npm run build
```

## Preview

```powershell
npm run serve
```

Open <http://localhost:4173>.

## Publish checklist

- choose and verify the final HTTPS URL;
- rebuild with `SITE_URL` set to that URL;
- inspect every canonical and social-preview URL;
- publish `dist/`;
- connect the URL to GitHub and npm metadata;
- submit `sitemap.xml` through Google Search Console.
