export const KENBEI_SUPPORT_EMAIL = "support@kenbei.jp";
export const KENBEI_SUPPORT_MAILTO = `mailto:${KENBEI_SUPPORT_EMAIL}`;
/** Public operator label used on the site. Corporate registry name is not in this repo. */
export const KENBEI_OPERATOR_NAME = "Stark Lab（スタークラボ）";
export const KENBEI_OPERATOR_URL = "https://starklab.jp";

/**
 * 特定商取引法に基づく表記. Fill in the registered name, address and phone
 * before relying on the "on request" wording below.
 */
export const KENBEI_LEGAL = {
  seller: KENBEI_OPERATOR_NAME,
  representative: "請求があった場合には遅滞なく開示いたします",
  address: "請求があった場合には遅滞なく開示いたします",
  phone: "請求があった場合には遅滞なく開示いたします",
} as const;
