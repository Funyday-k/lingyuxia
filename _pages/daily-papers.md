---
layout: archive
title: "Daily Paper"
permalink: /daily-paper/
author_profile: true
---

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
  background: #fafbfc;
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
  color: #0366d6;
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
  color: #0366d6;
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
  color: #0366d6;
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
  color: #e36209;
  font-size: 0.9em;
  margin-top: 0.4em;
  margin-bottom: 0.2em;
  padding: 0.3em 0.6em;
  background: #fff8e1;
  border-left: 3px solid #f9a825;
  border-radius: 3px;
}
.paper-link-badge {
  display: inline-block;
  font-size: 0.78em;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  color: #fff;
  margin-left: 0.5em;
  vertical-align: middle;
  text-decoration: none;
  font-weight: 600;
}
.badge-arxiv  { background: #b31b1b; }
.badge-aps    { background: #1560bd; }
.badge-nature { background: #1a6e3a; }
.badge-iop    { background: #7b2d8b; }
.badge-doi    { background: #555; }
.paper-link-badge:hover { opacity: 0.85; color: #fff; }
.no-papers-msg {
  color: #6c757d;
  font-style: italic;
}
</style>

{% include base_path %}

<p style="color:#586069; margin-bottom:1.5em;">
  📖 My Daily Paper Picks. Click title to visit paper website, click "Abstract" to expand abstract.
</p>

{% assign sorted_entries = site.data.daily_papers | sort: "date" | reverse %}

{% for entry in sorted_entries %}
<div class="paper-date-section">
  <h2>📅 {{ entry.date }}</h2>
  {% if entry.comment %}
    <p class="paper-date-comment">{{ entry.comment }}</p>
  {% endif %}

  {% for paper in entry.papers %}
  <div class="paper-card">
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
