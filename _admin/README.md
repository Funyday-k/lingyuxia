## Native management workspace (2026-11-11)

`/lingyuxia/admin/` now uses its own content-editing interface. Decap is no
longer embedded in the management page. The old `editor.html` remains a
fallback for existing Decap drafts; the current UI reads field definitions
from `config.yml` but does not load the Decap bundle.

- Daily Paper has a searchable title list, date filter and single-paper form.
  Dates remain a storage detail, not nested editing panels. Day notes are
  separate from paper comments. Changing a paper date moves only that paper.
- Notes, publications and galleries support new entries, edits, explicit
  document deletion and image/PDF uploads. Other pages and existing settings
  use native fields. Unknown front matter and HTML/Liquid bodies survive edits.
- All unsaved changes across sections are retained in the current tab and
  saved together. Reloading/leaving warns about unsaved changes. Input is
  frozen during remote operations. Sign-out clears the tab's login session.
- GitHub login reuses the configured Netlify OAuth provider. Its popup is
  accepted only from the exact provider origin and window. The GitHub token
  is held in memory/sessionStorage, never in site configuration or URLs.
  Repository write permission is checked before editing is opened.
- Save creates/updates a `cms-admin/*` branch and an open pull request. Content,
  attachments and explicit document removals share one Git commit. Drafts
  are publicly readable because the repository is public. No GitHub content
  is written until Save is clicked; Publish has a separate confirmation.
- A new draft checks the immutable published version before writing. Existing
  drafts reject a changed head and use non-forced updates. Publishing pins
  the draft head and lets GitHub reject merge conflicts/rules. This is not
  automatic semantic merging of concurrent YAML edits. Conflicts keep the
  local input; ambiguous network results include a GitHub recovery link.
- Uploaded images preview locally before saving, and from the draft commit
  on raw.githubusercontent.com after reopening. Files are limited to 10 MB;
  accepted extensions are PDF, PNG, JPEG, GIF, WebP and AVIF. Deleted documents
  do not delete shared attachments. Existing filenames remain unchanged;
  new note filenames follow their selected date.
- The only embedded surface is the private GoatCounter dashboard. Its access
  policy and separate session remain unchanged. Markdown previews intentionally
  support a safe subset; HTML/Liquid are never executed by the editor and
  formulas/templates should be checked on the published page.

Validation: production Jekyll build passed (the preexisting nested-post image
UTF-8 warnings remain). Automated tests cover content round trips on 36 real
files, 12 paper records, OAuth origin/source checks, permissions, optimistic
conflicts, atomic attachment/deletion commits and ambiguous-write recovery.
In an isolated browser fixture, search, edit, save, reload/reopen, publish
confirmation, note creation/deletion and image attachment preview passed;
all eight existing album images rendered. No fixture or mock is shipped.
Actual production content writes are not part of this verification.

Run maintained checks with Node 22+:

```sh
node --test _admin/tests/*.test.mjs
```

References: [Netlify OAuth setup](https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/),
[Decap popup protocol](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-lib-auth/src/netlify-auth.js),
[Git trees](https://docs.github.com/en/rest/git/trees#create-a-tree),
[pull-request merge](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request).

---

# Website administration

The public dashboard is `/lingyuxia/admin/`; the Decap editor is
`/lingyuxia/admin/editor.html`. Content stays in `Funyday-k/lingyuxia` on
`master`. The dashboard is public, while editing requires GitHub repository
write access. No credentials belong in this repository.

## One-time activation

1. Create a Netlify project for OAuth authentication. The existing public
   website remains hosted on GitHub Pages; no DNS migration is needed.
   In **Domain management**, add `funyday-k.github.io` and keep it as the
   primary domain. This matches the editor origin for the OAuth callback.
   Do not change DNS: pending DNS verification and unavailable Netlify TLS
   for this domain are expected because GitHub Pages continues to serve it.
2. Register a GitHub OAuth App with the homepage URL
   `https://funyday-k.github.io/lingyuxia/` and callback
   `https://api.netlify.com/auth/done`.
3. In the Netlify project's **Security > OAuth**, install the GitHub provider
   with that app's Client ID and Client Secret. Store the secret only there.
4. Set `netlify_site_id` in `_data/site_admin.yml` to the Netlify Project ID
   (UUID), then publish the configuration. This identifier is public.
5. Create a GoatCounter site for the homepage. Keep its dashboard private;
   do not enable public statistics or a visitor counter. Put only the site's
   code (the prefix of `<code>.goatcounter.com`) in `goatcounter_code`.
   Dashboard privacy is enforced by GoatCounter, not by this static site.
6. Publish the changes and log in through the editor. Verify a draft, PDF
   upload, publish action, GitHub Pages build and resulting public URL.
7. Visit a public page, then confirm its view appears in the private
   GoatCounter dashboard. Ad blockers may prevent collection. Use a signed-out
   browser to verify the statistics themselves are not publicly readable.

Both identifiers are now configured. No statistics are sent until a
valid code is supplied. No OAuth login is offered until a Project ID is set.
An identifier being present is not proof that its external service works.

References:
- https://decapcms.org/docs/github-backend/
- https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/
- https://www.goatcounter.com/help/start
- https://www.goatcounter.com/help/privacy

## Editing and publishing

- **Notes** edit `_posts` using the existing note metadata. Existing URLs and
  original tags can be retained. New filenames use the date and title.
- **Papers** edit `_publications`. PDF, arXiv and DOI links appear in both the
  publication list and detail page. No sample papers are published.
- **Pages** edit About, Research and CV. Existing front matter must remain
  intact when saving. The source editor is preferable for equations.
- **Website settings** edit title, description and selected sidebar fields.
  Decap retains unedited fields; review the first settings change in GitHub
  before publishing. YAML comments and formatting may be rewritten by Decap.
- **Service connections** edit the two public service identifiers. Changing
  the authentication ID can prevent subsequent logins; recovery is through
  GitHub's file editor.
- Existing interactive experiments remain code-based pages. This editor
  handles regular notes, not the JavaScript inside experiments.
- Uploaded assets go to `files/uploads`, with public URLs beginning
  `/lingyuxia/files/uploads/`. Keep individual files below 10 MB. Uploaded
  assets and draft branches in this public repository are public; a draft
  is a publishing workflow, not confidential storage.
- Editorial workflow uses draft branches/pull requests. Publishing merges
  content into `master`; GitHub Pages must finish building before the public
  website reflects the change. Removing an entry does not erase its uploaded
  files or Git history. Delete unused media only after checking references.

## Analytics and maintenance

The GoatCounter integration runs only in a production Jekyll build, on
`funyday-k.github.io`, outside `/lingyuxia/admin/`. It sends the pathname without
query strings or hash fragments. Standalone interactive pages include the
same analytics partial as the theme. Clear `goatcounter_code` to disable it.
If the homepage domain changes, update the hostname guard in
`assets/js/visitor-analytics.js` and the CMS site/media URL settings.

The editor uses pinned Decap CMS 3.17.3 from jsDelivr. It is loaded only after
the connection configuration is present. Failed script loads show a retry
message. Updating Decap should include testing login and a draft round trip.
Do not enable `local_backend` or a test backend in the published config.

Before activation, local tests can verify the configured fields, rendered
pages, upload link paths and tracking guards. OAuth, GitHub writes and private
dashboard permissions require the external accounts and remain unverified
until the activation checks above pass.

## Implementation verification (2026-11-11)

- Production Jekyll build completed. The existing nested image folder under
  `_posts/2022-09-20-blog-post-3/pic` emits UTF-8 read warnings; those source
  files were not changed in this task.
- Chrome checks covered the dashboard at desktop and mobile widths, setup
  expansion, and the unconfigured-editor guard. No Browser plugin was
  available, so existing Playwright and Chrome were used.
- Decap's isolated test backend loaded the collections and saved a note
  draft, including PDF upload, selection and the correct public attachment
  URL. The selected date matched the filename exactly. A settings edit
  preserved every other YAML value, including nested
  author settings. Test-backend overrides were only in temporary QA scripts.
- Temporary Jekyll content verified note and publication lists, PDF URLs,
  authors, abstracts, arXiv/DOI links, and analytics inclusion on ordinary
  and standalone pages. No test content was added to the repository.
- Analytics checks covered an empty/invalid code, the production hostname,
  management paths and omission of query strings/hash fragments.
- Deployed the management UI and analytics integration to GitHub Pages.
  GoatCounter received a real verification pageview, with the dashboard set
  to logged-in users only; an anonymous request returned the login page.
- Live Safari OAuth initially stalled at Authorized. Adding the existing
  GitHub Pages host as the Netlify primary domain resolved it without DNS
  changes. The editor then authenticated and loaded both existing notes.
  Actual content writes through the live CMS remain untested; draft and
  attachment saves were tested only in the isolated backend.

## Earlier embedded workspace (superseded on 2026-11-11)

Use `/lingyuxia/admin/` as the shared workspace. The top navigation follows
Research, Publications, Daily Paper, Note, CV and Gallery on the public site,
with private visitor statistics and website settings added alongside them.
The content editor stays in a same-origin frame. Switching to statistics
keeps the current editor mounted; changing editor sections warns when the
editor reports unsaved changes.

- Daily Paper edits the existing `_data/daily_papers.yml` as date groups and
  nested paper records. A custom `yaml-list` formatter wraps the root list
  only in the editor and writes a root list back. No data migration is needed.
  The formatter uses pinned js-yaml 4.1.1 with its bundled MIT license.
- Note includes the root-array interactive directory `_data/notes.yml`, and
  nested posts are discoverable. Interactive experiment code is unchanged.
- Gallery edits existing `_portfolio` albums and uses `/images/portfolio`
  for media, matching the existing `/lingyuxia/images/portfolio` public URLs.
- Publications has both paper entries and a page-settings view. Its existing
  illustration is now `placeholder_image` in front matter; the rendering
  remains the same. Page descriptions are optional `intro` fields.
- GoatCounter permits embedding only by `https://funyday-k.github.io` and
  remains viewable only by logged-in users, with visitor counters disabled.
  No API token or secret-token dashboard URL is placed in the public site.
  A separate GoatCounter login may still be necessary. Browsers that block
  cross-site session cookies may require opening the private dashboard in a
  separate tab; do not make statistics public to work around that restriction.

Validation: root-list round trips preserve all values in the existing paper
and note directories. The isolated CMS loaded all eight date groups and
saved an edited paper comment as a draft. It loaded and saved the existing
album, and all eight album image URLs loaded in the preview. Cancelling an
unsaved-change navigation kept the draft in place. These writes used only
the temporary test backend, never the production repository.
