---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
placeholder_image: /lingyuxia/images/pub_note.jpg
---

{% if author.googlescholar %}
  You can also find my articles on <u><a href="{{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% include base_path %}

{{ page.intro | markdownify }}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}

{% if page.placeholder_image and page.placeholder_image != "" %}
<img src="{{ page.placeholder_image | escape }}" alt="Publications illustration">
{% endif %}
