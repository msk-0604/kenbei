/** Must stay project-relative. Absolute paths are joined onto the app root on Vercel and ENOENT. */
export const pdfFontTraceIncludes = ["./fonts/NotoSansJP-Regular.ttf", "./fonts/**"] as const;
