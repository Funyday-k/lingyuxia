---
layout: archive
title: "Software"
permalink: /software/
author_profile: true
---

## Sci-Station

[Sci-Station](https://github.com/Funyday-k/Sci-Station) is a local-first research workstation for macOS. It brings papers, project notes, PDFs, materials, tasks, and optional AI tools into one workspace, with the main data kept inside a user-chosen local research root.

It is designed to support day-to-day research work: managing a library of papers, organizing project spaces, reading and annotating PDFs, linking notes and files, and keeping research materials in a structure that is easy to inspect and move.

The current feature set includes workspace creation and recovery, paper import through PDF/DOI/arXiv/links, metadata and BibTeX management, a PDF reader with notes and links, a Markdown knowledge base, a project space for each research topic, a materials area for code and figures, task and calendar views, and an optional AI lab with audit trails.

## APEX

[APEX](https://github.com/Funyday-k/APEX) is a local web application for extracting structured data from scientific figures. It combines computer vision, vision-language models, and human-in-the-loop workflows to turn plots into usable data with a guided pipeline.

The project is aimed at practical figure digitization in scientific work, with a workflow that covers upload, analysis, calibration, extraction, and export.

Its stack is a React front end with a FastAPI back end, OpenCV and scikit-learn for the CV side, and a local or remote VLM backend selected by configuration. It also supports Docker-based deployment and an end-to-end guided flow for plot digitization.
