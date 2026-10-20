---
layout: archive
title: "Daily Paper"
permalink: /daily-paper/
author_profile: true
paper_filters: true
---

<link rel="stylesheet" href="{{ '/assets/css/note-index.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
.paper-date-section {
  margin-bottom: 2em;
}
.paper-date-section h2 {
  border-bottom: 2px solid #494e52;
  padding-bottom: 0.3em;
  margin-bottom: 0.5em;
  font-size: 1.3em;
}
.paper-date-comment {
  color: #6c757d;
  font-style: italic;
  margin-bottom: 1em;
}
.paper-card {
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 1em 1.2em;
  margin-bottom: 1em;
  background: #fffdf4;
  transition: box-shadow 0.2s;
}
.paper-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.paper-title {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0 0 0.4em 0;
}
.paper-title a {
  color: #24292e;
  text-decoration: none;
}
.paper-title a:hover {
  color: #436970;
  text-decoration: underline;
}
.paper-authors {
  color: #586069;
  font-size: 0.92em;
  margin-bottom: 0.3em;
}
.paper-affiliations {
  color: #6a737d;
  font-size: 0.85em;
  font-style: italic;
  margin-bottom: 0.5em;
}
.paper-abstract-toggle {
  cursor: pointer;
  color: #436970;
  font-size: 0.9em;
  user-select: none;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
}
.paper-abstract-toggle:hover {
  text-decoration: underline;
}
.paper-abstract {
  display: none;
  margin-top: 0.5em;
  padding: 0.8em;
  background: #f1f3f5;
  border-radius: 4px;
  font-size: 0.9em;
  line-height: 1.6;
  color: #333;
}
.paper-abstract.show {
  display: block;
}
.paper-authors-collapsed .authors-extra {
  display: none;
}
.paper-authors-collapsed .authors-extra.show {
  display: inline;
}
.authors-toggle {
  cursor: pointer;
  color: #436970;
  font-size: 0.85em;
  background: none;
  border: none;
  padding: 0 0.2em;
  font-family: inherit;
  vertical-align: middle;
}
.authors-toggle:hover {
  text-decoration: underline;
}
.paper-comment {
  color: #786044;
  font-size: 0.9em;
  margin-top: 0.4em;
  margin-bottom: 0.2em;
  padding: 0.3em 0.6em;
  background: #fff4cc;
  border-left: 3px solid #d6c17c;
  border-radius: 5px;
}
.paper-link-badge {
  display: inline-block;
  font-size: 0.78em;
  padding: 0.25em 0.65em;
  border-radius: 5px;
  color: var(--badge-fg);
  border: 1px solid transparent;
  margin-left: 0.5em;
  vertical-align: middle;
  text-decoration: none;
  font-weight: 600;
}
.badge-arxiv  { background: #f6e3e3; --badge-fg: #80565c; }
.badge-aps    { background: #e3edf8; --badge-fg: #4b607a; }
.badge-nature { background: #e6efeb; --badge-fg: #3e6153; }
.badge-iop    { background: #eee8f1; --badge-fg: #6b5278; }
.badge-doi    { background: #edf0f2; --badge-fg: #4b5962; }
.paper-link-badge:hover { border-color: var(--badge-fg); color: var(--badge-fg); }
.paper-link-badge:focus-visible { outline: 2px solid var(--badge-fg); outline-offset: 3px; }
.no-papers-msg {
  color: #6c757d;
  font-style: italic;
}
.paper-title .paper-link-badge { color:var(--badge-fg); }
.paper-link-badge { font-family:inherit; cursor:pointer; }
.paper-link-badge[aria-pressed="true"] { border-color:var(--badge-fg); }
.paper-directory [hidden] { display:none !important; }
.note-index [data-source="arXiv"] { --label-bg:#f6e3e3; --label-fg:#80565c; }
.note-index [data-source="APS"] { --label-bg:#e3edf8; --label-fg:#4b607a; }
.note-index [data-source="Nature"] { --label-bg:#e6efeb; --label-fg:#3e6153; }
.note-index [data-source="IOP"] { --label-bg:#eee8f1; --label-fg:#6b5278; }
</style>

{% include base_path %}

<p style="color:#586069; margin-bottom:1.5em;">
  📖 My Daily Paper Picks. Click title to visit paper website, click "Abstract" to expand abstract.
</p>

<div class="paper-directory">
<div class="note-index paper-controls">
  <div class="note-search" hidden>
    <label for="paper-search-input">Search papers</label>
    <input id="paper-search-input" type="search" placeholder="Search titles, authors, abstracts, or comments…" autocomplete="off">
  </div>
  <div class="paper-filter-mobile"></div>
  <p class="note-filter-status" role="status" aria-live="polite" hidden></p>
  <p class="note-empty" hidden>No matching papers. Try another search or source.</p>
</div>
{% assign sorted_entries = site.data.daily_papers | sort: "date" | reverse %}

{% for entry in sorted_entries %}
<div class="paper-date-section">
  <h2>📅 {{ entry.date }}</h2>
  {% if entry.comment %}
    <p class="paper-date-comment">{{ entry.comment }}</p>
  {% endif %}

  {% for paper in entry.papers %}
  <div class="paper-card" data-search="{{ paper.title | escape }} {{ paper.authors | escape }} {{ paper.abstract | escape }} {{ paper.comment | escape }}">
    {% if paper.title %}
      <p class="paper-title">
        <a href="{{ paper.link }}" target="_blank" rel="noopener noreferrer">{{ paper.title }}</a>
        {% if paper.link contains 'arxiv.org' %}
          <a href="{{ paper.link }}" class="paper-link-badge badge-arxiv" target="_blank" rel="noopener">arXiv</a>
        {% elsif paper.link contains 'link.aps.org' or paper.link contains 'journals.aps.org' %}
          <a href="{{ paper.link }}" class="paper-link-badge badge-aps" target="_blank" rel="noopener">APS</a>
        {% elsif paper.link contains 'nature.com' %}
          <a href="{{ paper.link }}" class="paper-link-badge badge-nature" target="_blank" rel="noopener">Nature</a>
        {% elsif paper.link contains 'iopscience.iop.org' or paper.link contains 'iopp.org' %}
          <a href="{{ paper.link }}" class="paper-link-badge badge-iop" target="_blank" rel="noopener">IOP</a>
        {% elsif paper.link contains 'doi.org' %}
          <a href="{{ paper.link }}" class="paper-link-badge badge-doi" target="_blank" rel="noopener">DOI</a>
        {% endif %}
      </p>
      {% if paper.authors and paper.authors != "" %}
        <p class="paper-authors" data-authors="{{ paper.authors | escape }}">👤 <span class="authors-text">{{ paper.authors }}</span></p>
      {% endif %}
      {% if paper.affiliations and paper.affiliations != "" %}
        <p class="paper-affiliations">🏛 {{ paper.affiliations }}</p>
      {% endif %}
      {% if paper.abstract and paper.abstract != "" %}
        <button class="paper-abstract-toggle" onclick="this.nextElementSibling.classList.toggle('show'); this.textContent = this.nextElementSibling.classList.contains('show') ? '▼ Hide Abstract' : '▶ Abstract';">▶ Abstract</button>
        <div class="paper-abstract">{{ paper.abstract }}</div>
      {% endif %}
      {% if paper.comment %}
        <p class="paper-comment">💬 {{ paper.comment }}</p>
      {% endif %}
    {% else %}
      <p class="paper-title">
        <a href="{{ paper.link }}" target="_blank" rel="noopener noreferrer">{{ paper.link }}</a>
        <span style="color:#d73a49; font-size:0.85em;">（元数据待获取，请运行 fetch_papers.py）</span>
      </p>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endfor %}

{% if site.data.daily_papers.size == 0 %}
  <p class="no-papers-msg">暂无论文分享，敬请期待！</p>
{% endif %}

</div>
<script defer src="{{ '/assets/js/paper-index.js' | relative_url }}?v={{ site.time | date: '%s' }}"></script>
<script>
(function () {
  const THRESHOLD = 10;
  document.querySelectorAll('.paper-authors').forEach(function (el) {
    var raw = el.getAttribute('data-authors') || '';
    var parts = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length <= THRESHOLD) return;

    var visible = parts.slice(0, THRESHOLD);
    var hidden  = parts.slice(THRESHOLD);

    var span = el.querySelector('.authors-text');
    span.innerHTML =
      visible.join(', ') +
      ', <span class="authors-extra">' + hidden.join(', ') + '</span>' +
      ' <button class="authors-toggle" aria-expanded="false">+' + hidden.length + ' more</button>';

    el.classList.add('paper-authors-collapsed');

    span.querySelector('.authors-toggle').addEventListener('click', function () {
      var extraEl  = span.querySelector('.authors-extra');
      var expanded = extraEl.classList.toggle('show');
      this.textContent = expanded ? '− less' : '+' + hidden.length + ' more';
      this.setAttribute('aria-expanded', expanded);
    });
  });
})();
</script>
