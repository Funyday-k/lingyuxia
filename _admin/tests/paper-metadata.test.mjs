import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPaperMetadata, identifyPaperLink } from '../../admin/paper-metadata.js';

const modern = '1909.09177';
const legacy = 'hep-th/9711200';
const publicationDoi = '10.1103/PhysRevLett.116.061102';
const dataCiteDoi = '10.6084/m9.figshare.21545982';

const response = (value, status = 200) => Response.json(value, { status });
const datacite = (doi, attributes = {}) => ({ data: { attributes: { doi, ...attributes } } });

test('identifies arXiv PDF and legacy URLs, preserving the selected version', () => {
  assert.deepEqual(identifyPaperLink(` https://arxiv.org/pdf/${modern}v2.pdf?download=1#page=6 `),
    { type: 'arxiv', id: modern + 'v2', url: `https://arxiv.org/abs/${modern}v2` });
  assert.deepEqual(identifyPaperLink(`https://export.arxiv.org/abs/${legacy}v3/?ref=test`),
    { type: 'arxiv', id: legacy + 'v3', url: `https://arxiv.org/abs/${legacy}v3` });
  assert.equal(identifyPaperLink('https://arxiv.org/abs/0704.0001').id, '0704.0001');
});

test('normalizes DOI URLs and accepts direct DOI text', () => {
  const expected = { type: 'doi', id: publicationDoi, url: `https://doi.org/${publicationDoi}` };
  assert.deepEqual(identifyPaperLink(`https://dx.doi.org/${publicationDoi}?ref=abc#details`), expected);
  assert.deepEqual(identifyPaperLink(`doi: ${publicationDoi}`), expected);
  assert.equal(identifyPaperLink('https://doi.org/10.1023%2Fa%3A1026654312961').id, '10.1023/a:1026654312961');
});

test('rejects other sites, credentials, malformed identifiers, and insecure URLs without a request', async () => {
  const attempts = ['', 'https://example.org/paper', 'https://arxiv.org.example.org/abs/1909.09177',
    'https://user@arxiv.org/abs/1909.09177', 'http://arxiv.org/abs/1909.09177',
    'https://arxiv.org/abs/1913.09177', 'https://doi.org/not-a-doi', 'https://doi.org/10.1000/a/%2F../b'];
  for (const link of attempts) {
    await assert.rejects(fetchPaperMetadata(link, {
      fetchImpl() { assert.fail('An invalid link must not be fetched'); },
    }), /链接|编号/);
  }
});

test('loads the base arXiv DataCite record and preserves the selected arXiv version link', async () => {
  const id = `10.48550/arXiv.${legacy}`;
  const expected = `https://api.datacite.org/dois/${id}`;
  const metadata = await fetchPaperMetadata(`https://arxiv.org/pdf/${legacy}v3.pdf`, {
    async fetchImpl(url, init) {
      assert.equal(url, expected);
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      return response(datacite(id.toLowerCase(), {
        titles: [{ title: 'Original &amp; title' }, { title: 'Alternate', titleType: 'AlternativeTitle' }],
        creators: [
          { name: 'López, María', givenName: 'María', familyName: 'López', affiliation: ['Institute A'] },
          { name: 'Team B', affiliation: [{ name: 'Institute A' }, { name: 'Institute B' }] },
        ],
        descriptions: [{ descriptionType: 'Other', description: 'A note' },
          { descriptionType: 'Abstract', description: 'A result: x &lt; y.  No translation.' }],
        dates: [{ dateType: 'Submitted', dateInformation: 'v1', date: '1997-11-27T23:53:13Z' }],
        relatedIdentifiers: [{ relationType: 'IsVersionOf', relatedIdentifier: '10.1023/a:1026654312961', relatedIdentifierType: 'DOI' }],
      }));
    },
  });
  assert.deepEqual(metadata, {
    title: 'Original & title', authors: 'María López, Team B', affiliations: 'Institute A; Institute B',
    abstract: 'A result: x < y. No translation.',
    link: `https://arxiv.org/abs/${legacy}v3`, arxiv_url: `https://arxiv.org/abs/${legacy}v3`,
    doi_url: 'https://doi.org/10.1023/a%3A1026654312961', venue: 'arXiv', date: '1997-11-27',
    metadataVersion: 'record', source: 'DataCite', sourceURL: expected,
  });
});

test('loads Crossref metadata, strips JATS safely, and leaves missing affiliations blank', async () => {
  const metadata = await fetchPaperMetadata(`https://doi.org/${publicationDoi}`, {
    async fetchImpl(url) {
      assert.equal(url, `https://api.crossref.org/works/${publicationDoi}`);
      return response({ message: {
        DOI: publicationDoi.toLowerCase(), title: ['An <i>italic</i> title'], author: [{ given: 'A.', family: 'Researcher' }],
        abstract: '<jats:p>First paragraph with &#x03b1; &amp; &#946;.</jats:p><script>never execute</script><jats:p>Second <jats:italic>paragraph</jats:italic>.</jats:p>',
        'container-title': ['Physical Review Letters'],
        published: { 'date-parts': [[2016, 2, 11]] },
        relation: { 'has-preprint': [{ 'id-type': 'doi', id: `10.48550/arxiv.${modern}` }] },
      } });
    },
  });
  assert.equal(metadata.title, 'An italic title');
  assert.equal(metadata.abstract, 'First paragraph with α & β.\n\nSecond paragraph.');
  assert.equal(metadata.affiliations, '');
  assert.equal(metadata.arxiv_url, `https://arxiv.org/abs/${modern}`);
  assert.equal(metadata.date, '2016-02-11');
  assert.equal(metadata.venue, 'Physical Review Letters');
  assert.equal(metadata.source, 'Crossref');
});

test('falls back from Crossref to DataCite for another agency and leaves unsupported data blank', async () => {
  const attempts = [];
  const metadata = await fetchPaperMetadata(dataCiteDoi, {
    async fetchImpl(url) {
      attempts.push(url);
      if (attempts.length === 1) return response({}, 404);
      return response(datacite(dataCiteDoi, {
        titles: [{ title: 'Reported title' }], publisher: 'A publisher', publicationYear: 2022,
        descriptions: [{ descriptionType: 'Other', description: 'Not an abstract' }],
      }));
    },
  });
  assert.deepEqual(attempts, [`https://api.crossref.org/works/${dataCiteDoi}`, `https://api.datacite.org/dois/${dataCiteDoi}`]);
  assert.equal(metadata.source, 'DataCite');
  assert.equal(metadata.abstract, '');
  assert.equal(metadata.venue, '');
  assert.equal(metadata.authors, '');
  assert.equal(metadata.date, '2022');
  assert.ok(!metadata.arxiv_url);
});

test('handles missing, rate-limited, mismatched, and unreachable records', async () => {
  const input = `https://arxiv.org/abs/${modern}`;
  await assert.rejects(fetchPaperMetadata(input, { fetchImpl: () => response({}, 404) }), /暂未找到.*arXiv/);
  await assert.rejects(fetchPaperMetadata(input, { fetchImpl: () => response({}, 429) }), /过于频繁/);
  await assert.rejects(fetchPaperMetadata(input, {
    fetchImpl: () => response(datacite(`10.48550/arxiv.${legacy}`, { titles: [{ title: 'Wrong paper' }] })),
  }), /没有提供可用的标题/);
  await assert.rejects(fetchPaperMetadata(input, { fetchImpl: () => { throw new TypeError('CORS'); } }), /暂时无法读取/);
});

test('a caller cancellation ends an in-flight request and does not start another provider', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = fetchPaperMetadata(publicationDoi, {
    signal: controller.signal,
    async fetchImpl(url, { signal }) {
      calls += 1;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('preserves plain inequalities and explicit mathematical sub/superscripts as text', async () => {
  const metadata = await fetchPaperMetadata(publicationDoi, {
    fetchImpl: () => response({ message: {
      DOI: publicationDoi, title: ['Math formatting'],
      abstract: '<jats:p>When x < y and a &gt; b, 10<jats:sup>3</jats:sup> gives <e:math xmlns:e="http://www.w3.org/1998/Math/MathML"><e:msubsup><e:mi>M</e:mi><e:mn>1</e:mn><e:mn>2</e:mn></e:msubsup></e:math>. Also, x&lt;y and a&gt;b in the selected regime.</jats:p>',
    } }),
  });
  assert.equal(metadata.abstract, 'When x < y and a > b, 10^{3} gives M_{1}^{2}. Also, x<y and a>b in the selected regime.');
});

test('strips encoded active markup instead of returning it as literal HTML', async () => {
  const metadata = await fetchPaperMetadata(publicationDoi, {
    fetchImpl: () => response({ message: {
      DOI: publicationDoi, title: ['Title &lt;img/src=x onerror=example()&gt;'],
      abstract: '&lt;script&gt;sample&lt;/script&gt;Text &lt;img/src=x onerror=example()&gt; remains.',
    } }),
  });
  assert.equal(metadata.title, 'Title');
  assert.equal(metadata.abstract, 'Text remains.');
});
