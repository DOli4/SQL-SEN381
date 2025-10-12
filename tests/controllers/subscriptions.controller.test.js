    // tests/controllers/subscriptions.controller.test.js
    import { jest, describe, test, beforeEach, expect } from '@jest/globals'
    import express from 'express'
    import request from 'supertest'

    // mock DB
    const getPoolMock = jest.fn()
    const sqlStub = { Int: () => ({ __t: 'Int' }) }
    jest.unstable_mockModule('../../src/db/mssql.js', () => ({
    getPool: getPoolMock,
    sql: sqlStub
    }))

    // mock auth middleware to inject req.user
    const requireAuthMock = jest.fn((req, _res, next) => {
    const sub = Number(req.headers['x-sub'] || 1)
    const role = String(req.headers['x-role'] || 'STUDENT').toUpperCase()
    req.user = { sub, RoleName: role, role }
    next()
    })
    jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
    requireAuth: requireAuthMock
    }))

    const ctrl = await import('../../src/controllers/subscriptions.controller.js')
    const { getUserSubscriptions, getTopicSubscribers } = ctrl

    function poolWith(sequence) {
    let i = 0
    return {
        request() {
        return {
            input() { return this },
            async query() {
            const step = sequence[i++]
            if (!step) throw new Error('no more mock results')
            if (step.reject) throw new Error(step.reject)
            return step
            }
        }
        }
    }
    }

    // helper that registers the CORRECT parameterized path
    function appWith(handler, path) {
    const app = express()
    app.use(express.json())
    app.get(path, requireAuthMock, handler)
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }))
    return app
    }

    beforeEach(() => {
    jest.clearAllMocks()
    })

    /* TS-RTS-01: user with subscriptions */
    test('TS-RTS-01 getUserSubscriptions returns only items for user', async () => {
    getPoolMock.mockResolvedValueOnce(poolWith([
        { recordset: [{ Total: 2 }] },
        { recordset: [{ Topic_ID: 5, User_ID: 1 }, { Topic_ID: 7, User_ID: 1 }] }
    ]))

    const app = appWith(getUserSubscriptions, '/users/:userId/subscriptions') // <-- param path
    const res = await request(app)
        .get('/users/1/subscriptions')
        .set('x-sub', '1').set('x-role', 'STUDENT')

    expect(res.status).toBe(200)
    expect(res.body.items.every(x => x.User_ID === 1)).toBe(true)
    expect(res.body.totalCount).toBe(2)
    })

    /* TS-RTS-02: user has none */
    test('TS-RTS-02 getUserSubscriptions empty list when none', async () => {
    getPoolMock.mockResolvedValueOnce(poolWith([
        { recordset: [{ Total: 0 }] },
        { recordset: [] }
    ]))

    const app = appWith(getUserSubscriptions, '/users/:userId/subscriptions')
    const res = await request(app)
        .get('/users/2/subscriptions')
        .set('x-sub', '2').set('x-role', 'STUDENT')

    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
    expect(res.body.totalCount).toBe(0)
    })

    /* TS-RTS-03: pagination behaviour */
    test('TS-RTS-03 supports limit & page (length <= limit)', async () => {
    getPoolMock.mockResolvedValueOnce(poolWith([
        { recordset: [{ Total: 50 }] },
        { recordset: Array.from({ length: 10 }, (_, i) => ({ Topic_ID: i + 1, User_ID: 1 })) }
    ]))

    const app = appWith(getUserSubscriptions, '/users/:userId/subscriptions')
    const res = await request(app)
        .get('/users/1/subscriptions?limit=10&page=1')
        .set('x-sub', '1').set('x-role', 'STUDENT')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(10)
    expect(res.body.limit).toBe(10)
    expect(res.body.page).toBe(1)
    })

    /* TS-RTS-04: access control */
    test('TS-RTS-04 denies access when user requests another user', async () => {
    const app = appWith(getUserSubscriptions, '/users/:userId/subscriptions')
    const res = await request(app)
        .get('/users/2/subscriptions')
        .set('x-sub', '3').set('x-role', 'STUDENT')

    expect(res.status).toBe(403)
    })

    /* TS-RTS-05: DB failure */
    test('TS-RTS-05 handles DB error gracefully', async () => {
    getPoolMock.mockResolvedValueOnce(poolWith([{ reject: 'db down' }]))

    const app = appWith(getUserSubscriptions, '/users/:userId/subscriptions')
    const res = await request(app)
        .get('/users/1/subscriptions')
        .set('x-sub', '1').set('x-role', 'STUDENT')

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/failed to retrieve subscriptions/i)
    })

    /* (optional) admin/tutor list of topic subscribers */
    test('getTopicSubscribers requires admin/tutor', async () => {
    const app = appWith(getTopicSubscribers, '/topics/:topicId/subscribers') // <-- param path
    const res = await request(app)
        .get('/topics/9/subscribers')
        .set('x-sub', '1').set('x-role', 'STUDENT')

    expect(res.status).toBe(403)

    
})
