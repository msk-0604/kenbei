NotoSansJP-Regular.ttf (SIL Open Font License) used for PDF output.

It is the Noto Sans JP variable font instanced at weight 400 and trimmed to
JIS X 0208 (levels 1 and 2) plus ASCII, half-width kana and common symbols
with fontTools, so PDFs stay around 1-2 MB:

  fonttools varLib.instancer NotoSansJP[wght].ttf wght=400 --static -o static.ttf
  pyftsubset static.ttf --text-file=chars.txt --layout-features='kern,liga,locl' \
    --no-hinting --desubroutinize --drop-tables+=GSUB -o NotoSansJP-Regular.ttf

pdf-lib's own subsetting drops CJK glyphs, so the font is embedded whole.
Do not use .ttc. Do not commit an unlicensed font.
