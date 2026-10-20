/* Enhance the static directory with exact, single-label filtering. */
(function () {
  'use strict';
  var root = document.querySelector('.note-index');
  if (!root) return;
  var filters = root.querySelector('.note-filters');
  var status = root.querySelector('.note-filter-status');
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
    return { card: card, labels: cardLabels };
  });
  var allButton = makeButton(null, '显示全部');
  filters.appendChild(allButton);
  labels.forEach(function (label) { filters.appendChild(makeButton(label, label)); });

  function selectLabel(label) {
    entries.forEach(function (entry) {
      entry.card.hidden = label !== null && entry.labels.indexOf(label) === -1;
    });
    root.querySelectorAll('section').forEach(function (section) {
      var visible = Array.from(section.querySelectorAll('.note-card')).filter(function (card) { return !card.hidden; }).length;
      section.hidden = visible === 0;
      var count = section.querySelector('[data-note-count]');
      count.textContent = visible + ' ' + count.dataset.unit;
    });
    buttons.forEach(function (button) {
      button.element.setAttribute('aria-pressed', String(button.label === label));
    });
    var visibleCount = cards.filter(function (card) { return !card.hidden; }).length;
    status.textContent = label === null ? '显示全部 · ' + visibleCount + ' 项' : label + ' · ' + visibleCount + ' 项';
  }

  filters.hidden = false;
  status.hidden = false;
  root.classList.add('note-filter-ready');
  selectLabel(null);
}());
