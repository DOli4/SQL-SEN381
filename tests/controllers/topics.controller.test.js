
import { jest, describe, test, expect, beforeEach } from '@jest/globals'
import express from 'express'
import request from 'supertest'

// ---- Mock mssql (callable types + MAX) BEFORE importing SUT ----
const getPoolMock = jest.fn()
const sqlStub = {
    VarChar: (len) => ({ __t: 'VarChar', len }),
    Int: () => ({ __t: 'Int' }),
    MAX: 4000
    }
    jest.unstable_mockModule('../../src/db/mssql.js', () => ({
    getPool: getPoolMock,
    sql: sqlStub
    }))

    // Import SUT after mocks
    const topics = await import('../../src/controllers/topics.controller.js')
    const { list, getOne, create } = topics

    // util: create a pool that returns the given results in order for each .query()
    function makePoolWithQueries(sequence) {
    let i = 0
    return {
        request() {
        return {
            input() { return this },
            async query() {
            const step = sequence[i++]
            if (!step) throw new Error('no more mock results')
            if (step.reject) throw new Error(step.reject)
            return step  // e.g. { recordset: [...] }
            }
        }
        }
    }
    }

    const appWith = (handler, path = '/act', method = 'get', injectUserSub) => {
    const app = express()
    app.use(express.json())
    app[method](path, async (req, res, next) => {
        try {
        if (injectUserSub) req.user = { sub: injectUserSub }
        await handler(req, res, next)
        } catch (err) {
        next(err)
        }
    })
    // ⬇️ error handler so rejected queries return 500 instead of hanging
    app.use((err, _req, res, _next) => {
        res.status(500).json({ error: err.message || 'Internal error' })
    })
    return app
    }


    beforeEach(() => {
    jest.clearAllMocks()
    })

    describe('topics.controller list', () => {
    test('200 returns recordset array', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 1, Title: 'A' }, { Topic_ID: 2, Title: 'B' }] }
        ]))

        const res = await request(appWith(list)).get('/act')
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(2)
        expect(res.body[0]).toEqual(expect.objectContaining({ Title: 'A' }))
    })

    test('500 when DB fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'db down' }]))

        const res = await request(appWith(list)).get('/act')
        expect(res.status).toBe(500)
    })
    })

    describe('topics.controller getOne', () => {
    test('200 returns the single topic', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 10, Title: 'Solo' }] }
        ]))

        const app = appWith(getOne, '/act/:id')
        const res = await request(app).get('/act/10')
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expect.objectContaining({ Topic_ID: 10 }))
    })

    test('404 when not found', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ recordset: [] }]))
        const app = appWith(getOne, '/act/:id')
        const res = await request(app).get('/act/999')
        expect(res.status).toBe(404)
    })
    })

    describe('topics.controller create', () => {
        test('201 on success when description is missing (stored as NULL)', async () => {
  // DB returns a new Topic_ID as usual
    getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 124 }] }
    ]))

    // create request with no description -> hits (description || '').trim() || null
    const res = await request(appWith(create, '/act', 'post', 9))
        .post('/act')
        .send({ title: 'NoDesc', moduleId: 3 }) // no description

    expect(res.status).toBe(201)
    expect(res.body).toEqual(expect.objectContaining({ Topic_ID: 124 }))
    })

    test('400 when title or moduleId missing', async () => {
        const res = await request(appWith(create, '/act', 'post', 123))
        .post('/act').send({ description: 'x' })
        expect(res.status).toBe(400)
    })

    test('201 on success returns inserted row', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 123, Title: 'New', Description: 'Intro', Module_ID: 3, User_ID: 9 }] }
        ]))

        const res = await request(appWith(create, '/act', 'post', 9))
        .post('/act')
        .send({ title: 'New', description: 'Intro', moduleId: 3 })

        expect(res.status).toBe(201)
        expect(res.body).toEqual(expect.objectContaining({ Topic_ID: 123 }))
    })

    test('500 when insert fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'insert failed' }]))

        const res = await request(appWith(create, '/act', 'post', 9))
        .post('/act')
        .send({ title: 'X', description: 'Y', moduleId: 1 })

        expect(res.status).toBe(500)
    })
})
