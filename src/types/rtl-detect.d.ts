declare module "rtl-detect" {
  const rtlDetect: {
    isRtlLang(locale: string): boolean | undefined;
    getLangDir(locale: string): "rtl" | "ltr";
  };

  export default rtlDetect;
}
