/* Apply the saved appearance before first paint (same key and rules as src/lib/theme.ts). A file, not an inline
   script, because the production CSP only allows scripts from this origin. */
(function () {
  var pref = 'system';
  try {
    var v = JSON.parse(localStorage.getItem('avora.theme'));
    if (v === 'light' || v === 'dark') pref = v;
  } catch (e) {}
  var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // saved language: sets lang and text direction before first paint (same key as src/lib/i18n)
  try {
    var lang = JSON.parse(localStorage.getItem('avora.lang'));
    if (lang === 'so' || lang === 'ar') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  } catch (e) {}
})();
