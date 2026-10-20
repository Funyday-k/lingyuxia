/* Search full paper metadata and filter by publication source. */
(function () {
  'use strict';
  var root = document.querySelector('.paper-directory');
  if (!root) return;
  var panel = document.querySelector('.paper-filter-panel');
  var filters = panel.querySelector('.note-filters');
  var desktopHost = panel.parentElement;
  var mobileHost = root.querySelector('.paper-filter-mobile');
  var mobile = window.matchMedia('(max-width: 1023px)');
  function placeFilters() { (mobile.matches ? mobileHost : desktopHost).appendChild(panel); }
  placeFilters();
  mobile.addEventListener('change', placeFilters);
  var search = root.querySelector('#paper-search-input');
  var status = root.querySelector('.note-filter-status');
  var empty = root.querySelector('.note-empty');
  var selected = null;
  var buttons = [];
  var sources = [];
  function button(source, text, className) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = text;
    el.dataset.source = source || 'all';
    el.setAttribute('aria-pressed', 'false');
    el.addEventListener('click', function () { selected = source; applyFilters(); });
    buttons.push({ el: el, source: source });
    return el;
  }
  var entries = Array.from(root.querySelectorAll('.paper-card')).map(function (card) {
    var badge = card.querySelector('.paper-link-badge');
    var source = badge ? badge.textContent.trim() : 'Other';
    if (sources.indexOf(source) === -1) sources.push(source);
    if (badge) badge.replaceWith(button(source, source, badge.className));
    return { card: card, source: source, text: card.dataset.search.toLocaleLowerCase() };
  });
  filters.appendChild(button(null, 'Show all', 'note-label-button'));
  sources.sort().forEach(function (source) { filters.appendChild(button(source, source, 'note-label-button')); });
  function applyFilters() {
    var query = search.value.trim();
    var terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    entries.forEach(function (entry) {
      entry.card.hidden = !((selected === null || entry.source === selected) && terms.every(function (term) { return entry.text.indexOf(term) !== -1; }));
    });
    root.querySelectorAll('.paper-date-section').forEach(function (section) {
      section.hidden = !Array.from(section.querySelectorAll('.paper-card')).some(function (card) { return !card.hidden; });
    });
    buttons.forEach(function (b) { b.el.setAttribute('aria-pressed', String(b.source === selected)); });
    var count = entries.filter(function (entry) { return !entry.card.hidden; }).length;
    status.textContent = (selected || 'All sources') + (query ? ' · Search: ' + query : '') + ' · ' + count + (count === 1 ? ' paper' : ' papers');
    empty.hidden = count !== 0;
  }
  search.addEventListener('input', applyFilters);
  root.querySelector('.note-search').hidden = false;
  panel.hidden = false;
  status.hidden = false;
  applyFilters();
}());
