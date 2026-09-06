Place a licensed Japanese TTF or OTF here as:

  NotoSansJP-Regular.ttf

Do not use .ttc. Then set Vercel PDF_FONT_PATH to the deployed file, for example:

  /var/task/fonts/NotoSansJP-Regular.ttf

If the file is present at apps/web/fonts/NotoSansJP-Regular.ttf, the PDF route also looks it up without env.
Do not commit an unlicensed font.
