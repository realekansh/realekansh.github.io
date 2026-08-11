<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html lang="en" data-theme="dark">
      <head>
        <meta charset="UTF-8" />
        <title><xsl:value-of select="rss/channel/title"/> &mdash; RSS Feed</title>
        <link rel="stylesheet" href="/style/base.css" />
        <link rel="stylesheet" href="/style/themes.css" />
        <link rel="stylesheet" href="/style/layout.css" />
        <link rel="stylesheet" href="/style/components.css" />
      </head>
      <body style="background: #0b0f14; color: #f8fafc; font-family: system-ui, sans-serif; padding-block: 40px;">
        <div class="container" style="max-width: 800px; margin-inline: auto;">
          
          <div class="aside-card" style="padding: 32px; margin-bottom: 32px; text-align: center; border-color: rgba(56, 189, 248, 0.3);">
            <p style="font-size: var(--fz-xs); font-weight: bold; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; margin-bottom: 8px;">RSS 2.0 Feed</p>
            <h1 style="font-size: 2rem; margin-bottom: 12px;"><xsl:value-of select="rss/channel/title"/></h1>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;"><xsl:value-of select="rss/channel/description"/></p>
            <a class="button button-primary button-small" href="/blogs/" style="display: inline-flex; align-items: center; gap: 6px;">
              <span>&larr; Return to Blog</span>
            </a>
          </div>

          <h2 style="font-size: 1.2rem; margin-bottom: 20px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Subscribed Feed Items</h2>

          <div style="display: flex; flex-direction: column; gap: 20px;">
            <xsl:for-each select="rss/channel/item">
              <article class="aside-card" style="padding: 24px;">
                <h3 style="font-size: 1.3rem; margin-bottom: 8px;">
                  <a style="color: var(--text); text-decoration: none;" target="_blank">
                    <xsl:attribute name="href">
                      <xsl:value-of select="link"/>
                    </xsl:attribute>
                    <xsl:value-of select="title"/>
                  </a>
                </h3>
                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 14px;">
                  <xsl:value-of select="description"/>
                </p>
                <div style="font-size: var(--fz-xs); color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px;">
                  <span>Published: <xsl:value-of select="pubDate"/></span>
                  <a class="button button-outline button-small" target="_blank">
                    <xsl:attribute name="href">
                      <xsl:value-of select="link"/>
                    </xsl:attribute>
                    Read Blog &rarr;
                  </a>
                </div>
              </article>
            </xsl:for-each>
          </div>

        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
