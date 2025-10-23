    /**
     * @jest-environment jsdom
     */
    import { jest, beforeEach, afterEach, test, expect } from '@jest/globals'
    import { JSDOM } from 'jsdom'

    // Minimal HTML of the topic-create page (no EJS dependency)
    // NOTE: on success we call window.redirect('/topics') if defined (test hook),
    // else fall back to window.location.href = '/topics'.
    const PAGE_HTML = `
    <div class="form-narrow">
    <h2 class="mb-3">New Topic</h2>
    <form id="f" onsubmit="return false;">
        <div class="mb-3">
        <label class="form-label">Title</label>
        <input name="title" class="form-control" required />
        </div>
        <div class="mb-3">
        <label class="form-label">Module</label>
        <input name="moduleId" type="number" class="form-control" placeholder="e.g., 1" required />
        </div>
        <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea name="description" rows="5" class="form-control" placeholder="Describe your issue..."></textarea>
        </div>
        <button class="btn btn-primary w-100" onclick="save()">Create Topic</button>
        <p id="msg" class="text-danger mt-2"></p>
    </form>
    </div>
    <script>
    async function save(){
    const body = {
        title: f.title.value.trim(),
        moduleId: Number(f.moduleId.value),
        description: f.description.value.trim() || null
    };
    try {
        const res = await fetch('/api/topics', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { msg.textContent = data.error || 'Failed to create topic'; return; }
        if (window.redirect) { window.redirect('/topics'); }
        else { window.location.href = '/topics'; }
    } catch (e) { msg.textContent = e.message; }
    }
    </script>
    `;

    let dom, win, doc;

    function loadPage() {
    dom = new JSDOM(PAGE_HTML, {
        runScripts: 'dangerously',
        resources: 'usable',
        url: 'http://localhost/'
    })
    win = dom.window
    doc = win.document

    // Define real globals and wrap the form so f.title/moduleId/description resolve to inputs
    win.eval(`
        var __form = document.getElementById('f');
        var f = new Proxy(__form, {
        get(target, prop) {
            if (prop === 'title') return document.querySelector('input[name="title"]');
            if (prop === 'moduleId') return document.querySelector('input[name="moduleId"]');
            if (prop === 'description') return document.querySelector('textarea[name="description"]');
            return target[prop];
        }
        });
        var msg = document.getElementById('msg');
    `)

    // Test hook for redirects we can assert against
    win.redirect = jest.fn()
    }

    // Helpers to mock fetch in the browser context
    function mockWindowFetchResolved(data, ok = true) {
    win.fetch = jest.fn().mockResolvedValue({
        ok,
        json: async () => data
    })
    global.fetch = win.fetch
    }
    function mockWindowFetchRejected(message = 'Network down') {
    win.fetch = jest.fn().mockRejectedValue(new Error(message))
    global.fetch = win.fetch
    }

    beforeEach(() => {
    loadPage()
    jest.spyOn(console, 'error').mockImplementation(() => {}) // silence logs
    })
    afterEach(() => {
    jest.restoreAllMocks()
    win?.close?.()
    })

    /* =========================
    TS-STF-01  Save valid Topic
    ========================= */
    test('save() → valid payload posts & redirects to /topics', async () => {
    // fill form fields
    doc.querySelector('input[name="title"]').value = 'Test'
    doc.querySelector('input[name="moduleId"]').value = '3'
    doc.querySelector('textarea[name="description"]').value = 'Intro'

    // mock successful fetch on window
    mockWindowFetchResolved({ Topic_ID: 123 }, true)

    // call save()
    await win.save()

    // assert window.fetch called correctly
    expect(win.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = win.fetch.mock.calls[0]
    expect(url).toBe('/api/topics')
    const sent = JSON.parse(opts.body)
    expect(sent).toEqual({ title: 'Test', moduleId: 3, description: 'Intro' })

    // redirected via test hook
    expect(win.redirect).toHaveBeenCalledWith('/topics')
    })

    /* ======================================
    TS-STF-02  Missing Title validation path
    ====================================== */
    test('save() → server 400 on missing title shows error and does not redirect', async () => {
    // title intentionally blank
    doc.querySelector('input[name="title"]').value = '   '
    doc.querySelector('input[name="moduleId"]').value = '2'
    doc.querySelector('textarea[name="description"]').value = 'no title'

    mockWindowFetchResolved({ error: 'Title is required' }, false)

    await win.save()

    // error message rendered
    expect(doc.getElementById('msg').textContent).toMatch(/title is required/i)

    // body sent but no redirect
    const [, opts] = win.fetch.mock.calls[0]
    const sent = JSON.parse(opts.body)
    expect(sent.title).toBe('') // trimmed to empty by the page code
    expect(win.redirect).not.toHaveBeenCalled()
    })

    /* ===================================
    TS-STF-03  DB/network failure handling
    =================================== */
    test('save() → handles fetch rejection (DB/network down)', async () => {
    // valid inputs
    doc.querySelector('input[name="title"]').value = 'NetFail'
    doc.querySelector('input[name="moduleId"]').value = '1'
    doc.querySelector('textarea[name="description"]').value = ''

    // fetch throws
    mockWindowFetchRejected('Network down')

    await win.save()

    // payload sent (description null)
    const [, opts] = win.fetch.mock.calls[0]
    const sent = JSON.parse(opts.body)
    expect(sent).toEqual({ title: 'NetFail', moduleId: 1, description: null })

    // error surfaced to UI; no redirect
    expect(doc.getElementById('msg').textContent).toMatch(/network down/i)
  expect(win.redirect).not.toHaveBeenCalled()
})
