#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_papers.py - 自动获取 arxiv / DOI 论文元数据
用法: python scripts/fetch_papers.py
"""

import re
import sys
import time
import urllib.request
import urllib.error
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

DATA_FILE = Path(__file__).resolve().parent.parent / "_data" / "daily_papers.yml"

# ── arxiv API ────────────────────────────────────────────────

ARXIV_ID_RE = re.compile(r"arxiv\.org/(?:abs|pdf)/([0-9]+\.[0-9]+(?:v\d+)?)", re.I)
ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"


def extract_arxiv_id(url: str) -> str | None:
    m = ARXIV_ID_RE.search(url)
    return m.group(1) if m else None


def fetch_arxiv(arxiv_id: str) -> dict | None:
    api_url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
    try:
        req = urllib.request.Request(api_url, headers={"User-Agent": "DailyPaperBot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
    except urllib.error.URLError as e:
        print(f"  [ERROR] arxiv request failed for {arxiv_id}: {e}")
        return None

    root = ET.fromstring(data)
    entry = root.find(f"{ATOM_NS}entry")
    if entry is None:
        return None

    # 检查是否返回了有效条目（arxiv API 对无效 ID 也返回 entry）
    id_elem = entry.find(f"{ATOM_NS}id")
    if id_elem is None or "api/errors" in (id_elem.text or ""):
        return None

    title = entry.findtext(f"{ATOM_NS}title", "").strip().replace("\n", " ")
    title = re.sub(r"\s+", " ", title)

    abstract = entry.findtext(f"{ATOM_NS}summary", "").strip().replace("\n", " ")
    abstract = re.sub(r"\s+", " ", abstract)

    authors = []
    affiliations = []
    for author_el in entry.findall(f"{ATOM_NS}author"):
        name = author_el.findtext(f"{ATOM_NS}name", "").strip()
        if name:
            authors.append(name)
        for aff_el in author_el.findall(f"{ARXIV_NS}affiliation"):
            aff = aff_el.text.strip() if aff_el.text else ""
            if aff and aff not in affiliations:
                affiliations.append(aff)

    return {
        "title": title,
        "authors": ", ".join(authors),
        "affiliations": "; ".join(affiliations) if affiliations else "",
        "abstract": abstract,
    }


# ── DOI (OpenAlex API + CrossRef fallback) ───────────────────

DOI_RE = re.compile(r"(?:doi\.org/|doi:)(10\.\S+)", re.I)


def extract_doi(url: str) -> str | None:
    m = DOI_RE.search(url)
    return m.group(1).rstrip("/").rstrip(".") if m else None


def _reconstruct_abstract(inverted_index: dict) -> str:
    """从 OpenAlex 的 inverted index 格式还原摘要文本。"""
    if not inverted_index:
        return ""
    word_positions = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort()
    return " ".join(w for _, w in word_positions)


def fetch_openalex(doi: str) -> dict | None:
    """通过 OpenAlex API 获取论文元数据（摘要、机构信息更全）。"""
    api_url = f"https://api.openalex.org/works/doi:{doi}"
    try:
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "DailyPaperBot/1.0 (mailto:lingyuxia@link.cuhk.edu.hk)",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"    [WARN] OpenAlex request failed: {e}")
        return None

    title = data.get("title", "")

    # authors & affiliations
    authors = []
    affiliations = []
    for authorship in data.get("authorships", []):
        name = authorship.get("author", {}).get("display_name", "")
        if name:
            authors.append(name)
        for inst in authorship.get("institutions", []):
            inst_name = inst.get("display_name", "")
            if inst_name and inst_name not in affiliations:
                affiliations.append(inst_name)

    # abstract (stored as inverted index in OpenAlex)
    abstract = _reconstruct_abstract(data.get("abstract_inverted_index"))

    return {
        "title": title,
        "authors": ", ".join(authors),
        "affiliations": "; ".join(affiliations) if affiliations else "",
        "abstract": abstract,
    }


def fetch_crossref(doi: str) -> dict | None:
    """CrossRef API 作为后备数据源。"""
    api_url = f"https://api.crossref.org/works/{doi}"
    try:
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "DailyPaperBot/1.0 (mailto:lingyuxia@link.cuhk.edu.hk)",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"    [WARN] CrossRef request failed: {e}")
        return None

    msg = data.get("message", {})
    titles = msg.get("title", [])
    title = titles[0] if titles else ""

    authors_list = msg.get("author", [])
    authors = ", ".join(
        f"{a.get('given', '')} {a.get('family', '')}".strip() for a in authors_list
    )

    affs = []
    for a in authors_list:
        for aff in a.get("affiliation", []):
            name = aff.get("name", "")
            if name and name not in affs:
                affs.append(name)

    abstract = msg.get("abstract", "")
    abstract = re.sub(r"<[^>]+>", "", abstract).strip()

    return {
        "title": title,
        "authors": authors,
        "affiliations": "; ".join(affs) if affs else "",
        "abstract": abstract,
    }


def fetch_doi(doi: str) -> dict | None:
    """先尝试 OpenAlex（数据更全），失败则回退 CrossRef。"""
    # 优先 OpenAlex
    meta = fetch_openalex(doi)
    if meta and meta.get("title"):
        # 如果 OpenAlex 缺少摘要，再尝试 CrossRef 补充
        if not meta.get("abstract"):
            cr = fetch_crossref(doi)
            if cr and cr.get("abstract"):
                meta["abstract"] = cr["abstract"]
        return meta

    # 回退 CrossRef
    print("    Falling back to CrossRef...")
    return fetch_crossref(doi)


def fetch_openalex_by_arxiv(arxiv_id: str) -> dict | None:
    """通过 OpenAlex 查询 arxiv 论文的机构信息。"""
    # OpenAlex 使用 arxiv ID 的 URL 格式
    api_url = f"https://api.openalex.org/works/https://arxiv.org/abs/{arxiv_id}"
    try:
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "DailyPaperBot/1.0 (mailto:lingyuxia@link.cuhk.edu.hk)",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError:
        return None

    affiliations = []
    for authorship in data.get("authorships", []):
        for inst in authorship.get("institutions", []):
            inst_name = inst.get("display_name", "")
            if inst_name and inst_name not in affiliations:
                affiliations.append(inst_name)

    return {"affiliations": "; ".join(affiliations) if affiliations else ""}


# ── 主逻辑 ──────────────────────────────────────────────────


def load_data() -> list:
    if not DATA_FILE.exists():
        print(f"Data file not found: {DATA_FILE}")
        sys.exit(1)
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    # 跳过注释行再解析
    return yaml.safe_load(content) or []


def save_data(entries: list):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        # 保留文件头部注释
        f.write(
            "# 每日论文分享 / Daily Paper Sharing\n"
            "# 使用方法: 添加 link 后运行 python scripts/fetch_papers.py\n"
            "# 支持 arxiv 链接和 DOI 链接\n\n"
        )
        yaml.dump(
            entries,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=120,
        )


def process_paper(paper: dict) -> bool:
    """处理单篇论文，返回是否有更新。"""
    link = paper.get("link", "")
    if not link:
        return False

    # 如果已有 title，跳过
    if paper.get("title"):
        return False

    # 尝试 arxiv
    arxiv_id = extract_arxiv_id(link)
    if arxiv_id:
        print(f"  Fetching arxiv: {arxiv_id} ...")
        meta = fetch_arxiv(arxiv_id)
        if meta:
            # arxiv API 经常缺少机构信息，用 OpenAlex 补充
            if not meta.get("affiliations"):
                oa = fetch_openalex_by_arxiv(arxiv_id)
                if oa and oa.get("affiliations"):
                    meta["affiliations"] = oa["affiliations"]
            paper.update(meta)
            print(f"    -> {meta['title'][:60]}...")
            return True
        else:
            print(f"    -> Failed to fetch metadata")
            return False

    # 尝试 DOI
    doi = extract_doi(link)
    if doi:
        print(f"  Fetching DOI: {doi} ...")
        meta = fetch_doi(doi)
        if meta:
            paper.update(meta)
            print(f"    -> {meta['title'][:60]}...")
            return True
        else:
            print(f"    -> Failed to fetch metadata")
            return False

    print(f"  [WARN] Cannot parse link: {link}")
    return False


def main():
    entries = load_data()
    updated = 0

    for entry in entries:
        date = entry.get("date", "unknown")
        papers = entry.get("papers", [])
        if not papers:
            continue
        print(f"[{date}]")
        for paper in papers:
            if process_paper(paper):
                updated += 1
                time.sleep(1)  # 避免请求过快

    if updated > 0:
        save_data(entries)
        print(f"\nDone! Updated {updated} paper(s).")
    else:
        print("\nNo new papers to fetch.")


if __name__ == "__main__":
    main()
