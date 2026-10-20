/* Enhance the static directory with combined text search and multi-label intersection filtering. */
(function () {
  'use strict';
  var root = document.querySelector('.note-index-main');
  if (!root) return;
  var panel = document.querySelector('.note-filter-panel');
  var filters = panel.querySelector('.note-filters');
  var desktopHost = panel.parentElement;
  var mobileHost = root.querySelector('.note-filter-mobile');
  var mobile = window.matchMedia('(max-width: 1023px)');
  function placeFilters() { (mobile.matches ? mobileHost : desktopHost).appendChild(panel); }
  placeFilters();
  mobile.addEventListener('change', placeFilters);
  var status = root.querySelector('.note-filter-status');
  var search = root.querySelector('#note-search-input');
  var empty = root.querySelector('.note-empty');
  var selectedLabels = new Set();
  var cards = Array.from(root.querySelectorAll('.note-card'));
  var labels = ['interactive', 'note', 'thesis', 'General Relativity', 'Astrophysics', 'Statistical Physics'];
  var buttons = [];

  function makeButton(label, text) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-label-button';
    button.textContent = text;
    button.dataset.label = label === null ? 'all' : label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () { selectLabel(label); });
    buttons.push({ element: button, label: label });
    return button;
  }

  var entries = cards.map(function (card) {
    var cardLabels = Array.from(card.querySelectorAll('.note-labels li')).map(function (item) {
      var label = item.textContent.trim();
      item.textContent = '';
      item.appendChild(makeButton(label, label));
      return label;
    });
    return { card: card, labels: cardLabels, text: [card.querySelector('h3').textContent, card.querySelector('.note-description').textContent, cardLabels.join(' ')].join(' ').toLocaleLowerCase() };
  });
  var allButton = makeButton(null, 'Show all');
  filters.appendChild(allButton);
  labels.forEach(function (label) { filters.appendChild(makeButton(label, label)); });

  function selectLabel(label) {
    if (label === null) selectedLabels.clear();
    else if (selectedLabels.has(label)) selectedLabels.delete(label);
    else selectedLabels.add(label);
    applyFilters();
  }

  function applyFilters() {
    var query = search.value.trim().toLocaleLowerCase();
    var terms = query.split(/\s+/).filter(Boolean);
    entries.forEach(function (entry) {
      var matchesLabel = Array.from(selectedLabels).every(function (label) { return entry.labels.indexOf(label) !== -1; });
      var matchesText = terms.every(function (term) { return entry.text.indexOf(term) !== -1; });
      entry.card.hidden = !(matchesLabel && matchesText);
    });
    root.querySelectorAll('section').forEach(function (section) {
      var visible = Array.from(section.querySelectorAll('.note-card')).filter(function (card) { return !card.hidden; }).length;
      section.hidden = visible === 0;
      var count = section.querySelector('[data-note-count]');
      count.textContent = visible + ' ' + (visible === 1 ? count.dataset.singular : count.dataset.unit);
    });
    buttons.forEach(function (button) {
      button.element.setAttribute('aria-pressed', String(button.label === null ? selectedLabels.size === 0 : selectedLabels.has(button.label)));
    });
    var visibleCount = cards.filter(function (card) { return !card.hidden; }).length;
    status.textContent = (selectedLabels.size === 0 ? 'All labels' : Array.from(selectedLabels).join(' + ')) + (query ? ' · Search: ' + search.value.trim() : '') + ' · ' + visibleCount + (visibleCount === 1 ? ' result' : ' results');
    empty.hidden = visibleCount !== 0;
  }

  search.addEventListener('input', applyFilters);
  root.querySelector('.note-search').hidden = false;
  panel.hidden = false;
  panel.classList.add('note-filter-ready');
  filters.hidden = false;
  status.hidden = false;
  root.classList.add('note-filter-ready');
  selectLabel(null);
}());
