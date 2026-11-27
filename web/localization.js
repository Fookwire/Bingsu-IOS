/* Translate only source-authored constants, before inserting user content. */
(function () {
  function text(value) {
    const copy = String(value == null ? "" : value);
    const literals = (window.BINGSU_LOCALIZATION || {}).literals || {};
    const key = copy.trim();
    return Object.prototype.hasOwnProperty.call(literals, key)
      ? copy.replace(key, literals[key]) : copy;
  }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }
  window.bingsuText = text;
  window.bingsuTemplate = function (source) {
    return String(source).replace(/(^|>)([^<>]+)(?=<|$)/g, (match, prefix, value) => {
      const translated = text(value);
      return translated === value ? match : prefix + escape(translated);
    }).replace(/\b(title|placeholder|aria-label)=("|')([\s\S]*?)\2/g,
      (match, name, quote, value) => {
        const translated = text(value);
        return translated === value ? match : name + "=" + quote + escape(translated) + quote;
      });
  };
})();
