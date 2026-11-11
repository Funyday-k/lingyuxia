/* Preserve the root-array YAML used by the public site and paper tools. */
window.registerSiteListFormat = function (CMS, yaml) {
  'use strict';
  CMS.registerCustomFormat('yaml-list', 'yml', {
    fromFile: function (text) {
      const items = yaml.load(text, { schema: yaml.JSON_SCHEMA });
      if (!Array.isArray(items)) throw new Error('Expected a YAML list; refusing to replace existing content.');
      return { items: items };
    },
    toFile: function (data) {
      if (!data || !Array.isArray(data.items)) throw new Error('Missing list; refusing to save.');
      return yaml.dump(data.items, { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: 100 });
    }
  });
};
