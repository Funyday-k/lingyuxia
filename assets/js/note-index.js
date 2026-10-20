/* Enhance the static directory with combined text search and single-label filtering. */
(function () {
  'use strict';
  var root = document.querySelector('.note-index');
  if (!root) return;
  var filters = root.querySelector('.note-filters');
  var status = root.querySelector('.note-filter-status');
  var search = root.querySelector('#note-search-input');
  var empty = root.querySelector('.note-empty');
  var selectedLabel = null;
  var cards = Array.from(root.querySelectorAll('.note-card'));
  var labels = [];
  var buttons = [];

  function makeButton(label, text) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-label-button';
    button.textContent = text;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () { selectLabel(label); });
    buttons.push({ element: button, label: label });
    return button;
  }

  var entries = cards.map(function (card) {
    var cardLabels = Array.from(card.querySelectorAll('.note-labels li')).map(function (item) {
      var label = item.textContent.trim();
      if (labels.indexOf(label) === -1) labels.push(label);
      item.textContent = '';
      item.appendChild(makeButton(label, label));
      return label;
    });
    return { card: card, labels: cardLabels, text: [card.querySelector('h3').textContent, card.querySelector('.note-description').textContent, cardLabels.join(' ')].join(' ').toLocaleLowerCase() };
  });
  var allButton = makeButton(null, '显示全部');
  filters.appendChild(allButton);
  labels.forEach(function (label) { filters.appendChild(makeButton(label, label)); });

  function selectLabel(label) {
    selectedLabel = label;
    applyFilters();
  }

  function applyFilters() {
    var query = search.value.trim().toLocaleLowerCase();
    var terms = query.split(/\s+/).filter(Boolean);
    entries.forEach(function (entry) {
      var matchesLabel = selectedLabel === null || entry.labels.indexOf(selectedLabel) !== -1;
      var matchesText = terms.every(function (term) { return entry.text.indexOf(term) !== -1; });
      entry.card.hidden = !(matchesLabel && matchesText);
    });
    root.querySelectorAll('section').forEach(function (section) {
      var visible = Array.from(section.querySelectorAll('.note-card')).filter(function (card) { return !card.hidden; }).length;
      section.hidden = visible === 0;
      var count = section.querySelector('[data-note-count]');
      count.textContent = visible + ' ' + count.dataset.unit;
    });
    buttons.forEach(function (button) {
      button.element.setAttribute('aria-pressed', String(button.label === selectedLabel));
    });
    var visibleCount = cards.filter(function (card) { return !card.hidden; }).length;
    status.textContent = (selectedLabel === null ? '全部标签' : selectedLabel) + (query ? ' · 搜索：' + search.value.trim() : '') + ' · ' + visibleCount + ' 项';
    empty.hidden = visibleCount !== 0;
  }

  search.addEventListener('input', applyFilters);
  root.querySelector('.note-search').hidden = false;
  filters.hidden = false;
  status.hidden = false;
  root.classList.add('note-filter-ready');
  selectLabel(null);
}());
